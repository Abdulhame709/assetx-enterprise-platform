import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  alertActionHistory,
  alertAssignments,
  alertResolutions,
  attachments,
  auditLogs,
  billingCycles,
  calculationSnapshots,
  fuelInventoryClosures,
  fuelIssues,
  fuelProducts,
  fuelReceipts,
  fuelSuppliers,
  fuelTransactions,
  fuelWasteRecords,
  generatorRuns,
  generators,
  maintenanceRecords,
  meterReadings,
  settingsVersions,
  sectionRoleGrants,
  siteRoleGrants,
  siteSections,
  sites,
  tariffBrackets,
  tariffVersions,
  type InsertUser,
  utilityInvoices,
  utilityMeters,
  userInvitations,
  userPermissions,
  users,
  type fuelSectionRoles,
  platformSections,
  type permissionActions,
  type permissionEffects,
  type siteAccessLevels,
} from "../drizzle/schema";
import {
  calculateAccountingDepreciation,
  calculateAllocatedMaintenance,
  calculateOperationalDepreciation,
  calculateWholeCycleUtilityCost,
  deriveGeneratorKwh,
  recommendEnergySource,
  type TariffBracket,
} from "./domain/costing";
import { ENV } from "./_core/env";
import { assertCycleTransition } from "./domain/cycle-status";
import { assertFuelAvailable, assertFuelCapacity, calculateCorrectedFuelQuantity, calculateFuelBalance, calculateFuelIssueQuantity, classifyFuelVariance } from "./domain/fuel";
import { assessFuelLevel, assessInventoryVariance, assessMaintenanceRuntime } from "./domain/monitoring";

let _db: ReturnType<typeof drizzle> | null = null;
const asNumber = (value: unknown) => Number(value ?? 0);

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) _db = drizzle(process.env.DATABASE_URL);
  return _db;
}

async function dbOrThrow() {
  const db = await getDb();
  if (!db) throw new Error("اتصال قاعدة البيانات غير متاح.");
  return db;
}

async function getDefaultSiteId() {
  const db = await dbOrThrow();
  const [site] = await db.select({ id: sites.id }).from(sites).where(eq(sites.code, "MAIN")).limit(1);
  if (!site) throw new Error("لم يُعثر على الموقع الرئيسي.");
  return site.id;
}

async function writeAudit(input: { actorUserId: number; action: string; entityType: string; entityId?: number; beforeValue?: unknown; afterValue?: unknown; reason?: string }) {
  const db = await dbOrThrow();
  await db.insert(auditLogs).values({ ...input, beforeValue: input.beforeValue as object | undefined, afterValue: input.afterValue as object | undefined });
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId, lastSignedIn: user.lastSignedIn ?? new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: values.lastSignedIn };
  (["name", "email", "loginMethod"] as const).forEach(key => {
    if (user[key] !== undefined) {
      values[key] = user[key] ?? null;
      updateSet[key] = user[key] ?? null;
    }
  });
  const [invitation] = user.email
    ? await db.select({ id: userInvitations.id, role: userInvitations.role }).from(userInvitations).where(and(eq(userInvitations.email, user.email), eq(userInvitations.status, "pending"))).orderBy(desc(userInvitations.createdAt)).limit(1)
    : [];
  const assignedRole = user.role ?? invitation?.role ?? (user.openId === ENV.ownerOpenId ? "admin" : undefined);
  if (assignedRole) {
    values.role = assignedRole;
    updateSet.role = assignedRole;
  }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  if (invitation) await db.update(userInvitations).set({ status: "accepted" }).where(eq(userInvitations.id, invitation.id));
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getCycleById(id: number) {
  const db = await dbOrThrow();
  const result = await db.select().from(billingCycles).where(eq(billingCycles.id, id)).limit(1);
  return result[0];
}

export async function listBillingCycles(siteIds?: number[]) {
  const db = await dbOrThrow();
  if (siteIds && !siteIds.length) return [];
  if (siteIds) return db.select().from(billingCycles).where(inArray(billingCycles.siteId, siteIds)).orderBy(desc(billingCycles.periodStart));
  return db.select().from(billingCycles).orderBy(desc(billingCycles.periodStart));
}

export async function createBillingCycle(input: { title: string; periodStart: number; periodEnd: number; siteId?: number; createdBy: number }) {
  const db = await dbOrThrow();
  const siteId = input.siteId ?? await getDefaultSiteId();
  const [result] = await db.insert(billingCycles).values({ title: input.title, periodStart: new Date(input.periodStart), periodEnd: new Date(input.periodEnd), siteId, createdBy: input.createdBy });
  await writeAudit({ actorUserId: input.createdBy, action: "create", entityType: "billingCycle", entityId: result.insertId, afterValue: input });
  return { id: result.insertId };
}

export async function updateBillingCycle(input: { id: number; title: string; periodStart: number; periodEnd: number; actorUserId: number }) {
  const db = await dbOrThrow();
  const [before] = await db.select().from(billingCycles).where(eq(billingCycles.id, input.id)).limit(1);
  if (!before) throw new Error("الدورة غير موجودة.");
  if (before.status === "closed") throw new Error("لا يمكن تعديل دورة مقفلة.");
  const changes = { title: input.title, periodStart: new Date(input.periodStart), periodEnd: new Date(input.periodEnd) };
  await db.update(billingCycles).set(changes).where(eq(billingCycles.id, input.id));
  await writeAudit({ actorUserId: input.actorUserId, action: "update", entityType: "billingCycle", entityId: input.id, beforeValue: before, afterValue: changes });
  return { success: true };
}

export async function setCycleStatus(input: { cycleId: number; status: "data_entry" | "validation" | "reviewed" | "approved" | "closed"; reason: string; userId: number }) {
  const db = await dbOrThrow();
  const before = await getCycleById(input.cycleId);
  if (!before) throw new Error("الدورة غير موجودة.");
  assertCycleTransition(before.status, input.status);
  const timestamps = input.status === "approved" ? { approvedBy: input.userId, approvedAt: new Date() } : input.status === "closed" ? { closedBy: input.userId, closedAt: new Date() } : {};
  await db.update(billingCycles).set({ status: input.status, ...timestamps }).where(eq(billingCycles.id, input.cycleId));
  await writeAudit({ actorUserId: input.userId, action: `status:${input.status}`, entityType: "billingCycle", entityId: input.cycleId, beforeValue: before, afterValue: timestamps, reason: input.reason });
  if (input.status === "approved" || input.status === "closed") {
    const analysis = await getCycleAnalysis(input.cycleId);
    await db.insert(calculationSnapshots).values({
      billingCycleId: input.cycleId,
      calculationType: input.status === "approved" ? "approval" : "closure",
      engineVersion: "1.0.0",
      inputs: {
        tariffVersionId: analysis.cycle.tariffVersionId,
        selectedCostModel: analysis.cycle.selectedCostModel,
        depreciationMode: analysis.cycle.depreciationMode,
        maintenanceMode: analysis.cycle.maintenanceMode,
        tariffVersionName: analysis.utility.tariffVersionName,
        unitRate: analysis.utility.unitRate,
      },
      outputs: { utility: analysis.utility, generators: analysis.generators, comparison: analysis.comparison },
      warnings: analysis.utility.reconciliationStatus === "matched" ? [] : ["تحتاج مطابقة الفاتورة إلى مراجعة أو أنها غير مسجلة."],
      createdBy: input.userId,
    });
  }
  return { success: true };
}

export async function listUtilityMeters(siteIds?: number[]) {
  const db = await dbOrThrow();
  if (siteIds && !siteIds.length) return [];
  if (siteIds) return db.select().from(utilityMeters).where(inArray(utilityMeters.siteId, siteIds)).orderBy(utilityMeters.name);
  return db.select().from(utilityMeters).orderBy(utilityMeters.name);
}

export async function createUtilityMeter(input: { code: string; name: string; multiplier: number; siteId?: number }) {
  const db = await dbOrThrow();
  const siteId = input.siteId ?? await getDefaultSiteId();
  const [result] = await db.insert(utilityMeters).values({ code: input.code, name: input.name, multiplier: String(input.multiplier), siteId });
  return { id: result.insertId };
}

export async function createMeterReading(input: { cycleId: number; meterId: number; previousReading: number; currentReading: number; multiplier: number; readAt: number; notes?: string; createdBy: number }) {
  const db = await dbOrThrow();
  const [cycle, meter] = await Promise.all([getCycleById(input.cycleId), db.select().from(utilityMeters).where(eq(utilityMeters.id, input.meterId)).limit(1).then(rows => rows[0])]);
  if (!cycle || !meter || cycle.siteId !== meter.siteId) throw new Error("يجب أن تنتمي الدورة والعداد إلى الموقع نفسه.");
  await db.insert(meterReadings).values({ billingCycleId: input.cycleId, utilityMeterId: input.meterId, previousReading: String(input.previousReading), currentReading: String(input.currentReading), multiplierSnapshot: String(input.multiplier), readAt: new Date(input.readAt), notes: input.notes, createdBy: input.createdBy }).onDuplicateKeyUpdate({ set: { previousReading: String(input.previousReading), currentReading: String(input.currentReading), multiplierSnapshot: String(input.multiplier), readAt: new Date(input.readAt), notes: input.notes, createdBy: input.createdBy } });
  await writeAudit({ actorUserId: input.createdBy, action: "upsert", entityType: "meterReading", entityId: input.cycleId, afterValue: input });
  return { success: true };
}

export async function upsertUtilityInvoice(input: { cycleId: number; invoiceNumber?: string; invoiceIssuedAt?: number; officialKwh?: number; officialAmount: number; adjustmentAmount?: number; notes?: string; createdBy: number }) {
  const db = await dbOrThrow();
  const value = { billingCycleId: input.cycleId, invoiceNumber: input.invoiceNumber, invoiceIssuedAt: input.invoiceIssuedAt ? new Date(input.invoiceIssuedAt) : null, officialKwh: input.officialKwh === undefined ? null : String(input.officialKwh), officialAmount: String(input.officialAmount), adjustmentAmount: String(input.adjustmentAmount ?? 0), notes: input.notes, createdBy: input.createdBy };
  await db.insert(utilityInvoices).values(value).onDuplicateKeyUpdate({ set: value });
  await writeAudit({ actorUserId: input.createdBy, action: "upsert", entityType: "utilityInvoice", entityId: input.cycleId, afterValue: input });
  return { success: true };
}

export async function previewUtilityInvoice(input: { cycleId: number; consumptionKwh: number }) {
  const db = await dbOrThrow();
  const cycle = await getCycleById(input.cycleId);
  if (!cycle) throw new Error("دورة الفوترة غير موجودة.");
  const versions = cycle.tariffVersionId
    ? await db.select().from(tariffVersions).where(eq(tariffVersions.id, cycle.tariffVersionId)).limit(1)
    : await db.select().from(tariffVersions).where(eq(tariffVersions.isActive, true)).orderBy(desc(tariffVersions.effectiveFrom)).limit(1);
  const tariffVersion = versions[0];
  if (!tariffVersion) throw new Error("اعتمد نسخة التعرفة اليمنية من الإعدادات قبل معاينة الفاتورة.");
  const brackets: TariffBracket[] = (await db.select().from(tariffBrackets).where(eq(tariffBrackets.tariffVersionId, tariffVersion.id)).orderBy(tariffBrackets.sequence)).map(row => ({ minKwh: asNumber(row.minKwh), maxKwh: row.maxKwh === null ? null : asNumber(row.maxKwh), unitRate: asNumber(row.unitRate) }));
  return { ...calculateWholeCycleUtilityCost(input.consumptionKwh, brackets), tariffVersionId: tariffVersion.id, tariffVersionName: tariffVersion.name };
}

export async function listGenerators(siteIds?: number[]) {
  const db = await dbOrThrow();
  if (siteIds && !siteIds.length) return [];
  if (siteIds) return db.select().from(generators).where(inArray(generators.siteId, siteIds)).orderBy(generators.name);
  return db.select().from(generators).orderBy(generators.name);
}

export async function createGenerator(input: { code: string; name: string; siteId?: number; ratedKva?: number; defaultPowerFactor?: number; acquisitionCost?: number; residualValue?: number; inServiceAt?: number; usefulLifeMonths?: number; usefulLifeHours?: number }) {
  const db = await dbOrThrow();
  const siteId = input.siteId ?? await getDefaultSiteId();
  const [result] = await db.insert(generators).values({ ...input, siteId, ratedKva: input.ratedKva === undefined ? null : String(input.ratedKva), defaultPowerFactor: input.defaultPowerFactor === undefined ? null : String(input.defaultPowerFactor), acquisitionCost: input.acquisitionCost === undefined ? null : String(input.acquisitionCost), residualValue: input.residualValue === undefined ? "0" : String(input.residualValue), inServiceAt: input.inServiceAt ? new Date(input.inServiceAt) : null, usefulLifeHours: input.usefulLifeHours === undefined ? null : String(input.usefulLifeHours) });
  return { id: result.insertId };
}

export async function updateGenerator(input: { id: number; code: string; name: string; ratedKva?: number; defaultPowerFactor?: number; acquisitionCost?: number; residualValue?: number; inServiceAt?: number; usefulLifeMonths?: number; usefulLifeHours?: number; actorUserId: number }) {
  const db = await dbOrThrow();
  const [before] = await db.select().from(generators).where(eq(generators.id, input.id)).limit(1);
  if (!before) throw new Error("المولد غير موجود.");
  const changes = { code: input.code, name: input.name, ratedKva: input.ratedKva === undefined ? null : String(input.ratedKva), defaultPowerFactor: input.defaultPowerFactor === undefined ? null : String(input.defaultPowerFactor), acquisitionCost: input.acquisitionCost === undefined ? null : String(input.acquisitionCost), residualValue: input.residualValue === undefined ? "0" : String(input.residualValue), inServiceAt: input.inServiceAt ? new Date(input.inServiceAt) : null, usefulLifeMonths: input.usefulLifeMonths ?? null, usefulLifeHours: input.usefulLifeHours === undefined ? null : String(input.usefulLifeHours) };
  await db.update(generators).set(changes).where(eq(generators.id, input.id));
  await writeAudit({ actorUserId: input.actorUserId, action: "update", entityType: "generator", entityId: input.id, beforeValue: before, afterValue: changes });
  return { success: true };
}

export async function createGeneratorRun(input: { cycleId: number; generatorId: number; startedAt: number; endedAt: number; runtimeHours: number; measurementMode: "kwh" | "kw" | "kva"; directKwh?: number; averageKw?: number; averageKva?: number; powerFactor?: number; qualityStatus: "measured" | "calculated" | "estimated"; notes?: string; createdBy: number }) {
  const db = await dbOrThrow();
  const [cycle, generator] = await Promise.all([getCycleById(input.cycleId), db.select().from(generators).where(eq(generators.id, input.generatorId)).limit(1).then(rows => rows[0])]);
  if (!cycle || !generator || cycle.siteId !== generator.siteId) throw new Error("يجب أن تنتمي الدورة والمولد إلى الموقع نفسه.");
  const [result] = await db.insert(generatorRuns).values({ billingCycleId: input.cycleId, generatorId: input.generatorId, startedAt: new Date(input.startedAt), endedAt: new Date(input.endedAt), runtimeHours: String(input.runtimeHours), measurementMode: input.measurementMode, directKwh: input.directKwh === undefined ? null : String(input.directKwh), averageKw: input.averageKw === undefined ? null : String(input.averageKw), averageKva: input.averageKva === undefined ? null : String(input.averageKva), powerFactor: input.powerFactor === undefined ? null : String(input.powerFactor), qualityStatus: input.qualityStatus, notes: input.notes, createdBy: input.createdBy });
  await writeAudit({ actorUserId: input.createdBy, action: "create", entityType: "generatorRun", entityId: result.insertId, afterValue: input });
  return { id: result.insertId };
}

export async function listGeneratorRuns(cycleId: number) {
  const db = await dbOrThrow();
  return db.select().from(generatorRuns).where(eq(generatorRuns.billingCycleId, cycleId)).orderBy(generatorRuns.startedAt);
}

export async function createFuelRecord(input: { cycleId: number; generatorId: number; transactionType: "refuel" | "consumption" | "adjustment"; quantityLiters: number; unitPrice: number; transactionAt: number; notes?: string; createdBy: number }) {
  const db = await dbOrThrow();
  const [cycle, generator] = await Promise.all([getCycleById(input.cycleId), db.select().from(generators).where(eq(generators.id, input.generatorId)).limit(1).then(rows => rows[0])]);
  if (!cycle || !generator || cycle.siteId !== generator.siteId) throw new Error("يجب أن تنتمي دورة الوقود والمولد إلى الموقع نفسه.");
  const [result] = await db.insert(fuelTransactions).values({ billingCycleId: input.cycleId, generatorId: input.generatorId, transactionType: input.transactionType, quantityLiters: String(input.quantityLiters), unitPrice: String(input.unitPrice), transactionAt: new Date(input.transactionAt), notes: input.notes, createdBy: input.createdBy });
  await writeAudit({ actorUserId: input.createdBy, action: "create", entityType: "fuelTransaction", entityId: result.insertId, afterValue: input });
  return { id: result.insertId };
}

export async function listFuelRecords(cycleId: number) {
  const db = await dbOrThrow();
  return db.select().from(fuelTransactions).where(eq(fuelTransactions.billingCycleId, cycleId)).orderBy(desc(fuelTransactions.transactionAt));
}

export async function updateFuelRecord(input: { id: number; cycleId: number; generatorId: number; transactionType: "refuel" | "consumption" | "adjustment"; quantityLiters: number; unitPrice: number; transactionAt: number; notes?: string; actorUserId: number }) {
  const db = await dbOrThrow();
  const [before] = await db.select().from(fuelTransactions).where(eq(fuelTransactions.id, input.id)).limit(1);
  if (!before) throw new Error("حركة الوقود غير موجودة.");
  const changes = { billingCycleId: input.cycleId, generatorId: input.generatorId, transactionType: input.transactionType, quantityLiters: String(input.quantityLiters), unitPrice: String(input.unitPrice), transactionAt: new Date(input.transactionAt), notes: input.notes };
  await db.update(fuelTransactions).set(changes).where(eq(fuelTransactions.id, input.id));
  await writeAudit({ actorUserId: input.actorUserId, action: "update", entityType: "fuelTransaction", entityId: input.id, beforeValue: before, afterValue: changes });
  return { success: true };
}

export async function createMaintenanceRecord(input: { cycleId?: number; generatorId: number; maintenanceType: string; performedAt: number; actualCost: number; expectedServiceHours?: number; notes?: string; createdBy: number }) {
  const db = await dbOrThrow();
  const [result] = await db.insert(maintenanceRecords).values({ billingCycleId: input.cycleId ?? null, generatorId: input.generatorId, maintenanceType: input.maintenanceType, performedAt: new Date(input.performedAt), actualCost: String(input.actualCost), expectedServiceHours: input.expectedServiceHours === undefined ? null : String(input.expectedServiceHours), notes: input.notes, createdBy: input.createdBy });
  await writeAudit({ actorUserId: input.createdBy, action: "create", entityType: "maintenance", entityId: result.insertId, afterValue: input });
  return { id: result.insertId };
}

export async function listTariffVersions() {
  const db = await dbOrThrow();
  return db.select().from(tariffVersions).orderBy(desc(tariffVersions.effectiveFrom));
}

export async function createTariffVersion(input: { name: string; pricingMode: "whole_cycle_rate" | "progressive"; effectiveFrom: number; reason: string; createdBy: number; brackets: { minKwh: number; maxKwh: number | null; unitRate: number }[] }) {
  const db = await dbOrThrow();
  const [version] = await db.insert(tariffVersions).values({ name: input.name, pricingMode: input.pricingMode, effectiveFrom: new Date(input.effectiveFrom), createdBy: input.createdBy });
  await db.insert(tariffBrackets).values(input.brackets.map((bracket, index) => ({ tariffVersionId: version.insertId, sequence: index + 1, minKwh: String(bracket.minKwh), maxKwh: bracket.maxKwh === null ? null : String(bracket.maxKwh), unitRate: String(bracket.unitRate) })));
  await writeAudit({ actorUserId: input.createdBy, action: "create", entityType: "tariffVersion", entityId: version.insertId, afterValue: input.brackets, reason: input.reason });
  return { id: version.insertId };
}

export async function saveSettingVersion(input: { settingGroup: string; settingKey: string; value: Record<string, unknown>; effectiveFrom: number; reason: string; createdBy: number }) {
  const db = await dbOrThrow();
  const [result] = await db.insert(settingsVersions).values({ settingGroup: input.settingGroup, settingKey: input.settingKey, value: input.value, effectiveFrom: new Date(input.effectiveFrom), changeReason: input.reason, createdBy: input.createdBy });
  await writeAudit({ actorUserId: input.createdBy, action: "create", entityType: "settingVersion", entityId: result.insertId, afterValue: input.value, reason: input.reason });
  return { id: result.insertId };
}

export async function listUsers() {
  const db = await dbOrThrow();
  return db.select({ id: users.id, name: users.name, email: users.email, role: users.role, isActive: users.isActive, createdAt: users.createdAt, lastSignedIn: users.lastSignedIn }).from(users).orderBy(users.name);
}

export async function createUserInvitation(input: { name: string; email: string; role: typeof users.$inferInsert.role; actorUserId: number }) {
  const db = await dbOrThrow();
  const email = input.email.trim().toLowerCase();
  const [existingUser] = await db.select({ id: users.id, isActive: users.isActive }).from(users).where(eq(users.email, email)).limit(1);
  if (existingUser) throw new Error(existingUser.isActive ? "يوجد مستخدم بهذا البريد بالفعل." : "يوجد حساب موقوف بهذا البريد؛ فعّله أو عدّل بياناته بدل إنشاء دعوة جديدة.");
  const [pending] = await db.select({ id: userInvitations.id }).from(userInvitations).where(and(eq(userInvitations.email, email), eq(userInvitations.status, "pending"))).limit(1);
  if (pending) throw new Error("توجد دعوة معلقة لهذا البريد بالفعل.");
  const [result] = await db.insert(userInvitations).values({ name: input.name.trim(), email, role: input.role ?? "user", invitedBy: input.actorUserId });
  await writeAudit({ actorUserId: input.actorUserId, action: "invite", entityType: "user_invitation", entityId: result.insertId, afterValue: { name: input.name.trim(), email, role: input.role } });
  return { id: result.insertId, success: true };
}

export async function updateUserProfile(input: { userId: number; name: string; email: string; actorUserId: number }) {
  const db = await dbOrThrow();
  const [before] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
  if (!before) throw new Error("المستخدم غير موجود.");
  const email = input.email.trim().toLowerCase();
  const [duplicate] = await db.select({ id: users.id }).from(users).where(and(eq(users.email, email), ne(users.id, input.userId))).limit(1);
  if (duplicate) throw new Error("البريد الإلكتروني مستخدم لحساب آخر.");
  const changes = { name: input.name.trim(), email };
  await db.update(users).set(changes).where(eq(users.id, input.userId));
  await writeAudit({ actorUserId: input.actorUserId, action: "update_profile", entityType: "user", entityId: input.userId, beforeValue: { name: before.name, email: before.email }, afterValue: changes });
  return { success: true };
}

export async function updateUserRole(input: { userId: number; role: typeof users.$inferInsert.role; actorUserId: number }) {
  const db = await dbOrThrow();
  const [before] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
  if (!before) throw new Error("المستخدم غير موجود.");
  const role = input.role ?? "management";
  await db.update(users).set({ role }).where(eq(users.id, input.userId));
  await writeAudit({ actorUserId: input.actorUserId, action: "update_role", entityType: "user", entityId: input.userId, beforeValue: { role: before.role }, afterValue: { role } });
  return { success: true };
}

export async function setUserActive(input: { userId: number; isActive: boolean; actorUserId: number }) {
  const db = await dbOrThrow();
  if (input.userId === input.actorUserId && !input.isActive) throw new Error("لا يمكن توقيف الحساب المستخدم حاليًا.");
  const [before] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
  if (!before) throw new Error("المستخدم غير موجود.");
  if (!input.isActive && before.role === "admin") {
    const [otherAdmin] = await db.select({ id: users.id }).from(users).where(and(eq(users.role, "admin"), eq(users.isActive, true), ne(users.id, input.userId))).limit(1);
    if (!otherAdmin) throw new Error("لا يمكن توقيف آخر مدير نظام نشط.");
  }
  await db.update(users).set({ isActive: input.isActive }).where(eq(users.id, input.userId));
  await writeAudit({ actorUserId: input.actorUserId, action: input.isActive ? "activate" : "deactivate", entityType: "user", entityId: input.userId, beforeValue: { isActive: before.isActive }, afterValue: { isActive: input.isActive } });
  return { success: true, isActive: input.isActive };
}

export async function archiveUser(input: { userId: number; actorUserId: number }) {
  const db = await dbOrThrow();
  if (input.userId === input.actorUserId) throw new Error("لا يمكن حذف الحساب الحالي.");
  const [before] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
  if (!before) throw new Error("المستخدم غير موجود.");
  if (before.role === "admin") {
    const [otherAdmin] = await db.select({ id: users.id }).from(users).where(and(eq(users.role, "admin"), eq(users.isActive, true), ne(users.id, input.userId))).limit(1);
    if (!otherAdmin) throw new Error("لا يمكن حذف آخر مدير نظام نشط.");
  }
  await db.update(users).set({ isActive: false }).where(eq(users.id, input.userId));
  await writeAudit({ actorUserId: input.actorUserId, action: "archive", entityType: "user", entityId: input.userId, beforeValue: { isActive: before.isActive, role: before.role }, afterValue: { isActive: false } });
  return { success: true };
}

export async function listPermissionGrants() {
  const db = await dbOrThrow();
  return db
    .select({
      userId: userPermissions.userId,
      userName: users.name,
      section: userPermissions.section,
      resource: userPermissions.resource,
      action: userPermissions.action,
      effect: userPermissions.effect,
      updatedAt: userPermissions.updatedAt,
    })
    .from(userPermissions)
    .innerJoin(users, eq(userPermissions.userId, users.id))
    .orderBy(userPermissions.userId, userPermissions.section, userPermissions.resource, userPermissions.action);
}

export async function replaceUserPermissions(input: {
  userId: number;
  permissions: Array<{ section: (typeof platformSections)[number]; resource: string; action: (typeof permissionActions)[number]; effect: (typeof permissionEffects)[number] }>;

  actorUserId: number;
}) {
  const db = await dbOrThrow();
  const uniquePermissions = Array.from(
    new Map(input.permissions.map(permission => [`${permission.section}:${permission.resource}:${permission.action}`, permission])).values(),
  );
  return db.transaction(async tx => {
    const [targetUser] = await tx.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, input.userId)).limit(1);
    if (!targetUser) throw new Error("المستخدم غير موجود.");
    const before = await tx.select({ section: userPermissions.section, resource: userPermissions.resource, action: userPermissions.action, effect: userPermissions.effect }).from(userPermissions).where(eq(userPermissions.userId, input.userId));
    await tx.delete(userPermissions).where(eq(userPermissions.userId, input.userId));
    if (uniquePermissions.length) {
      await tx.insert(userPermissions).values(uniquePermissions.map(permission => ({ ...permission, userId: input.userId, grantedBy: input.actorUserId })));
    }
    await tx.insert(auditLogs).values({
      actorUserId: input.actorUserId,
      action: "replace_permissions",
      entityType: "user_permissions",
      entityId: input.userId,
      beforeValue: { permissions: before },
      afterValue: { permissions: uniquePermissions, userName: targetUser.name },
    });
    return { success: true, permissions: uniquePermissions };
  });
}

export async function getUserPermissionOverride(input: { userId: number; section: (typeof platformSections)[number]; resource: string; action: (typeof permissionActions)[number] }) {
  const db = await dbOrThrow();
  const [permission] = await db.select({ effect: userPermissions.effect }).from(userPermissions).where(and(
    eq(userPermissions.userId, input.userId),
    eq(userPermissions.section, input.section),
    eq(userPermissions.resource, input.resource),
    eq(userPermissions.action, input.action),
  )).limit(1);
  return permission?.effect ?? null;
}

export async function listFuelRoleGrants() {
  const db = await dbOrThrow();
  return db
    .select({ userId: sectionRoleGrants.userId, role: sectionRoleGrants.role, createdAt: sectionRoleGrants.createdAt })
    .from(sectionRoleGrants)
    .where(eq(sectionRoleGrants.section, "fuel"))
    .orderBy(sectionRoleGrants.userId, sectionRoleGrants.role);
}

export async function replaceFuelRoleGrants(input: { userId: number; roles: Array<(typeof fuelSectionRoles)[number]>; actorUserId: number }) {
  const db = await dbOrThrow();
  const uniqueRoles = Array.from(new Set(input.roles)).sort();
  return db.transaction(async tx => {
    const [targetUser] = await tx.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, input.userId)).limit(1);
    if (!targetUser) throw new Error("المستخدم غير موجود.");
    const before = await tx
      .select({ role: sectionRoleGrants.role })
      .from(sectionRoleGrants)
      .where(and(eq(sectionRoleGrants.userId, input.userId), eq(sectionRoleGrants.section, "fuel")));
    await tx.delete(sectionRoleGrants).where(and(eq(sectionRoleGrants.userId, input.userId), eq(sectionRoleGrants.section, "fuel")));
    if (uniqueRoles.length) {
      await tx.insert(sectionRoleGrants).values(uniqueRoles.map(role => ({ userId: input.userId, section: "fuel" as const, role, grantedBy: input.actorUserId })));
    }
    await tx.insert(auditLogs).values({
      actorUserId: input.actorUserId,
      action: "replace_roles",
      entityType: "fuel_role_grants",
      entityId: input.userId,
      beforeValue: { roles: before.map(grant => grant.role) },
      afterValue: { roles: uniqueRoles, section: "fuel", userName: targetUser.name },
    });
    return { success: true, roles: uniqueRoles };
  });
}

export async function listFuelRoleAuditLogs(limit = 50) {
  const db = await dbOrThrow();
  return db
    .select({
      id: auditLogs.id,
      actorUserId: auditLogs.actorUserId,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      beforeValue: auditLogs.beforeValue,
      afterValue: auditLogs.afterValue,
      reason: auditLogs.reason,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .where(and(eq(auditLogs.entityType, "fuel_role_grants"), eq(auditLogs.action, "replace_roles")))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}

export async function createAttachment(input: { entityType: string; entityId: number; originalName: string; storageKey: string; mimeType: string; sizeBytes: number; uploadedBy: number }) {
  const db = await dbOrThrow();
  const [result] = await db.insert(attachments).values(input);
  await writeAudit({ actorUserId: input.uploadedBy, action: "upload", entityType: "attachment", entityId: result.insertId, afterValue: { entityType: input.entityType, entityId: input.entityId, originalName: input.originalName, sizeBytes: input.sizeBytes } });
  return { id: result.insertId };
}

export async function listAttachments(entityType: string, entityId: number) {
  const db = await dbOrThrow();
  return db.select({ id: attachments.id, entityType: attachments.entityType, entityId: attachments.entityId, originalName: attachments.originalName, mimeType: attachments.mimeType, sizeBytes: attachments.sizeBytes, uploadedBy: attachments.uploadedBy, createdAt: attachments.createdAt }).from(attachments).where(and(eq(attachments.entityType, entityType), eq(attachments.entityId, entityId))).orderBy(desc(attachments.createdAt));
}

export async function getAttachmentById(id: number) {
  const db = await dbOrThrow();
  const [attachment] = await db.select().from(attachments).where(eq(attachments.id, id)).limit(1);
  return attachment;
}

export async function recordAttachmentAccess(input: { attachmentId: number; actorUserId: number }) {
  await writeAudit({ actorUserId: input.actorUserId, action: "access", entityType: "attachment", entityId: input.attachmentId });
}

export async function getDashboardData(siteIds?: number[]) {
  const db = await dbOrThrow();
  if (siteIds && !siteIds.length) return { summary: { utilityKwh: 0, utilityAmount: 0, generatorKwh: 0, generatorAmount: 0, savings: 0, utilityRate: 0, generatorRate: 0, cheaperSource: null as string | null }, trends: [], cycles: [] };
  const cycles = siteIds
    ? await db.select().from(billingCycles).where(inArray(billingCycles.siteId, siteIds)).orderBy(desc(billingCycles.periodStart)).limit(12)
    : await db.select().from(billingCycles).orderBy(desc(billingCycles.periodStart)).limit(12);
  if (!cycles.length) return { summary: { utilityKwh: 0, utilityAmount: 0, generatorKwh: 0, generatorAmount: 0, savings: 0, utilityRate: 0, generatorRate: 0, cheaperSource: null as string | null }, trends: [], cycles: [] };
  const ids = cycles.map(cycle => cycle.id);
  const [readings, invoices, runs, fuels] = await Promise.all([
    db.select().from(meterReadings).where(inArray(meterReadings.billingCycleId, ids)),
    db.select().from(utilityInvoices).where(inArray(utilityInvoices.billingCycleId, ids)),
    db.select().from(generatorRuns).where(inArray(generatorRuns.billingCycleId, ids)),
    db.select().from(fuelTransactions).where(inArray(fuelTransactions.billingCycleId, ids)),
  ]);
  const calculateCycle = (cycleId: number) => {
    const utilityKwh = readings.filter(item => item.billingCycleId === cycleId).reduce((sum, item) => sum + (asNumber(item.currentReading) - asNumber(item.previousReading)) * asNumber(item.multiplierSnapshot), 0);
    const invoice = invoices.find(item => item.billingCycleId === cycleId);
    const generatorKwh = runs.filter(item => item.billingCycleId === cycleId).reduce((sum, item) => {
      try { return sum + deriveGeneratorKwh({ measurementMode: item.measurementMode, directKwh: asNumber(item.directKwh), averageKw: asNumber(item.averageKw), averageKva: asNumber(item.averageKva), runtimeHours: asNumber(item.runtimeHours), powerFactor: asNumber(item.powerFactor) || undefined }); } catch { return sum; }
    }, 0);
    const generatorAmount = fuels.filter(item => item.billingCycleId === cycleId && item.transactionType !== "adjustment").reduce((sum, item) => sum + asNumber(item.quantityLiters) * asNumber(item.unitPrice), 0);
    return { utilityKwh, utilityAmount: asNumber(invoice?.officialAmount), generatorKwh, generatorAmount };
  };
  const cycleData = cycles.map(cycle => ({ ...cycle, ...calculateCycle(cycle.id) }));
  const totals = cycleData.reduce((acc, item) => ({ utilityKwh: acc.utilityKwh + item.utilityKwh, utilityAmount: acc.utilityAmount + item.utilityAmount, generatorKwh: acc.generatorKwh + item.generatorKwh, generatorAmount: acc.generatorAmount + item.generatorAmount }), { utilityKwh: 0, utilityAmount: 0, generatorKwh: 0, generatorAmount: 0 });
  const savings = totals.utilityAmount - totals.generatorAmount;
  const utilityRate = totals.utilityKwh ? totals.utilityAmount / totals.utilityKwh : 0;
  const generatorRate = totals.generatorKwh ? totals.generatorAmount / totals.generatorKwh : 0;
  return {
    summary: { ...totals, savings, utilityRate, generatorRate, cheaperSource: utilityRate && generatorRate ? utilityRate <= generatorRate ? "المؤسسة" : "المولدات" : null },
    trends: [...cycleData].reverse().map(item => ({ label: item.title, المؤسسة: item.utilityAmount, المولدات: item.generatorAmount })),
    cycles: cycleData,
  };
}

export async function getReportRecommendations(siteIds?: number[]) {
  const cycles = await listBillingCycles(siteIds);
  return Promise.all(
    cycles.map(async cycle => {
      const analysis = await getCycleAnalysis(cycle.id);
      const recommendation = recommendEnergySource({
        utilityKwh: analysis.utility.meterKwh,
        utilityAmount: analysis.utility.officialAmount,
        generatorKwh: analysis.generators.kwh,
        generatorAmount: analysis.generators.selectedCost,
      });
      return {
        id: cycle.id,
        title: cycle.title,
        cycleStatus: cycle.status,
        periodStart: cycle.periodStart,
        periodEnd: cycle.periodEnd,
        utilityKwh: analysis.utility.meterKwh,
        utilityAmount: analysis.utility.officialAmount,
        generatorKwh: analysis.generators.kwh,
        generatorAmount: analysis.generators.selectedCost,
        costModel: cycle.selectedCostModel,
        ...recommendation,
      };
    }),
  );
}

export async function getCycleAnalysis(cycleId: number) {
  const db = await dbOrThrow();
  const cycle = await getCycleById(cycleId);
  if (!cycle) throw new Error("دورة الفوترة غير موجودة.");
  const [readings, invoiceRows, runs, fuels, maintenance, versionRows] = await Promise.all([
    db.select().from(meterReadings).where(eq(meterReadings.billingCycleId, cycleId)),
    db.select().from(utilityInvoices).where(eq(utilityInvoices.billingCycleId, cycleId)),
    db.select().from(generatorRuns).where(eq(generatorRuns.billingCycleId, cycleId)),
    db.select().from(fuelTransactions).where(eq(fuelTransactions.billingCycleId, cycleId)),
    db.select().from(maintenanceRecords).where(eq(maintenanceRecords.billingCycleId, cycleId)),
    cycle.tariffVersionId ? db.select().from(tariffVersions).where(eq(tariffVersions.id, cycle.tariffVersionId)).limit(1) : db.select().from(tariffVersions).where(eq(tariffVersions.isActive, true)).orderBy(desc(tariffVersions.effectiveFrom)).limit(1),
  ]);
  const meterKwh = readings.reduce((sum, item) => sum + (asNumber(item.currentReading) - asNumber(item.previousReading)) * asNumber(item.multiplierSnapshot), 0);
  const tariffVersion = versionRows[0];
  const brackets: TariffBracket[] = tariffVersion ? (await db.select().from(tariffBrackets).where(eq(tariffBrackets.tariffVersionId, tariffVersion.id)).orderBy(tariffBrackets.sequence)).map(row => ({ minKwh: asNumber(row.minKwh), maxKwh: row.maxKwh === null ? null : asNumber(row.maxKwh), unitRate: asNumber(row.unitRate) })) : [];
  const utilityCalculation = brackets.length ? calculateWholeCycleUtilityCost(meterKwh, brackets) : null;
  const invoice = invoiceRows[0];
  const generatorIds = Array.from(new Set(runs.map(run => run.generatorId)));
  const usedGenerators = generatorIds.length ? await db.select().from(generators).where(inArray(generators.id, generatorIds)) : [];
  const generatorById = new Map(usedGenerators.map(generator => [generator.id, generator]));
  const totalGeneratorKwh = runs.reduce((sum, run) => {
    try {
      return sum + deriveGeneratorKwh({ measurementMode: run.measurementMode, directKwh: run.directKwh === null ? undefined : asNumber(run.directKwh), averageKw: run.averageKw === null ? undefined : asNumber(run.averageKw), averageKva: run.averageKva === null ? undefined : asNumber(run.averageKva), runtimeHours: asNumber(run.runtimeHours), powerFactor: run.powerFactor === null ? undefined : asNumber(run.powerFactor) });
    } catch {
      return sum;
    }
  }, 0);
  const fuelCost = fuels.filter(item => item.transactionType !== "adjustment").reduce((sum, item) => sum + asNumber(item.quantityLiters) * asNumber(item.unitPrice), 0);
  const runtimeByGenerator = new Map<number, number>();
  runs.forEach(run => runtimeByGenerator.set(run.generatorId, (runtimeByGenerator.get(run.generatorId) ?? 0) + asNumber(run.runtimeHours)));
  const accountingDepreciation = Array.from(runtimeByGenerator.entries()).reduce((sum, [generatorId]) => {
    const generator = generatorById.get(generatorId);
    if (!generator?.acquisitionCost || !generator.usefulLifeMonths) return sum;
    return sum + calculateAccountingDepreciation({ acquisitionCost: asNumber(generator.acquisitionCost), residualValue: asNumber(generator.residualValue), usefulLifeMonths: generator.usefulLifeMonths, monthsInCycle: 0.5 });
  }, 0);
  const operationalDepreciation = Array.from(runtimeByGenerator.entries()).reduce((sum, [generatorId, runtimeHours]) => {
    const generator = generatorById.get(generatorId);
    if (!generator?.acquisitionCost || !generator.usefulLifeHours) return sum;
    return sum + calculateOperationalDepreciation({ acquisitionCost: asNumber(generator.acquisitionCost), residualValue: asNumber(generator.residualValue), usefulLifeHours: asNumber(generator.usefulLifeHours), runtimeHours });
  }, 0);
  const actualMaintenance = maintenance.reduce((sum, item) => sum + asNumber(item.actualCost), 0);
  const allocatedMaintenance = maintenance.reduce((sum, item) => {
    const runtimeHours = runtimeByGenerator.get(item.generatorId) ?? 0;
    return sum + (item.expectedServiceHours ? calculateAllocatedMaintenance(asNumber(item.actualCost), asNumber(item.expectedServiceHours), runtimeHours) : 0);
  }, 0);
  const selectedDepreciation = cycle.depreciationMode === "accounting" ? accountingDepreciation : operationalDepreciation;
  const selectedMaintenance = cycle.maintenanceMode === "actual" ? actualMaintenance : allocatedMaintenance;
  const generatorCashCost = fuelCost + selectedMaintenance;
  const generatorFullCost = generatorCashCost + selectedDepreciation;
  const selectedGeneratorCost = cycle.selectedCostModel === "full" ? generatorFullCost : generatorCashCost;
  const officialAmount = asNumber(invoice?.officialAmount);
  const analyticalAmount = utilityCalculation?.analyticalAmount ?? 0;
  return {
    cycle,
    utility: { meterKwh, tariffVersionName: tariffVersion?.name ?? null, unitRate: utilityCalculation?.unitRate ?? null, analyticalAmount, officialAmount, reconciliationDifference: officialAmount - analyticalAmount, reconciliationStatus: invoice ? Math.abs(officialAmount - analyticalAmount) < 1 ? "matched" : "difference" : "missing_invoice" },
    generators: { kwh: totalGeneratorKwh, fuelCost, actualMaintenance, allocatedMaintenance, accountingDepreciation, operationalDepreciation, cashCost: generatorCashCost, fullCost: generatorFullCost, selectedCost: selectedGeneratorCost, costPerKwh: totalGeneratorKwh ? selectedGeneratorCost / totalGeneratorKwh : null },
    comparison: { utilityCostPerKwh: meterKwh ? officialAmount / meterKwh : null, generatorCostPerKwh: totalGeneratorKwh ? selectedGeneratorCost / totalGeneratorKwh : null, cheaperSource: meterKwh && totalGeneratorKwh ? officialAmount / meterKwh <= selectedGeneratorCost / totalGeneratorKwh ? "المؤسسة" : "المولدات" : null },
  };
}

export type Attachment = typeof attachments.$inferSelect;

export async function listFuelProducts() {
  const db = await dbOrThrow();
  return db.select().from(fuelProducts).orderBy(fuelProducts.name);
}

export async function listFuelSuppliers() {
  const db = await dbOrThrow();
  return db.select().from(fuelSuppliers).orderBy(fuelSuppliers.name);
}

export async function createFuelProduct(input: {
  code: string;
  name: string;
  fuelType: "diesel" | "petrol" | "kerosene" | "other";
  tankCapacity: number;
  literPerCm: number;
  expansionCoefficient: number;
  referenceTemp: number;
  openingBalance: number;
  openingDate?: number | null;
  lastMeterReading: number;
  notes?: string | null;
  actorUserId: number;
}) {
  if (!input.code.trim() || !input.name.trim()) throw new Error("رمز الصنف واسمه مطلوبان.");
  if (input.tankCapacity <= 0 || input.openingBalance < 0 || input.lastMeterReading < 0) throw new Error("قيم الخزان أو الرصيد أو قراءة العداد غير صالحة.");
  if (input.openingBalance > input.tankCapacity) throw new Error("الرصيد الافتتاحي لا يمكن أن يتجاوز سعة الخزان.");
  const db = await dbOrThrow();
  const values = {
    code: input.code.trim(), name: input.name.trim(), fuelType: input.fuelType, tankCapacity: String(input.tankCapacity),
    literPerCm: String(input.literPerCm), expansionCoefficient: String(input.expansionCoefficient), referenceTemp: String(input.referenceTemp),
    openingBalance: String(input.openingBalance), openingDate: input.openingDate ? new Date(input.openingDate) : null,
    lastMeterReading: String(input.lastMeterReading), notes: input.notes?.trim() || null, createdBy: input.actorUserId,
  };
  const [result] = await db.insert(fuelProducts).values(values);
  await writeAudit({ actorUserId: input.actorUserId, action: "create", entityType: "fuel.product", entityId: result.insertId, afterValue: values });
  return { id: result.insertId };
}

export async function createFuelSupplier(input: { name: string; contactName?: string | null; phone?: string | null; notes?: string | null; actorUserId: number }) {
  if (!input.name.trim()) throw new Error("اسم المورد مطلوب.");
  const db = await dbOrThrow();
  const values = { name: input.name.trim(), contactName: input.contactName?.trim() || null, phone: input.phone?.trim() || null, notes: input.notes?.trim() || null, createdBy: input.actorUserId };
  const [result] = await db.insert(fuelSuppliers).values(values);
  await writeAudit({ actorUserId: input.actorUserId, action: "create", entityType: "fuel.supplier", entityId: result.insertId, afterValue: values });
  return { id: result.insertId };
}

async function selectFuelProductOrThrow(productId: number) {
  const db = await dbOrThrow();
  const [product] = await db.select().from(fuelProducts).where(eq(fuelProducts.id, productId)).limit(1);
  if (!product) throw new Error("صنف الوقود غير موجود.");
  if (!product.isActive) throw new Error("صنف الوقود غير نشط ولا يقبل حركات جديدة.");
  return product;
}

export async function getFuelStockSnapshot(productId: number) {
  const db = await dbOrThrow();
  const product = await selectFuelProductOrThrow(productId);
  const [receipts, issues, waste] = await Promise.all([
    db.select().from(fuelReceipts).where(eq(fuelReceipts.productId, productId)),
    db.select().from(fuelIssues).where(eq(fuelIssues.productId, productId)),
    db.select().from(fuelWasteRecords).where(eq(fuelWasteRecords.productId, productId)),
  ]);
  const totalReceipts = receipts.reduce((sum, item) => sum + asNumber(item.correctedQuantity), 0);
  const totalIssues = issues.reduce((sum, item) => sum + asNumber(item.correctedQuantity), 0);
  const totalWaste = waste.reduce((sum, item) => sum + asNumber(item.quantity), 0);
  return {
    product,
    totalReceipts,
    totalIssues,
    totalWaste,
    availableBalance: calculateFuelBalance({ openingBalance: asNumber(product.openingBalance), receipts: totalReceipts, issues: totalIssues, waste: totalWaste }),
  };
}

export async function createFuelReceipt(input: {
  productId: number; supplierId?: number | null; invoiceNumber?: string | null; receivedAt: number;
  quantityFromTruck: number; quantityFromGauge: number; temperature: number; pricePerLiter: number; notes?: string | null; actorUserId: number;
}) {
  if (input.quantityFromTruck <= 0 || input.quantityFromGauge <= 0 || input.pricePerLiter < 0) throw new Error("كميات التوريد وسعر اللتر يجب أن تكون صالحة.");
  const db = await dbOrThrow();
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT id FROM fuelProducts WHERE id = ${input.productId} FOR UPDATE`);
    const [product] = await tx.select().from(fuelProducts).where(eq(fuelProducts.id, input.productId)).limit(1);
    if (!product?.isActive) throw new Error("صنف الوقود غير موجود أو غير نشط.");
    const correctedQuantity = calculateCorrectedFuelQuantity({ quantity: input.quantityFromGauge, temperature: input.temperature, expansionCoefficient: asNumber(product.expansionCoefficient), referenceTemp: asNumber(product.referenceTemp) });
    const [receipts, issues, waste] = await Promise.all([
      tx.select().from(fuelReceipts).where(eq(fuelReceipts.productId, input.productId)),
      tx.select().from(fuelIssues).where(eq(fuelIssues.productId, input.productId)),
      tx.select().from(fuelWasteRecords).where(eq(fuelWasteRecords.productId, input.productId)),
    ]);
    const availableBalance = calculateFuelBalance({ openingBalance: asNumber(product.openingBalance), receipts: receipts.reduce((sum, item) => sum + asNumber(item.correctedQuantity), 0), issues: issues.reduce((sum, item) => sum + asNumber(item.correctedQuantity), 0), waste: waste.reduce((sum, item) => sum + asNumber(item.quantity), 0) });
    assertFuelCapacity(availableBalance, correctedQuantity, asNumber(product.tankCapacity));
    const totalAmount = Math.round(correctedQuantity * input.pricePerLiter * 100) / 100;
    const values = {
      productId: input.productId, supplierId: input.supplierId ?? null, invoiceNumber: input.invoiceNumber?.trim() || null,
      receivedAt: new Date(input.receivedAt), quantityFromTruck: String(input.quantityFromTruck), quantityFromGauge: String(input.quantityFromGauge),
      temperature: String(input.temperature), correctedQuantity: String(correctedQuantity), pricePerLiter: String(input.pricePerLiter), totalAmount: String(totalAmount),
      notes: input.notes?.trim() || null, createdBy: input.actorUserId,
    };
    const [result] = await tx.insert(fuelReceipts).values(values);
    await tx.insert(auditLogs).values({ actorUserId: input.actorUserId, action: "create", entityType: "fuel.receipt", entityId: result.insertId, afterValue: values as object });
    return { id: result.insertId, correctedQuantity, totalAmount, balanceAfter: Math.round((availableBalance + correctedQuantity) * 1000) / 1000 };
  });
}

export async function createFuelIssue(input: {
  productId: number; issuedAt: number; currentReading: number; temperature: number; issuedTo: string; vehicleNumber?: string | null; notes?: string | null; actorUserId: number;
}) {
  if (!input.issuedTo.trim()) throw new Error("الجهة المستلمة مطلوبة.");
  const db = await dbOrThrow();
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT id FROM fuelProducts WHERE id = ${input.productId} FOR UPDATE`);
    const [product] = await tx.select().from(fuelProducts).where(eq(fuelProducts.id, input.productId)).limit(1);
    if (!product) throw new Error("صنف الوقود غير موجود.");
    if (!product.isActive) throw new Error("صنف الوقود غير نشط ولا يقبل الصرف.");
    const previousReading = asNumber(product.lastMeterReading);
    const quantityIssued = calculateFuelIssueQuantity({ previousReading, currentReading: input.currentReading });
    const correctedQuantity = calculateCorrectedFuelQuantity({ quantity: quantityIssued, temperature: input.temperature, expansionCoefficient: asNumber(product.expansionCoefficient), referenceTemp: asNumber(product.referenceTemp) });
    const [receipts, issues, waste] = await Promise.all([
      tx.select().from(fuelReceipts).where(eq(fuelReceipts.productId, input.productId)),
      tx.select().from(fuelIssues).where(eq(fuelIssues.productId, input.productId)),
      tx.select().from(fuelWasteRecords).where(eq(fuelWasteRecords.productId, input.productId)),
    ]);
    const availableBalance = calculateFuelBalance({
      openingBalance: asNumber(product.openingBalance),
      receipts: receipts.reduce((sum, item) => sum + asNumber(item.correctedQuantity), 0),
      issues: issues.reduce((sum, item) => sum + asNumber(item.correctedQuantity), 0),
      waste: waste.reduce((sum, item) => sum + asNumber(item.quantity), 0),
    });
    assertFuelAvailable(correctedQuantity, availableBalance, "الصرف");
    const values = {
      productId: input.productId, issuedAt: new Date(input.issuedAt), previousReading: String(previousReading), currentReading: String(input.currentReading),
      quantityIssued: String(quantityIssued), temperature: String(input.temperature), correctedQuantity: String(correctedQuantity), issuedTo: input.issuedTo.trim(),
      vehicleNumber: input.vehicleNumber?.trim() || null, notes: input.notes?.trim() || null, createdBy: input.actorUserId,
    };
    const [result] = await tx.insert(fuelIssues).values(values);
    await tx.update(fuelProducts).set({ lastMeterReading: String(input.currentReading) }).where(eq(fuelProducts.id, input.productId));
    await tx.insert(auditLogs).values({ actorUserId: input.actorUserId, action: "create", entityType: "fuel.issue", entityId: result.insertId, afterValue: values as object });
    return { id: result.insertId, previousReading, quantityIssued, correctedQuantity, balanceAfter: Math.round((availableBalance - correctedQuantity) * 1000) / 1000 };
  });
}

export async function createFuelWasteRecord(input: { productId: number; occurredAt: number; quantity: number; reason: string; notes?: string | null; actorUserId: number }) {
  if (input.quantity <= 0 || !input.reason.trim()) throw new Error("كمية الهدر وسببه مطلوبان.");
  const db = await dbOrThrow();
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT id FROM fuelProducts WHERE id = ${input.productId} FOR UPDATE`);
    const [product] = await tx.select().from(fuelProducts).where(eq(fuelProducts.id, input.productId)).limit(1);
    if (!product?.isActive) throw new Error("صنف الوقود غير موجود أو غير نشط.");
    const [receipts, issues, waste] = await Promise.all([
      tx.select().from(fuelReceipts).where(eq(fuelReceipts.productId, input.productId)),
      tx.select().from(fuelIssues).where(eq(fuelIssues.productId, input.productId)),
      tx.select().from(fuelWasteRecords).where(eq(fuelWasteRecords.productId, input.productId)),
    ]);
    const availableBalance = calculateFuelBalance({ openingBalance: asNumber(product.openingBalance), receipts: receipts.reduce((sum, item) => sum + asNumber(item.correctedQuantity), 0), issues: issues.reduce((sum, item) => sum + asNumber(item.correctedQuantity), 0), waste: waste.reduce((sum, item) => sum + asNumber(item.quantity), 0) });
    assertFuelAvailable(input.quantity, availableBalance, "الهدر");
    const values = { productId: input.productId, occurredAt: new Date(input.occurredAt), quantity: String(input.quantity), reason: input.reason.trim(), notes: input.notes?.trim() || null, createdBy: input.actorUserId };
    const [result] = await tx.insert(fuelWasteRecords).values(values);
    await tx.insert(auditLogs).values({ actorUserId: input.actorUserId, action: "create", entityType: "fuel.waste", entityId: result.insertId, afterValue: values as object });
    return { id: result.insertId, balanceAfter: Math.round((availableBalance - input.quantity) * 1000) / 1000 };
  });
}

export async function getFuelDashboard() {
  const db = await dbOrThrow();
  const [products, suppliers, receipts, issues, waste, closures] = await Promise.all([
    db.select().from(fuelProducts).orderBy(fuelProducts.name), db.select().from(fuelSuppliers).orderBy(fuelSuppliers.name),
    db.select().from(fuelReceipts).orderBy(desc(fuelReceipts.receivedAt)), db.select().from(fuelIssues).orderBy(desc(fuelIssues.issuedAt)),
    db.select().from(fuelWasteRecords).orderBy(desc(fuelWasteRecords.occurredAt)), db.select().from(fuelInventoryClosures).orderBy(desc(fuelInventoryClosures.year), desc(fuelInventoryClosures.month)),
  ]);
  const productRows = products.map(product => {
    const productReceipts = receipts.filter(item => item.productId === product.id).reduce((sum, item) => sum + asNumber(item.correctedQuantity), 0);
    const productIssues = issues.filter(item => item.productId === product.id).reduce((sum, item) => sum + asNumber(item.correctedQuantity), 0);
    const productWaste = waste.filter(item => item.productId === product.id).reduce((sum, item) => sum + asNumber(item.quantity), 0);
    return { ...product, totalReceipts: productReceipts, totalIssues: productIssues, totalWaste: productWaste, availableBalance: calculateFuelBalance({ openingBalance: asNumber(product.openingBalance), receipts: productReceipts, issues: productIssues, waste: productWaste }) };
  });
  return { products: productRows, suppliers, receipts, issues, waste, closures, summary: { productCount: products.length, totalAvailable: productRows.reduce((sum, item) => sum + item.availableBalance, 0), receiptCount: receipts.length, issueCount: issues.length, wasteQuantity: waste.reduce((sum, item) => sum + asNumber(item.quantity), 0) } };
}

function fuelRecordInMonth(value: Date | string, year: number, month: number) {
  const date = new Date(value);
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month;
}

export async function createFuelInventoryClosure(input: {
  productId: number; month: number; year: number; meterReadingStart: number; meterReadingEnd: number; gaugeReadingCm: number; notes?: string | null; actorUserId: number;
}) {
  if (input.month < 1 || input.month > 12 || input.year < 2000 || input.year > 2200) throw new Error("فترة الجرد غير صالحة.");
  if (input.meterReadingStart < 0 || input.meterReadingEnd < input.meterReadingStart || input.gaugeReadingCm < 0) throw new Error("قراءات العداد أو المعيار غير صالحة.");
  const db = await dbOrThrow();
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT id FROM fuelProducts WHERE id = ${input.productId} FOR UPDATE`);
    const [product] = await tx.select().from(fuelProducts).where(eq(fuelProducts.id, input.productId)).limit(1);
    if (!product) throw new Error("صنف الوقود غير موجود.");
    const [existing] = await tx.select().from(fuelInventoryClosures).where(and(eq(fuelInventoryClosures.productId, input.productId), eq(fuelInventoryClosures.year, input.year), eq(fuelInventoryClosures.month, input.month))).limit(1);
    if (existing) throw new Error("يوجد جرد مسجل لهذا الصنف والفترة.");
    const [receipts, issues, waste, priorClosures] = await Promise.all([
      tx.select().from(fuelReceipts).where(eq(fuelReceipts.productId, input.productId)),
      tx.select().from(fuelIssues).where(eq(fuelIssues.productId, input.productId)),
      tx.select().from(fuelWasteRecords).where(eq(fuelWasteRecords.productId, input.productId)),
      tx.select().from(fuelInventoryClosures).where(eq(fuelInventoryClosures.productId, input.productId)),
    ]);
    const prior = priorClosures.filter(item => item.year < input.year || (item.year === input.year && item.month < input.month)).sort((left, right) => right.year - left.year || right.month - left.month)[0];
    const openingBalance = prior ? asNumber(prior.bookBalance) : asNumber(product.openingBalance);
    const totalReceipts = receipts.filter(item => fuelRecordInMonth(item.receivedAt, input.year, input.month)).reduce((sum, item) => sum + asNumber(item.correctedQuantity), 0);
    const totalIssues = issues.filter(item => fuelRecordInMonth(item.issuedAt, input.year, input.month)).reduce((sum, item) => sum + asNumber(item.correctedQuantity), 0);
    const totalWaste = waste.filter(item => fuelRecordInMonth(item.occurredAt, input.year, input.month)).reduce((sum, item) => sum + asNumber(item.quantity), 0);
    const bookBalance = calculateFuelBalance({ openingBalance, receipts: totalReceipts, issues: totalIssues, waste: totalWaste });
    const quantityIssuedByMeter = calculateFuelIssueQuantity({ previousReading: input.meterReadingStart, currentReading: input.meterReadingEnd });
    const physicalBalance = Math.round(input.gaugeReadingCm * asNumber(product.literPerCm) * 1000) / 1000;
    const difference = Math.round((physicalBalance - bookBalance) * 1000) / 1000;
    const values = {
      productId: input.productId, month: input.month, year: input.year, openingBalance: String(openingBalance), totalReceipts: String(totalReceipts), totalIssues: String(totalIssues), totalWaste: String(totalWaste),
      bookBalance: String(bookBalance), meterReadingStart: String(input.meterReadingStart), meterReadingEnd: String(input.meterReadingEnd), quantityIssuedByMeter: String(quantityIssuedByMeter), gaugeReadingCm: String(input.gaugeReadingCm),
      physicalBalance: String(physicalBalance), difference: String(difference), resultType: classifyFuelVariance(difference), notes: input.notes?.trim() || null, createdBy: input.actorUserId,
    };
    const [result] = await tx.insert(fuelInventoryClosures).values(values);
    await tx.insert(auditLogs).values({ actorUserId: input.actorUserId, action: "create", entityType: "fuel.inventory", entityId: result.insertId, afterValue: values as object });
    return { id: result.insertId, bookBalance, physicalBalance, difference, resultType: values.resultType };
  });
}

export async function approveFuelInventoryClosure(input: { closureId: number; actorUserId: number }) {
  const db = await dbOrThrow();
  const [before] = await db.select().from(fuelInventoryClosures).where(eq(fuelInventoryClosures.id, input.closureId)).limit(1);
  if (!before) throw new Error("سجل الجرد غير موجود.");
  if (before.status !== "draft") throw new Error("يمكن اعتماد سجل جرد مسودة فقط.");
  const changes = { status: "approved" as const, approvedBy: input.actorUserId, approvedAt: new Date() };
  await db.update(fuelInventoryClosures).set(changes).where(eq(fuelInventoryClosures.id, input.closureId));
  await writeAudit({ actorUserId: input.actorUserId, action: "approve", entityType: "fuel.inventory", entityId: input.closureId, beforeValue: before, afterValue: changes });
  return { success: true };
}

export async function closeFuelInventoryClosure(input: { closureId: number; actorUserId: number }) {
  const db = await dbOrThrow();
  const [before] = await db.select().from(fuelInventoryClosures).where(eq(fuelInventoryClosures.id, input.closureId)).limit(1);
  if (!before) throw new Error("سجل الجرد غير موجود.");
  if (before.status !== "approved") throw new Error("لا يمكن إقفال الجرد قبل اعتماده.");
  await db.update(fuelInventoryClosures).set({ status: "closed" }).where(eq(fuelInventoryClosures.id, input.closureId));
  await writeAudit({ actorUserId: input.actorUserId, action: "close", entityType: "fuel.inventory", entityId: input.closureId, beforeValue: before, afterValue: { status: "closed" } });
  return { success: true };
}

type SiteSection = (typeof siteSections)[number];
type SiteAccessLevel = (typeof siteAccessLevels)[number];

export async function listSites() {
  const db = await dbOrThrow();
  return db.select().from(sites).orderBy(sites.isActive, sites.name);
}

export async function getSiteById(siteId: number) {
  const db = await dbOrThrow();
  const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
  return site;
}

export async function createSite(input: { code: string; name: string; city?: string | null; address?: string | null; actorUserId: number }) {
  const db = await dbOrThrow();
  const values = { code: input.code.trim().toUpperCase(), name: input.name.trim(), city: input.city?.trim() || null, address: input.address?.trim() || null, createdBy: input.actorUserId };
  const [result] = await db.insert(sites).values(values);
  await writeAudit({ actorUserId: input.actorUserId, action: "create", entityType: "site", entityId: result.insertId, afterValue: values });
  return { id: result.insertId };
}

export async function updateSite(input: { id: number; code: string; name: string; city?: string | null; address?: string | null; isActive: boolean; actorUserId: number }) {
  const db = await dbOrThrow();
  const [before] = await db.select().from(sites).where(eq(sites.id, input.id)).limit(1);
  if (!before) throw new Error("الموقع غير موجود.");
  const changes = { code: input.code.trim().toUpperCase(), name: input.name.trim(), city: input.city?.trim() || null, address: input.address?.trim() || null, isActive: input.isActive };
  await db.update(sites).set(changes).where(eq(sites.id, input.id));
  await writeAudit({ actorUserId: input.actorUserId, action: "update", entityType: "site", entityId: input.id, beforeValue: before, afterValue: changes });
  return { success: true };
}

export async function getSiteResourceOverview(siteId: number) {
  const db = await dbOrThrow();
  const [site, cycles, meters, generatorRows, productRows] = await Promise.all([
    getSiteById(siteId),
    db.select({ id: billingCycles.id, title: billingCycles.title, status: billingCycles.status, periodStart: billingCycles.periodStart }).from(billingCycles).where(eq(billingCycles.siteId, siteId)).orderBy(desc(billingCycles.periodStart)).limit(6),
    db.select({ id: utilityMeters.id, code: utilityMeters.code, name: utilityMeters.name, isActive: utilityMeters.isActive }).from(utilityMeters).where(eq(utilityMeters.siteId, siteId)).orderBy(utilityMeters.name),
    db.select({ id: generators.id, code: generators.code, name: generators.name, isActive: generators.isActive }).from(generators).where(eq(generators.siteId, siteId)).orderBy(generators.name),
    db.select({ id: fuelProducts.id, code: fuelProducts.code, name: fuelProducts.name, isActive: fuelProducts.isActive }).from(fuelProducts).where(eq(fuelProducts.siteId, siteId)).orderBy(fuelProducts.name),
  ]);
  if (!site) throw new Error("الموقع غير موجود.");
  return { site, cycles, meters, generators: generatorRows, products: productRows, summary: { cycles: cycles.length, meters: meters.length, generators: generatorRows.length, products: productRows.length } };
}

export async function listSiteRoleGrants() {
  const db = await dbOrThrow();
  return db
    .select({ userId: siteRoleGrants.userId, siteId: siteRoleGrants.siteId, section: siteRoleGrants.section, accessLevel: siteRoleGrants.accessLevel, createdAt: siteRoleGrants.createdAt })
    .from(siteRoleGrants)
    .orderBy(siteRoleGrants.userId, siteRoleGrants.siteId, siteRoleGrants.section);
}

export async function replaceSiteRoleGrants(input: { userId: number; grants: Array<{ siteId: number; section: SiteSection; accessLevel: SiteAccessLevel }>; actorUserId: number }) {
  const db = await dbOrThrow();
  const uniqueGrants = Array.from(new Map(input.grants.map(grant => [`${grant.siteId}:${grant.section}`, grant])).values());
  return db.transaction(async tx => {
    const [targetUser] = await tx.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, input.userId)).limit(1);
    if (!targetUser) throw new Error("المستخدم غير موجود.");
    const siteIds = Array.from(new Set(uniqueGrants.map(grant => grant.siteId)));
    if (siteIds.length) {
      const validSites = await tx.select({ id: sites.id }).from(sites).where(inArray(sites.id, siteIds));
      if (validSites.length !== siteIds.length) throw new Error("يتضمن التخصيص موقعًا غير موجود.");
    }
    const before = await tx.select({ siteId: siteRoleGrants.siteId, section: siteRoleGrants.section, accessLevel: siteRoleGrants.accessLevel }).from(siteRoleGrants).where(eq(siteRoleGrants.userId, input.userId));
    await tx.delete(siteRoleGrants).where(eq(siteRoleGrants.userId, input.userId));
    if (uniqueGrants.length) await tx.insert(siteRoleGrants).values(uniqueGrants.map(grant => ({ ...grant, userId: input.userId, grantedBy: input.actorUserId })));
    await tx.insert(auditLogs).values({ actorUserId: input.actorUserId, action: "replace_site_roles", entityType: "site_role_grants", entityId: input.userId, beforeValue: { grants: before }, afterValue: { grants: uniqueGrants, userName: targetUser.name } });
    return { success: true, grants: uniqueGrants };
  });
}

export async function getGrantedSiteIds(userId: number, section: SiteSection) {
  const db = await dbOrThrow();
  const rows = await db.select({ siteId: siteRoleGrants.siteId }).from(siteRoleGrants).where(and(eq(siteRoleGrants.userId, userId), eq(siteRoleGrants.section, section)));
  return Array.from(new Set(rows.map(row => row.siteId)));
}

export async function listAlertAssignees(siteId: number) {
  const db = await dbOrThrow();
  const [grantedUsers, admins] = await Promise.all([
    db.select({ id: users.id, name: users.name, role: users.role }).from(siteRoleGrants).innerJoin(users, eq(siteRoleGrants.userId, users.id)).where(and(eq(siteRoleGrants.siteId, siteId), eq(siteRoleGrants.section, "energy"))).orderBy(users.name),
    db.select({ id: users.id, name: users.name, role: users.role }).from(users).where(eq(users.role, "admin")).orderBy(users.name),
  ]);
  return Array.from(new Map([...grantedUsers, ...admins].map(user => [user.id, user])).values());
}

export async function getTeamAlertActivity(input: {
  siteIds?: number[];
  siteId?: number;
  action?: "acknowledged" | "resolved" | "reopened" | "assigned";
  assignedToUserId?: number;
  responseStatus?: "open" | "acknowledged" | "resolved";
  query?: string;
  sort?: "newest" | "oldest" | "due_soonest" | "due_latest";
}) {
  const db = await dbOrThrow();
  if (input.siteIds && !input.siteIds.length) return [];
  const activityRows = await db
    .select({ id: alertActionHistory.id, alertKey: alertActionHistory.alertKey, action: alertActionHistory.action, note: alertActionHistory.note, createdAt: alertActionHistory.createdAt, siteId: alertActionHistory.siteId, siteName: sites.name, actorName: users.name })
    .from(alertActionHistory)
    .leftJoin(users, eq(alertActionHistory.userId, users.id))
    .leftJoin(sites, eq(alertActionHistory.siteId, sites.id))
    .where(and(input.siteIds ? inArray(alertActionHistory.siteId, input.siteIds) : undefined, input.siteId ? eq(alertActionHistory.siteId, input.siteId) : undefined, input.action ? eq(alertActionHistory.action, input.action) : undefined))
    .orderBy(desc(alertActionHistory.createdAt))
    .limit(120);
  const alertKeys = Array.from(new Set(activityRows.map(row => row.alertKey)));
  const assignmentRows = alertKeys.length ? await db.select({ alertKey: alertAssignments.alertKey, assignedToUserId: alertAssignments.assignedToUserId, dueAt: alertAssignments.dueAt, note: alertAssignments.note }).from(alertAssignments).where(and(inArray(alertAssignments.alertKey, alertKeys), input.siteIds ? inArray(alertAssignments.siteId, input.siteIds) : undefined, input.siteId ? eq(alertAssignments.siteId, input.siteId) : undefined)) : [];
  const allActionRows = alertKeys.length ? await db.select({ alertKey: alertActionHistory.alertKey, action: alertActionHistory.action, createdAt: alertActionHistory.createdAt }).from(alertActionHistory).where(and(inArray(alertActionHistory.alertKey, alertKeys), input.siteIds ? inArray(alertActionHistory.siteId, input.siteIds) : undefined, input.siteId ? eq(alertActionHistory.siteId, input.siteId) : undefined)).orderBy(desc(alertActionHistory.createdAt)) : [];
  const assignmentByKey = new Map(assignmentRows.map(row => [row.alertKey, row]));
  const latestActionByKey = new Map<string, typeof allActionRows[number]>();
  allActionRows.forEach(row => { if (!latestActionByKey.has(row.alertKey)) latestActionByKey.set(row.alertKey, row); });
  const assigneeIds = Array.from(new Set(assignmentRows.map(row => row.assignedToUserId)));
  const assigneeRows = assigneeIds.length ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, assigneeIds)) : [];
  const assigneeNameById = new Map(assigneeRows.map(row => [row.id, row.name]));
  const enriched = activityRows.map(row => {
    const assignment = assignmentByKey.get(row.alertKey);
    const dueAt = assignment?.dueAt ?? null;
    const latestAction = latestActionByKey.get(row.alertKey)?.action;
    const responseStatus = latestAction === "resolved" ? "resolved" as const : latestAction === "acknowledged" || latestAction === "reopened" ? "acknowledged" as const : "open" as const;
    return { ...row, assignedToUserId: assignment?.assignedToUserId ?? null, assignedToName: assignment ? assigneeNameById.get(assignment.assignedToUserId) ?? `مستخدم #${assignment.assignedToUserId}` : null, dueAt, assignmentNote: assignment?.note ?? null, responseStatus };
  }).filter(row => {
    const query = input.query?.trim().toLocaleLowerCase("ar") ?? "";
    const matchesQuery = !query || [row.alertKey, row.siteName ?? "", row.actorName ?? "", row.assignedToName ?? "", row.note ?? "", row.assignmentNote ?? ""].some(value => value.toLocaleLowerCase("ar").includes(query));
    return matchesQuery && (!input.assignedToUserId || row.assignedToUserId === input.assignedToUserId) && (!input.responseStatus || row.responseStatus === input.responseStatus);
  });
  return enriched.sort((left, right) => {
    if (input.sort === "oldest") return left.createdAt.getTime() - right.createdAt.getTime();
    if (input.sort === "due_soonest") return (left.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER) - (right.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER);
    if (input.sort === "due_latest") return (right.dueAt?.getTime() ?? 0) - (left.dueAt?.getTime() ?? 0);
    return right.createdAt.getTime() - left.createdAt.getTime();
  });
}

export async function assignAlert(input: { alertKey: string; siteId: number; assignedToUserId: number; assignedByUserId: number; dueAt: Date; note?: string | null }) {
  const db = await dbOrThrow();
  const assignee = (await listAlertAssignees(input.siteId)).find(user => user.id === input.assignedToUserId);
  if (!assignee) throw new Error("لا يمكن تعيين هذا المستخدم لأنه لا يملك صلاحية الموقع.");
  const note = input.note?.trim() || null;
  const values = { alertKey: input.alertKey, siteId: input.siteId, assignedToUserId: input.assignedToUserId, assignedByUserId: input.assignedByUserId, dueAt: input.dueAt, note };
  const historyNote = `المسؤول: ${assignee.name ?? `مستخدم #${assignee.id}`} · موعد الاستجابة: ${input.dueAt.toLocaleString("ar-YE")}${note ? ` · ${note}` : ""}`;
  await db.transaction(async tx => {
    await tx.insert(alertAssignments).values(values).onDuplicateKeyUpdate({ set: { assignedToUserId: values.assignedToUserId, assignedByUserId: values.assignedByUserId, dueAt: values.dueAt, note: values.note } });
    await tx.insert(alertActionHistory).values({ alertKey: input.alertKey, siteId: input.siteId, userId: input.assignedByUserId, action: "assigned", note: historyNote.slice(0, 500) });
  });
  await writeAudit({ actorUserId: input.assignedByUserId, action: "alert:assigned", entityType: "alert", afterValue: values });
  return { success: true };
}

export async function getSiteDecisionBoard(siteIds?: number[]) {
  const db = await dbOrThrow();
  if (siteIds && !siteIds.length) return [];
  const cycles = siteIds ? await db.select().from(billingCycles).where(inArray(billingCycles.siteId, siteIds)).orderBy(desc(billingCycles.periodStart)) : await db.select().from(billingCycles).orderBy(desc(billingCycles.periodStart));
  const latestBySite = new Map<number, typeof cycles[number]>();
  cycles.forEach(cycle => {
    if (cycle.siteId !== null && !latestBySite.has(cycle.siteId)) latestBySite.set(cycle.siteId, cycle);
  });
  const selectedSiteIds = Array.from(latestBySite.keys());
  if (!selectedSiteIds.length) return [];
  const siteRows = await db.select().from(sites).where(inArray(sites.id, selectedSiteIds));
  const siteById = new Map(siteRows.map(site => [site.id, site]));
  return Promise.all(Array.from(latestBySite.entries()).map(async ([siteId, cycle]) => {
    const analysis = await getCycleAnalysis(cycle.id);
    const recommendation = recommendEnergySource({ utilityKwh: analysis.utility.meterKwh, utilityAmount: analysis.utility.officialAmount, generatorKwh: analysis.generators.kwh, generatorAmount: analysis.generators.selectedCost });
    const readinessItems = [
      { key: "utilityMeter", label: "قراءة عداد المؤسسة", complete: asNumber(analysis.utility.meterKwh) > 0 },
      { key: "utilityInvoice", label: "فاتورة المؤسسة", complete: asNumber(analysis.utility.officialAmount) > 0 },
      { key: "generatorRuntime", label: "طاقة تشغيل المولدات", complete: asNumber(analysis.generators.kwh) > 0 },
      { key: "generatorCost", label: "تكلفة تشغيل المولدات", complete: asNumber(analysis.generators.selectedCost) > 0 },
    ];
    const completedItems = readinessItems.filter(item => item.complete).length;
    return {
      site: siteById.get(siteId),
      cycle: { id: cycle.id, title: cycle.title, periodStart: cycle.periodStart, periodEnd: cycle.periodEnd, status: cycle.status },
      readiness: { completedItems, totalItems: readinessItems.length, missingItems: readinessItems.filter(item => !item.complete).map(item => item.label) },
      comparisonKwh: Math.min(asNumber(analysis.utility.meterKwh), asNumber(analysis.generators.kwh)),
      ...recommendation,
    };
  }));
}

type AlertFilter = {
  siteId?: number;
  type?: "fuel" | "inventory" | "maintenance" | "cost";
  severity?: "critical" | "warning" | "info";
  status?: "open" | "acknowledged" | "resolved";
};

export async function getAlertCenter(input: { siteIds?: number[]; userId: number } & AlertFilter) {
  const db = await dbOrThrow();
  if (input.siteIds && !input.siteIds.length) return { alerts: [], summary: { critical: 0, warning: 0, open: 0 } };
  const products = input.siteIds ? await db.select().from(fuelProducts).where(inArray(fuelProducts.siteId, input.siteIds)) : await db.select().from(fuelProducts);
  const scopedGenerators = input.siteIds ? await db.select().from(generators).where(inArray(generators.siteId, input.siteIds)) : await db.select().from(generators);
  const productIds = products.map(product => product.id);
  const generatorIds = scopedGenerators.map(generator => generator.id);
  const activeSites = input.siteIds ? await db.select().from(sites).where(inArray(sites.id, input.siteIds)) : await db.select().from(sites);
  const siteById = new Map(activeSites.map(site => [site.id, site]));
  const [receipts, issues, waste, closures, runs, maintenance, resolutions, actionHistory, assignments] = await Promise.all([
    productIds.length ? db.select().from(fuelReceipts).where(inArray(fuelReceipts.productId, productIds)) : Promise.resolve([]),
    productIds.length ? db.select().from(fuelIssues).where(inArray(fuelIssues.productId, productIds)) : Promise.resolve([]),
    productIds.length ? db.select().from(fuelWasteRecords).where(inArray(fuelWasteRecords.productId, productIds)) : Promise.resolve([]),
    productIds.length ? db.select().from(fuelInventoryClosures).where(inArray(fuelInventoryClosures.productId, productIds)) : Promise.resolve([]),
    generatorIds.length ? db.select().from(generatorRuns).where(inArray(generatorRuns.generatorId, generatorIds)) : Promise.resolve([]),
    generatorIds.length ? db.select().from(maintenanceRecords).where(inArray(maintenanceRecords.generatorId, generatorIds)) : Promise.resolve([]),
    db.select().from(alertResolutions).where(eq(alertResolutions.userId, input.userId)),
    input.siteIds ? db.select({ alertKey: alertActionHistory.alertKey, action: alertActionHistory.action, note: alertActionHistory.note, createdAt: alertActionHistory.createdAt, actorName: users.name }).from(alertActionHistory).leftJoin(users, eq(alertActionHistory.userId, users.id)).where(inArray(alertActionHistory.siteId, input.siteIds)).orderBy(desc(alertActionHistory.createdAt)) : db.select({ alertKey: alertActionHistory.alertKey, action: alertActionHistory.action, note: alertActionHistory.note, createdAt: alertActionHistory.createdAt, actorName: users.name }).from(alertActionHistory).leftJoin(users, eq(alertActionHistory.userId, users.id)).orderBy(desc(alertActionHistory.createdAt)),
    input.siteIds ? db.select({ alertKey: alertAssignments.alertKey, assignedToName: users.name, dueAt: alertAssignments.dueAt, note: alertAssignments.note, updatedAt: alertAssignments.updatedAt }).from(alertAssignments).leftJoin(users, eq(alertAssignments.assignedToUserId, users.id)).where(inArray(alertAssignments.siteId, input.siteIds)) : db.select({ alertKey: alertAssignments.alertKey, assignedToName: users.name, dueAt: alertAssignments.dueAt, note: alertAssignments.note, updatedAt: alertAssignments.updatedAt }).from(alertAssignments).leftJoin(users, eq(alertAssignments.assignedToUserId, users.id)),
  ]);
  const resolutionByKey = new Map(resolutions.map(item => [item.alertKey, item]));
  const historyByKey = new Map<string, typeof actionHistory>();
  actionHistory.forEach(item => {
    const current = historyByKey.get(item.alertKey) ?? [];
    if (current.length < 3) current.push(item);
    historyByKey.set(item.alertKey, current);
  });
  const assignmentByKey = new Map(assignments.map(item => [item.alertKey, item]));
  const alerts: Array<{ key: string; type: "fuel" | "inventory" | "maintenance" | "cost"; severity: "critical" | "warning" | "info"; title: string; message: string; siteId: number | null; siteName: string; createdAt: Date; status: "open" | "acknowledged" | "resolved"; resolutionNote: string | null; lastActionAt: Date | null }> = [];
  products.forEach(product => {
    const totalReceipts = receipts.filter(item => item.productId === product.id).reduce((sum, item) => sum + asNumber(item.correctedQuantity), 0);
    const totalIssues = issues.filter(item => item.productId === product.id).reduce((sum, item) => sum + asNumber(item.correctedQuantity), 0);
    const totalWaste = waste.filter(item => item.productId === product.id).reduce((sum, item) => sum + asNumber(item.quantity), 0);
    const available = calculateFuelBalance({ openingBalance: asNumber(product.openingBalance), receipts: totalReceipts, issues: totalIssues, waste: totalWaste });
    const fuelAlert = assessFuelLevel(available, asNumber(product.tankCapacity));
    if (fuelAlert) {
      const key = `fuel-low:${product.id}`;
      const resolution = resolutionByKey.get(key);
      alerts.push({ key, type: "fuel", severity: fuelAlert.severity, title: "مخزون وقود منخفض", message: `رصيد ${product.name} المتاح ${available.toFixed(1)} لتر، أي ${(fuelAlert.ratio * 100).toFixed(1)}٪ من السعة.`, siteId: product.siteId, siteName: product.siteId ? siteById.get(product.siteId)?.name ?? "موقع غير محدد" : "موقع غير محدد", createdAt: product.updatedAt, status: resolution?.status ?? "open", resolutionNote: resolution?.note ?? null, lastActionAt: resolution?.updatedAt ?? null });
    }
  });
  closures.forEach(closure => {
    const product = products.find(item => item.id === closure.productId);
    const severity = assessInventoryVariance(asNumber(closure.difference));
    if (!product || !severity) return;
    const key = `inventory-variance:${closure.id}`;
    const resolution = resolutionByKey.get(key);
    alerts.push({ key, type: "inventory", severity, title: "فرق جرد الوقود", message: `سجل جرد ${product.name} لفترة ${closure.month}/${closure.year} بفارق ${asNumber(closure.difference).toFixed(1)} لتر.`, siteId: product.siteId, siteName: product.siteId ? siteById.get(product.siteId)?.name ?? "موقع غير محدد" : "موقع غير محدد", createdAt: closure.updatedAt, status: resolution?.status ?? "open", resolutionNote: resolution?.note ?? null, lastActionAt: resolution?.updatedAt ?? null });
  });
  scopedGenerators.forEach(generator => {
    const latestMaintenance = maintenance.filter(item => item.generatorId === generator.id && item.expectedServiceHours !== null).sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime())[0];
    if (!latestMaintenance?.expectedServiceHours) return;
    const runtimeSince = runs.filter(item => item.generatorId === generator.id && new Date(item.startedAt) >= new Date(latestMaintenance.performedAt)).reduce((sum, item) => sum + asNumber(item.runtimeHours), 0);
    const targetHours = asNumber(latestMaintenance.expectedServiceHours);
    const severity = assessMaintenanceRuntime(runtimeSince, targetHours);
    if (!severity) return;
    const key = `maintenance-due:${generator.id}:${latestMaintenance.id}`;
    const resolution = resolutionByKey.get(key);
    alerts.push({ key, type: "maintenance", severity, title: "صيانة مولد مستحقة", message: `المولد ${generator.name} سجل ${runtimeSince.toFixed(1)} ساعة منذ آخر صيانة من أصل ${targetHours.toFixed(1)} ساعة مستهدفة.`, siteId: generator.siteId, siteName: generator.siteId ? siteById.get(generator.siteId)?.name ?? "موقع غير محدد" : "موقع غير محدد", createdAt: latestMaintenance.performedAt, status: resolution?.status ?? "open", resolutionNote: resolution?.note ?? null, lastActionAt: resolution?.updatedAt ?? null });
  });
  const decisions = await getSiteDecisionBoard(input.siteIds);
  decisions.forEach(decision => {
    if (decision.status !== "recommended" || !decision.site) return;
    const key = `cost-decision:${decision.cycle.id}`;
    const resolution = resolutionByKey.get(key);
    alerts.push({ key, type: "cost", severity: decision.savingPercentage && decision.savingPercentage >= 15 ? "warning" : "info", title: "فرصة وفر في الطاقة", message: decision.explanation, siteId: decision.site.id, siteName: decision.site.name, createdAt: decision.cycle.periodEnd, status: resolution?.status ?? "open", resolutionNote: resolution?.note ?? null, lastActionAt: resolution?.updatedAt ?? null });
  });
  alerts.sort((a, b) => Number(b.severity === "critical") - Number(a.severity === "critical") || b.createdAt.getTime() - a.createdAt.getTime());
  const filteredAlerts = alerts.filter(alert =>
    (!input.siteId || alert.siteId === input.siteId) &&
    (!input.type || alert.type === input.type) &&
    (!input.severity || alert.severity === input.severity) &&
    (!input.status || alert.status === input.status),
  );
  return {
    alerts: filteredAlerts.map(alert => ({
      ...alert,
      assignment: assignmentByKey.get(alert.key) ?? null,
      history: (historyByKey.get(alert.key) ?? []).map(item => ({ action: item.action, note: item.note, createdAt: item.createdAt, actorName: item.actorName })),
    })),
    summary: {
      total: filteredAlerts.length,
      critical: filteredAlerts.filter(alert => alert.severity === "critical" && alert.status === "open").length,
      warning: filteredAlerts.filter(alert => alert.severity === "warning" && alert.status === "open").length,
      open: filteredAlerts.filter(alert => alert.status === "open").length,
      acknowledged: filteredAlerts.filter(alert => alert.status === "acknowledged").length,
      resolved: filteredAlerts.filter(alert => alert.status === "resolved").length,
    },
  };
}

export async function setAlertResolution(input: { alertKey: string; userId: number; siteId?: number | null; status: "acknowledged" | "resolved"; action?: "reopened"; note?: string | null }) {
  const db = await dbOrThrow();
  const values = { alertKey: input.alertKey, userId: input.userId, siteId: input.siteId ?? null, status: input.status, note: input.note?.trim() || null };
  const action = input.action ?? input.status;
  await db.transaction(async tx => {
    await tx.insert(alertResolutions).values(values).onDuplicateKeyUpdate({ set: { status: values.status, note: values.note, siteId: values.siteId } });
    await tx.insert(alertActionHistory).values({ ...values, action });
  });
  await writeAudit({ actorUserId: input.userId, action: `alert:${action}`, entityType: "alert", afterValue: values });
  return { success: true };
}
