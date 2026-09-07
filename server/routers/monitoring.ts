import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { assignAlert, getAlertCenter, getGrantedSiteIds, getSiteDecisionBoard, getTeamAlertActivity, listAlertAssignees, setAlertResolution } from "../db";
import { procedureFor, viewProcedure } from "../permissions";
import { router } from "../_core/trpc";

async function energySiteScope(userId: number, isAdmin: boolean) {
  return isAdmin ? undefined : getGrantedSiteIds(userId, "energy");
}

const alertFilterInput = z.object({
  siteId: z.number().int().positive().optional(),
  type: z.enum(["fuel", "inventory", "maintenance", "cost"]).optional(),
  severity: z.enum(["critical", "warning", "info"]).optional(),
  status: z.enum(["open", "acknowledged", "resolved"]).optional(),
});
const teamActivityInput = z.object({
  siteId: z.number().int().positive().optional(),
  action: z.enum(["acknowledged", "resolved", "reopened", "assigned"]).optional(),
  assignedToUserId: z.number().int().positive().optional(),
  responseStatus: z.enum(["open", "acknowledged", "resolved"]).optional(),
  query: z.string().trim().max(120).optional(),
  sort: z.enum(["newest", "oldest", "due_soonest", "due_latest"]).optional(),
});
const alertAssignmentProcedure = procedureFor("reviewer", "management");

async function assertSiteScope(siteId: number | undefined, allowedSiteIds: number[] | undefined) {
  if (siteId && allowedSiteIds && !allowedSiteIds.includes(siteId)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك صلاحية الوصول إلى هذا الموقع." });
  }
}

export const monitoringRouter = router({
  decisions: viewProcedure.input(z.object({ siteId: z.number().int().positive().optional() }).optional()).query(async ({ ctx, input }) => {
    const allowedSiteIds = await energySiteScope(ctx.user.id, ctx.user.role === "admin");
    await assertSiteScope(input?.siteId, allowedSiteIds);
    return getSiteDecisionBoard(input?.siteId ? [input.siteId] : allowedSiteIds);
  }),
  alerts: router({
    list: viewProcedure.input(alertFilterInput.optional()).query(async ({ ctx, input }) => {
      const siteIds = await energySiteScope(ctx.user.id, ctx.user.role === "admin");
      await assertSiteScope(input?.siteId, siteIds);
      return getAlertCenter({ userId: ctx.user.id, siteIds, ...input });
    }),
    resolve: viewProcedure
      .input(z.object({ alertKey: z.string().trim().min(3).max(191), siteId: z.number().int().positive().nullable(), status: z.enum(["acknowledged", "resolved", "reopened"]), note: z.string().trim().max(500).optional().nullable() }))
      .mutation(async ({ ctx, input }) => {
        const allowedSiteIds = await energySiteScope(ctx.user.id, ctx.user.role === "admin");
        const currentAlerts = await getAlertCenter({ userId: ctx.user.id, siteIds: allowedSiteIds });
        const currentAlert = currentAlerts.alerts.find(alert => alert.key === input.alertKey);
        if (!currentAlert || (currentAlert.siteId && allowedSiteIds && !allowedSiteIds.includes(currentAlert.siteId))) {
          throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك صلاحية معالجة تنبيه هذا الموقع." });
        }
        return setAlertResolution({ alertKey: input.alertKey, userId: ctx.user.id, siteId: currentAlert.siteId, status: input.status === "reopened" ? "acknowledged" : input.status, action: input.status === "reopened" ? "reopened" : undefined, note: input.note });
      }),
    assignees: viewProcedure
      .input(z.object({ siteId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const allowedSiteIds = await energySiteScope(ctx.user.id, ctx.user.role === "admin");
        await assertSiteScope(input.siteId, allowedSiteIds);
        return listAlertAssignees(input.siteId);
      }),
    assign: alertAssignmentProcedure
      .input(z.object({ alertKey: z.string().trim().min(3).max(191), siteId: z.number().int().positive(), assignedToUserId: z.number().int().positive(), dueAt: z.number().int().positive(), note: z.string().trim().max(500).optional().nullable() }))
      .mutation(async ({ ctx, input }) => {
        const allowedSiteIds = await energySiteScope(ctx.user.id, ctx.user.role === "admin");
        await assertSiteScope(input.siteId, allowedSiteIds);
        const currentAlerts = await getAlertCenter({ userId: ctx.user.id, siteIds: allowedSiteIds });
        const currentAlert = currentAlerts.alerts.find(alert => alert.key === input.alertKey);
        if (!currentAlert || currentAlert.siteId !== input.siteId) throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكن تعيين مسؤول لتنبيه خارج نطاق الموقع." });
        return assignAlert({ ...input, assignedByUserId: ctx.user.id, dueAt: new Date(input.dueAt) });
      }),
  }),
  activity: router({
    list: viewProcedure.input(teamActivityInput.optional()).query(async ({ ctx, input }) => {
      const siteIds = await energySiteScope(ctx.user.id, ctx.user.role === "admin");
      await assertSiteScope(input?.siteId, siteIds);
      return getTeamAlertActivity({ siteIds, ...input });
    }),
  }),
});
