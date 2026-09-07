import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTariffVersion, listTariffVersions, saveSettingVersion } from "../db";
import { YEMEN_UTILITY_BRACKETS } from "../domain/costing";
import { granularProcedure, viewProcedure } from "../permissions";
import { router } from "../_core/trpc";

export const settingsRouter = router({
  tariffs: router({
    list: viewProcedure.query(() => listTariffVersions()),
    createYemenDefault: granularProcedure("platform", "settings", "update", "reviewer", "management")
      .input(z.object({ effectiveFrom: z.number().int().positive(), reason: z.string().trim().min(3).max(255) }))
      .mutation(async ({ ctx, input }) => createTariffVersion({
        name: "تعرفة المؤسسة اليمنية",
        pricingMode: "whole_cycle_rate",
        effectiveFrom: input.effectiveFrom,
        reason: input.reason,
        createdBy: ctx.user.id,
        brackets: YEMEN_UTILITY_BRACKETS,
      })),
  }),
  versions: router({
    save: granularProcedure("platform", "settings", "update", "reviewer", "management")
      .input(z.object({ settingGroup: z.string().trim().min(2).max(64), settingKey: z.string().trim().min(2).max(128), value: z.record(z.string(), z.unknown()), effectiveFrom: z.number().int().positive(), reason: z.string().trim().min(3).max(255) }))
      .mutation(async ({ ctx, input }) => {
        if (input.settingGroup === "tariff" && input.settingKey === "pricingMode") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "تتم إدارة التعرفة من تبويب التعرفة المخصص." });
        }
        return saveSettingVersion({ ...input, createdBy: ctx.user.id });
      }),
  }),
});
