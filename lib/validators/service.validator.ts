import z from "zod";


export const createServiceSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    description: z.string().trim().max(1000).nullable().optional(),
    basePrice: z.number().finite().min(0),
    estimatedDuration: z.number().int().positive(),
  })
  .strict();

  export type CreateServiceInput = z.infer<typeof createServiceSchema>;


  export const updateServiceSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    basePrice: z.number().finite().min(0).optional(),
    estimatedDuration: z.number().int().positive().optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update.",
  });

  export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;