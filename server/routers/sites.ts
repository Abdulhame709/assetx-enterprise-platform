import { z } from "zod";
import { createSite, getGrantedSiteIds, getSiteResourceOverview, listSiteRoleGrants, listSites, replaceSiteRoleGrants, updateSite } from "../db";
import { siteAccessLevels, siteSections } from "../../drizzle/schema";
import { procedureFor, viewProcedure } from "../permissions";
import { router } from "../_core/trpc";

const adminProcedure = procedureFor();

async function siteIdsForUser(userId: number, isAdmin: boolean) {
  if (isAdmin) return undefined;
  const [energySites, fuelSites] = await Promise.all([getGrantedSiteIds(userId, "energy"), getGrantedSiteIds(userId, "fuel")]);
  return Array.from(new Set([...energySites, ...fuelSites]));
}

export const sitesRouter = router({
  accessible: viewProcedure.query(async ({ ctx }) => {
    const available = await listSites();
    const allowedIds = await siteIdsForUser(ctx.user.id, ctx.user.role === "admin");
    return allowedIds ? available.filter(site => allowedIds.includes(site.id)) : available;
  }),
  manage: router({
    list: adminProcedure.query(() => listSites()),
    create: adminProcedure
      .input(z.object({ code: z.string().trim().min(2).max(64), name: z.string().trim().min(2).max(160), city: z.string().trim().max(120).optional().nullable(), address: z.string().trim().max(1000).optional().nullable() }))
      .mutation(({ ctx, input }) => createSite({ ...input, actorUserId: ctx.user.id })),
    update: adminProcedure
      .input(z.object({ id: z.number().int().positive(), code: z.string().trim().min(2).max(64), name: z.string().trim().min(2).max(160), city: z.string().trim().max(120).optional().nullable(), address: z.string().trim().max(1000).optional().nullable(), isActive: z.boolean() }))
      .mutation(({ ctx, input }) => updateSite({ ...input, actorUserId: ctx.user.id })),
    resources: adminProcedure
      .input(z.object({ siteId: z.number().int().positive() }))
      .query(({ input }) => getSiteResourceOverview(input.siteId)),
    grants: router({
      list: adminProcedure.query(() => listSiteRoleGrants()),
      replace: adminProcedure
        .input(z.object({ userId: z.number().int().positive(), grants: z.array(z.object({ siteId: z.number().int().positive(), section: z.enum(siteSections), accessLevel: z.enum(siteAccessLevels) })).max(100) }))
        .mutation(({ ctx, input }) => replaceSiteRoleGrants({ ...input, actorUserId: ctx.user.id })),
    }),
  }),
});
