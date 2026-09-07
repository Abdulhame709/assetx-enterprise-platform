import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { permissionActions, sectionRoleGrants, type EnergyRole } from "../drizzle/schema";
import { getDb, getUserPermissionOverride } from "./db";
import { protectedProcedure } from "./_core/trpc";

export function procedureFor(...roles: EnergyRole[]) {
  return protectedProcedure.use(async ({ ctx, next }) => {
    const role = ctx.user.role as EnergyRole;
    if (role !== "admin" && !roles.includes(role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك الصلاحية لتنفيذ هذه العملية." });
    }
    return next({ ctx });
  });
}

export const viewProcedure = procedureFor("energy_operator", "accountant", "maintenance", "reviewer", "auditor", "management");
export const operationsProcedure = procedureFor("energy_operator", "reviewer");
export const financeProcedure = procedureFor("accountant", "reviewer");
export const maintenanceProcedure = procedureFor("maintenance", "reviewer");
export const reviewProcedure = procedureFor("reviewer");
// الإدارة مسؤولة عن اعتماد الإعدادات التشغيلية على مستوى المنصة، مع بقاء الصلاحيات الحساسة محمية ببقية الإجراءات.
export const configurationProcedure = procedureFor("reviewer", "management");

export function granularProcedure(section: "energy" | "fuel" | "platform", resource: string, action: (typeof permissionActions)[number], ...roles: EnergyRole[]) {
  return protectedProcedure.use(async ({ ctx, next }) => {
    if ((ctx.user.role as EnergyRole) === "admin") return next({ ctx });
    const override = await getUserPermissionOverride({ userId: ctx.user.id, section, resource, action });
    if (override === "deny") throw new TRPCError({ code: "FORBIDDEN", message: "تم منع هذا الإجراء لك صراحةً من مدير النظام." });
    if (override === "allow") return next({ ctx });
    if (!roles.includes(ctx.user.role as EnergyRole)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك الصلاحية لتنفيذ هذا الإجراء." });
    }
    return next({ ctx });
  });
}

export type FuelSectionRole = "viewer" | "operator" | "supervisor" | "accountant" | "auditor";

export function fuelProcedureFor(...roles: FuelSectionRole[]) {
  return protectedProcedure.use(async ({ ctx, next }) => {
    const platformRole = ctx.user.role as EnergyRole;
    if (platformRole === "admin") return next({ ctx });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "اتصال قاعدة البيانات غير متاح." });
    const grants = await db.select({ role: sectionRoleGrants.role }).from(sectionRoleGrants).where(and(eq(sectionRoleGrants.userId, ctx.user.id), eq(sectionRoleGrants.section, "fuel")));
    if (!grants.some(grant => roles.includes(grant.role))) throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك صلاحية الوصول إلى هذا الإجراء في قسم الوقود." });
    return next({ ctx });
  });
}

export const fuelViewProcedure = fuelProcedureFor("viewer", "operator", "supervisor", "accountant", "auditor");
export const fuelOperationsProcedure = fuelProcedureFor("operator", "supervisor");
export const fuelSupervisorProcedure = fuelProcedureFor("supervisor");
