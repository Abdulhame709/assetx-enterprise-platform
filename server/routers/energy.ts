import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createBillingCycle,
  createFuelRecord,
  createGenerator,
  createGeneratorRun,
  createMaintenanceRecord,
  createMeterReading,
  createUtilityMeter,
  getCycleById,
  getCycleAnalysis,
  getDashboardData,
  getGrantedSiteIds,
  getReportRecommendations,
  listFuelRecords,
  listBillingCycles,
  listGeneratorRuns,
  listGenerators,
  listUtilityMeters,
  previewUtilityInvoice,
  setCycleStatus,
  updateFuelRecord,
  updateBillingCycle,
  updateGenerator,
  upsertUtilityInvoice,
} from "../db";
import { calculateMeterConsumption } from "../domain/costing";
import { financeProcedure, maintenanceProcedure, operationsProcedure, reviewProcedure, viewProcedure } from "../permissions";
import { router } from "../_core/trpc";

const timestampInput = z.number().int().positive();
const amountInput = z.coerce.number().nonnegative();

async function assertCycleEditable(cycleId: number) {
  const cycle = await getCycleById(cycleId);
  if (!cycle) throw new TRPCError({ code: "NOT_FOUND", message: "دورة الفوترة غير موجودة." });
  if (cycle.status === "closed") throw new TRPCError({ code: "CONFLICT", message: "لا يمكن تعديل دورة مقفلة." });
  return cycle;
}

async function energySiteScope(ctx: { user: { id: number; role: string } }) {
  return ctx.user.role === "admin" ? undefined : getGrantedSiteIds(ctx.user.id, "energy");
}

async function assertEnergySiteAccess(ctx: { user: { id: number; role: string } }, siteId: number) {
  const scope = await energySiteScope(ctx);
  if (scope && !scope.includes(siteId)) throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك صلاحية هذا الموقع في قسم الطاقة." });
}

async function assertCycleAccess(ctx: { user: { id: number; role: string } }, cycleId: number) {
  const cycle = await assertCycleEditable(cycleId);
  if (cycle.siteId === null) throw new TRPCError({ code: "CONFLICT", message: "الدورة غير مرتبطة بموقع." });
  await assertEnergySiteAccess(ctx, cycle.siteId);
  return cycle;
}

export const energyRouter = router({
  dashboard: viewProcedure.query(async ({ ctx }) => getDashboardData(await energySiteScope(ctx))),
  analysis: viewProcedure.input(z.object({ cycleId: z.number().int().positive() })).query(async ({ ctx, input }) => { await assertCycleAccess(ctx, input.cycleId); return getCycleAnalysis(input.cycleId); }),
  reports: viewProcedure.query(async ({ ctx }) => getReportRecommendations(await energySiteScope(ctx))),

  cycles: router({
    list: viewProcedure.query(async ({ ctx }) => listBillingCycles(await energySiteScope(ctx))),
    create: financeProcedure
      .input(z.object({ title: z.string().trim().min(3).max(160), periodStart: timestampInput, periodEnd: timestampInput, siteId: z.number().int().positive().optional() }))
      .mutation(async ({ ctx, input }) => {
        if (input.periodEnd <= input.periodStart) throw new TRPCError({ code: "BAD_REQUEST", message: "يجب أن تكون نهاية الدورة بعد بدايتها." });
        if (input.siteId) await assertEnergySiteAccess(ctx, input.siteId);
        return createBillingCycle({ ...input, createdBy: ctx.user.id });
      }),
    update: financeProcedure
      .input(z.object({ id: z.number().int().positive(), title: z.string().trim().min(3).max(160), periodStart: timestampInput, periodEnd: timestampInput }))
      .mutation(async ({ ctx, input }) => {
        if (input.periodEnd <= input.periodStart) throw new TRPCError({ code: "BAD_REQUEST", message: "يجب أن تكون نهاية الدورة بعد بدايتها." });
        await assertCycleAccess(ctx, input.id);
        return updateBillingCycle({ ...input, actorUserId: ctx.user.id });
      }),
    changeStatus: reviewProcedure
      .input(z.object({ cycleId: z.number().int().positive(), status: z.enum(["data_entry", "validation", "reviewed", "approved", "closed"]), reason: z.string().trim().min(3).max(255) }))
      .mutation(async ({ ctx, input }) => { await assertCycleAccess(ctx, input.cycleId); return setCycleStatus({ ...input, userId: ctx.user.id }); }),
  }),

  meters: router({
    list: viewProcedure.query(async ({ ctx }) => listUtilityMeters(await energySiteScope(ctx))),
    create: operationsProcedure
      .input(z.object({ code: z.string().trim().min(2).max(64), name: z.string().trim().min(2).max(160), multiplier: z.coerce.number().positive(), siteId: z.number().int().positive().optional() }))
      .mutation(async ({ ctx, input }) => { if (input.siteId) await assertEnergySiteAccess(ctx, input.siteId); return createUtilityMeter(input); }),
    addReading: operationsProcedure
      .input(z.object({ cycleId: z.number().int().positive(), meterId: z.number().int().positive(), previousReading: amountInput, currentReading: amountInput, multiplier: z.coerce.number().positive(), readAt: timestampInput, notes: z.string().trim().max(1000).optional() }))
      .mutation(async ({ ctx, input }) => {
        await assertCycleAccess(ctx, input.cycleId);
        calculateMeterConsumption(input.previousReading, input.currentReading, input.multiplier);
        return createMeterReading({ ...input, createdBy: ctx.user.id });
      }),
  }),

  invoices: router({
    preview: financeProcedure
      .input(z.object({ cycleId: z.number().int().positive(), consumptionKwh: amountInput }))
      .query(({ input }) => previewUtilityInvoice(input)),
    save: financeProcedure
      .input(z.object({ cycleId: z.number().int().positive(), invoiceNumber: z.string().trim().max(96).optional(), invoiceIssuedAt: timestampInput.optional(), officialKwh: amountInput.optional(), officialAmount: amountInput, adjustmentAmount: z.coerce.number().optional(), notes: z.string().trim().max(2000).optional() }))
      .mutation(async ({ ctx, input }) => {
        await assertCycleAccess(ctx, input.cycleId);
        return upsertUtilityInvoice({ ...input, createdBy: ctx.user.id });
      }),
  }),

  generators: router({
    list: viewProcedure.query(async ({ ctx }) => listGenerators(await energySiteScope(ctx))),
    create: maintenanceProcedure
      .input(z.object({ code: z.string().trim().min(2).max(64), name: z.string().trim().min(2).max(160), siteId: z.number().int().positive().optional(), ratedKva: amountInput.optional(), defaultPowerFactor: z.coerce.number().gt(0).lte(1).optional(), acquisitionCost: amountInput.optional(), residualValue: amountInput.optional(), inServiceAt: timestampInput.optional(), usefulLifeMonths: z.coerce.number().int().positive().optional(), usefulLifeHours: amountInput.optional() }))
      .mutation(async ({ ctx, input }) => { if (input.siteId) await assertEnergySiteAccess(ctx, input.siteId); return createGenerator(input); }),
    update: maintenanceProcedure
      .input(z.object({ id: z.number().int().positive(), code: z.string().trim().min(2).max(64), name: z.string().trim().min(2).max(160), ratedKva: amountInput.optional(), defaultPowerFactor: z.coerce.number().gt(0).lte(1).optional(), acquisitionCost: amountInput.optional(), residualValue: amountInput.optional(), inServiceAt: timestampInput.optional(), usefulLifeMonths: z.coerce.number().int().positive().optional(), usefulLifeHours: amountInput.optional() }))
      .mutation(({ ctx, input }) => updateGenerator({ ...input, actorUserId: ctx.user.id })),
    addRun: operationsProcedure
      .input(z.object({ cycleId: z.number().int().positive(), generatorId: z.number().int().positive(), startedAt: timestampInput, endedAt: timestampInput, runtimeHours: z.coerce.number().positive(), measurementMode: z.enum(["kwh", "kw", "kva"]), directKwh: amountInput.optional(), averageKw: amountInput.optional(), averageKva: amountInput.optional(), powerFactor: z.coerce.number().gt(0).lte(1).optional(), qualityStatus: z.enum(["measured", "calculated", "estimated"]), notes: z.string().trim().max(1000).optional() }))
      .mutation(async ({ ctx, input }) => {
        await assertCycleAccess(ctx, input.cycleId);
        if (input.endedAt <= input.startedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "يجب أن تنتهي فترة التشغيل بعد بدايتها." });
        return createGeneratorRun({ ...input, createdBy: ctx.user.id });
      }),
    listRuns: viewProcedure.input(z.object({ cycleId: z.number().int().positive() })).query(async ({ ctx, input }) => { await assertCycleAccess(ctx, input.cycleId); return listGeneratorRuns(input.cycleId); }),
  }),

  fuel: router({
    list: viewProcedure.input(z.object({ cycleId: z.number().int().positive() })).query(async ({ ctx, input }) => { await assertCycleAccess(ctx, input.cycleId); return listFuelRecords(input.cycleId); }),
    add: operationsProcedure
      .input(z.object({ cycleId: z.number().int().positive(), generatorId: z.number().int().positive(), transactionType: z.enum(["refuel", "consumption", "adjustment"]), quantityLiters: amountInput, unitPrice: amountInput, transactionAt: timestampInput, notes: z.string().trim().max(1000).optional() }))
      .mutation(async ({ ctx, input }) => {
        await assertCycleAccess(ctx, input.cycleId);
        return createFuelRecord({ ...input, createdBy: ctx.user.id });
      }),
    update: operationsProcedure
      .input(z.object({ id: z.number().int().positive(), cycleId: z.number().int().positive(), generatorId: z.number().int().positive(), transactionType: z.enum(["refuel", "consumption", "adjustment"]), quantityLiters: amountInput, unitPrice: amountInput, transactionAt: timestampInput, notes: z.string().trim().max(1000).optional() }))
      .mutation(async ({ ctx, input }) => {
        await assertCycleAccess(ctx, input.cycleId);
        return updateFuelRecord({ ...input, actorUserId: ctx.user.id });
      }),
  }),

  maintenance: router({
    add: maintenanceProcedure
      .input(z.object({ cycleId: z.number().int().positive().optional(), generatorId: z.number().int().positive(), maintenanceType: z.string().trim().min(2).max(120), performedAt: timestampInput, actualCost: amountInput, expectedServiceHours: amountInput.optional(), notes: z.string().trim().max(1000).optional() }))
      .mutation(({ ctx, input }) => createMaintenanceRecord({ ...input, createdBy: ctx.user.id })),
  }),
});
