import { z } from "zod";

export const createCustomerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z
    .string()
    .trim()
    .email()
    .optional()
    .or(z.literal(""))
    .transform((value) => value || undefined),
  phone: z.string().trim().max(30).optional(),
  companyName: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    email: z
      .string()
      .trim()
      .email()
      .optional()
      .or(z.literal(""))
      .transform((value) => value || null)
      .optional(),
    phone: z.string().trim().max(30).nullable().optional(),
    companyName: z.string().trim().max(100).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update.",
  });


  export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;