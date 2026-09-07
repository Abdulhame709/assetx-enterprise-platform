import { z } from "zod";
import { listFuelRoleAuditLogs, listFuelRoleGrants, listPermissionGrants, listUsers, replaceFuelRoleGrants, replaceUserPermissions, updateUserRole } from "../db";
import { fuelSectionRoles, permissionActions, permissionEffects, platformSections, userRoles } from "../../drizzle/schema";
import { router } from "../_core/trpc";
import { procedureFor } from "../permissions";

const adminProcedure = procedureFor();

export const adminRouter = router({
  users: router({
    list: adminProcedure.query(() => listUsers()),
    setRole: adminProcedure
      .input(z.object({ userId: z.number().int().positive(), role: z.enum(userRoles) }))
      .mutation(({ ctx, input }) => updateUserRole({ ...input, actorUserId: ctx.user.id })),
  }),
  permissions: router({
    list: adminProcedure.query(() => listPermissionGrants()),
    replace: adminProcedure
      .input(z.object({
        userId: z.number().int().positive(),
        permissions: z.array(z.object({
          section: z.enum(platformSections),
          resource: z.string().trim().min(2).max(96),
          action: z.enum(permissionActions),
          effect: z.enum(permissionEffects),
        })).max(300),
      }))
      .mutation(({ ctx, input }) => replaceUserPermissions({ ...input, actorUserId: ctx.user.id })),
  }),
  fuelRoles: router({
    list: adminProcedure.query(() => listFuelRoleGrants()),
    audit: adminProcedure
      .input(z.object({ limit: z.number().int().min(1).max(100) }).optional())
      .query(({ input }) => listFuelRoleAuditLogs(input?.limit ?? 50)),
    replace: adminProcedure
      .input(z.object({ userId: z.number().int().positive(), roles: z.array(z.enum(fuelSectionRoles)).max(fuelSectionRoles.length) }))
      .mutation(({ ctx, input }) => replaceFuelRoleGrants({ ...input, actorUserId: ctx.user.id })),
  }),
});
