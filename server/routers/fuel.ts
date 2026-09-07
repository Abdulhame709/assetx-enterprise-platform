import { z } from "zod";
import {
  createFuelIssue,
  createFuelInventoryClosure,
  createFuelProduct,
  createFuelReceipt,
  createFuelSupplier,
  createFuelWasteRecord,
  approveFuelInventoryClosure,
  closeFuelInventoryClosure,
  getFuelDashboard,
  getFuelStockSnapshot,
  listFuelProducts,
  listFuelSuppliers,
} from "../db";
import { fuelOperationsProcedure, fuelSupervisorProcedure, fuelViewProcedure } from "../permissions";
import { router } from "../_core/trpc";

const optionalText = z.string().trim().max(2000).optional().nullable();

export const fuelRouter = router({
  dashboard: fuelViewProcedure.query(() => getFuelDashboard()),
  products: router({
    list: fuelViewProcedure.query(() => listFuelProducts()),
    create: fuelSupervisorProcedure.input(z.object({
      code: z.string().trim().min(1).max(64), name: z.string().trim().min(1).max(160),
      fuelType: z.enum(["diesel", "petrol", "kerosene", "other"]), tankCapacity: z.number().positive(),
      literPerCm: z.number().min(0), expansionCoefficient: z.number().min(0), referenceTemp: z.number().min(-50).max(100),
      openingBalance: z.number().min(0), openingDate: z.number().int().optional().nullable(), lastMeterReading: z.number().min(0), notes: optionalText,
    })).mutation(({ input, ctx }) => createFuelProduct({ ...input, actorUserId: ctx.user.id })),
  }),
  suppliers: router({
    list: fuelViewProcedure.query(() => listFuelSuppliers()),
    create: fuelSupervisorProcedure.input(z.object({ name: z.string().trim().min(1).max(160), contactName: z.string().trim().max(160).optional().nullable(), phone: z.string().trim().max(48).optional().nullable(), notes: optionalText })).mutation(({ input, ctx }) => createFuelSupplier({ ...input, actorUserId: ctx.user.id })),
  }),
  stock: fuelViewProcedure.input(z.object({ productId: z.number().int().positive() })).query(({ input }) => getFuelStockSnapshot(input.productId)),
  receipts: router({
    create: fuelOperationsProcedure.input(z.object({
      productId: z.number().int().positive(), supplierId: z.number().int().positive().optional().nullable(), invoiceNumber: z.string().trim().max(96).optional().nullable(),
      receivedAt: z.number().int(), quantityFromTruck: z.number().positive(), quantityFromGauge: z.number().positive(), temperature: z.number().min(-50).max(100), pricePerLiter: z.number().min(0), notes: optionalText,
    })).mutation(({ input, ctx }) => createFuelReceipt({ ...input, actorUserId: ctx.user.id })),
  }),
  issues: router({
    create: fuelOperationsProcedure.input(z.object({
      productId: z.number().int().positive(), issuedAt: z.number().int(), currentReading: z.number().nonnegative(), temperature: z.number().min(-50).max(100),
      issuedTo: z.string().trim().min(1).max(160), vehicleNumber: z.string().trim().max(96).optional().nullable(), notes: optionalText,
    })).mutation(({ input, ctx }) => createFuelIssue({ ...input, actorUserId: ctx.user.id })),
  }),
  waste: router({
    create: fuelOperationsProcedure.input(z.object({ productId: z.number().int().positive(), occurredAt: z.number().int(), quantity: z.number().positive(), reason: z.string().trim().min(1).max(160), notes: optionalText })).mutation(({ input, ctx }) => createFuelWasteRecord({ ...input, actorUserId: ctx.user.id })),
  }),
  inventory: router({
    create: fuelOperationsProcedure.input(z.object({
      productId: z.number().int().positive(), month: z.number().int().min(1).max(12), year: z.number().int().min(2000).max(2200),
      meterReadingStart: z.number().nonnegative(), meterReadingEnd: z.number().nonnegative(), gaugeReadingCm: z.number().nonnegative(), notes: optionalText,
    })).mutation(({ input, ctx }) => createFuelInventoryClosure({ ...input, actorUserId: ctx.user.id })),
    approve: fuelSupervisorProcedure.input(z.object({ closureId: z.number().int().positive() })).mutation(({ input, ctx }) => approveFuelInventoryClosure({ ...input, actorUserId: ctx.user.id })),
    close: fuelSupervisorProcedure.input(z.object({ closureId: z.number().int().positive() })).mutation(({ input, ctx }) => closeFuelInventoryClosure({ ...input, actorUserId: ctx.user.id })),
  }),
});
