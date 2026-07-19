import { z } from "zod";

export const createInvoiceSchema = z.object({
  patientId: z.string().uuid(),
  appointmentId: z.string().uuid().optional().nullable(),
  discount: z.number().min(0).optional().default(0),
  items: z
    .array(
      z.object({
        description: z.string().trim().min(1, "Description required").max(255),
        quantity: z.number().int().positive().default(1),
        unitPrice: z.number().min(0),
      }),
    )
    .min(1, "At least one line item is required"),
});

export const paymentSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  method: z.enum(["Cash", "Card", "BankTransfer", "Insurance", "Other"]).default("Cash"),
});

export const invoiceQuerySchema = z.object({
  patientId: z.string().uuid().optional(),
  status: z.enum(["Unpaid", "PartiallyPaid", "Paid", "Void"]).optional(),
});

export type CreateInvoiceBody = z.infer<typeof createInvoiceSchema>;
export type PaymentBody = z.infer<typeof paymentSchema>;
export type InvoiceQuery = z.infer<typeof invoiceQuerySchema>;
