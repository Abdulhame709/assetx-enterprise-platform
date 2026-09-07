import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createAttachment, getAttachmentById, listAttachments, recordAttachmentAccess } from "../db";
import { procedureFor, viewProcedure } from "../permissions";
import { storageGet, storagePut } from "../storage";
import { router } from "../_core/trpc";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const acceptedTypes = new Map([
  ["application/pdf", ["pdf"]],
  ["text/plain", ["txt"]],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ["xlsx"]],
  ["application/vnd.ms-excel", ["xls"]],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", ["docx"]],
  ["application/msword", ["doc"]],
]);

function safeFileName(name: string) {
  return name.replace(/[^\w.\-\u0600-\u06FF]/g, "_").slice(0, 180);
}

export const attachmentRouter = router({
  list: viewProcedure.input(z.object({ entityType: z.string().min(2).max(64), entityId: z.number().int().positive() })).query(({ input }) => listAttachments(input.entityType, input.entityId)),
  open: viewProcedure.input(z.object({ attachmentId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const attachment = await getAttachmentById(input.attachmentId);
    if (!attachment) throw new TRPCError({ code: "NOT_FOUND", message: "المرفق غير موجود." });
    const access = await storageGet(attachment.storageKey);
    await recordAttachmentAccess({ attachmentId: attachment.id, actorUserId: ctx.user.id });
    return { url: access.url, fileName: attachment.originalName, attachmentId: attachment.id, accessedBy: ctx.user.id };
  }),
  upload: procedureFor("energy_operator", "accountant", "maintenance", "reviewer")
    .input(z.object({ entityType: z.string().min(2).max(64), entityId: z.number().int().positive(), originalName: z.string().min(1).max(255), mimeType: z.string().min(3).max(128), base64: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const extension = input.originalName.split(".").pop()?.toLowerCase() ?? "";
      const acceptedExtensions = acceptedTypes.get(input.mimeType);
      if (!acceptedExtensions?.includes(extension)) throw new TRPCError({ code: "BAD_REQUEST", message: "نوع الملف غير مسموح. يدعم النظام PDF وTXT وExcel وWord فقط." });
      const bytes = Buffer.from(input.base64, "base64");
      if (!bytes.length || bytes.length > MAX_FILE_SIZE) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "الحد الأقصى لحجم المرفق هو 5 MB." });
      const stored = await storagePut(`energy-attachments/${ctx.user.id}/${Date.now()}_${safeFileName(input.originalName)}`, bytes, input.mimeType);
      return createAttachment({ entityType: input.entityType, entityId: input.entityId, originalName: input.originalName, storageKey: stored.key, mimeType: input.mimeType, sizeBytes: bytes.length, uploadedBy: ctx.user.id });
    }),
});
