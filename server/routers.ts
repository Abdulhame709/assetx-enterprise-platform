import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { energyRouter } from "./routers/energy";
import { settingsRouter } from "./routers/settings";
import { adminRouter } from "./routers/admin";
import { attachmentRouter } from "./routers/attachments";
import { fuelRouter } from "./routers/fuel";
import { monitoringRouter } from "./routers/monitoring";
import { sitesRouter } from "./routers/sites";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  energy: energyRouter,
  settings: settingsRouter,
  admin: adminRouter,
  attachments: attachmentRouter,
  fuel: fuelRouter,
  monitoring: monitoringRouter,
  sites: sitesRouter,
});

export type AppRouter = typeof appRouter;
