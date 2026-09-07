import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

vi.mock("../db", async importOriginal => {
  const actual = await importOriginal<typeof import("../db")>();
  return { ...actual, createAttachment: vi.fn(), getAttachmentById: vi.fn(), recordAttachmentAccess: vi.fn() };
});

vi.mock("../storage", () => ({ storageGet: vi.fn(), storagePut: vi.fn() }));

import { createAttachment, getAttachmentById, recordAttachmentAccess } from "../db";
import { storageGet, storagePut } from "../storage";
import { attachmentRouter } from "./attachments";

const mockedCreate = vi.mocked(createAttachment);
const mockedGet = vi.mocked(getAttachmentById);
const mockedAccess = vi.mocked(recordAttachmentAccess);
const mockedStorageGet = vi.mocked(storageGet);
const mockedStoragePut = vi.mocked(storagePut);

function context(role: "admin" | "energy_operator" | "management" = "admin"): TrpcContext {
  return {
    user: { id: 23, openId: "attachment-test", name: "Attachment tester", email: "files@example.com", loginMethod: "manus", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: {} as TrpcContext["req"], res: {} as TrpcContext["res"],
  };
}

describe("مرفقات الطاقة الآمنة", () => {
  beforeEach(() => vi.clearAllMocks());

  it("يرفض ملفًا بامتداد لا يطابق نوعه المسموح", async () => {
    const caller = attachmentRouter.createCaller(context("energy_operator"));
    await expect(caller.upload({ entityType: "billingCycle", entityId: 1, originalName: "invoice.exe", mimeType: "application/pdf", base64: Buffer.from("pdf").toString("base64") })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mockedStoragePut).not.toHaveBeenCalled();
  });

  it("يرفض ملفًا يتجاوز حد 5 MB قبل التخزين", async () => {
    const caller = attachmentRouter.createCaller(context("energy_operator"));
    const oversized = Buffer.alloc(5 * 1024 * 1024 + 1).toString("base64");
    await expect(caller.upload({ entityType: "billingCycle", entityId: 1, originalName: "invoice.pdf", mimeType: "application/pdf", base64: oversized })).rejects.toMatchObject({ code: "PAYLOAD_TOO_LARGE" });
    expect(mockedStoragePut).not.toHaveBeenCalled();
  });

  it("يخزن PDF صالحًا ويسجل هوية الجلسة بدل هوية يرسلها العميل", async () => {
    mockedStoragePut.mockResolvedValue({ key: "energy-attachments/23/test.pdf", url: "https://storage.example/test.pdf" });
    mockedCreate.mockResolvedValue({ id: 42 } as Awaited<ReturnType<typeof createAttachment>>);
    const caller = attachmentRouter.createCaller(context("energy_operator"));
    await expect(caller.upload({ entityType: "billingCycle", entityId: 1, originalName: "فاتورة يناير.pdf", mimeType: "application/pdf", base64: Buffer.from("content").toString("base64") })).resolves.toMatchObject({ id: 42 });
    expect(mockedStoragePut).toHaveBeenCalledWith(expect.stringContaining("energy-attachments/23/"), expect.any(Buffer), "application/pdf");
    expect(mockedCreate).toHaveBeenCalledWith(expect.objectContaining({ uploadedBy: 23, entityType: "billingCycle", entityId: 1 }));
  });

  it("يعيد رابط عرض مؤقتًا ويسجل الوصول باسم صاحب الجلسة", async () => {
    mockedGet.mockResolvedValue({ id: 42, storageKey: "energy-attachments/23/test.pdf", originalName: "invoice.pdf" } as Awaited<ReturnType<typeof getAttachmentById>>);
    mockedStorageGet.mockResolvedValue({ key: "energy-attachments/23/test.pdf", url: "https://storage.example/signed" });
    mockedAccess.mockResolvedValue(undefined);
    const caller = attachmentRouter.createCaller(context());
    await expect(caller.open({ attachmentId: 42 })).resolves.toMatchObject({ attachmentId: 42, accessedBy: 23, url: "https://storage.example/signed" });
    expect(mockedAccess).toHaveBeenCalledWith({ attachmentId: 42, actorUserId: 23 });
  });
});
