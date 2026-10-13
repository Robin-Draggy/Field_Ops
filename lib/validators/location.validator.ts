import { z } from 'zod';

export const createLocationSchema = z.object({
  name: z.string().trim().min(2).max(100),
  addressLine1: z.string().trim().min(3).max(200),
  addressLine2: z.string().trim().max(200).nullable().optional(),
  city: z.string().trim().min(2).max(100),
  postalCode: z.string().trim().max(20).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  isDefault: z.boolean().optional(),
});

export type CreateLocationInput = z.infer<typeof createLocationSchema>;

export const updateLocationSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    addressLine1: z.string().trim().min(3).max(200).optional(),
    addressLine2: z.string().trim().max(200).nullable().optional(),
    city: z.string().trim().min(2).max(100).optional(),
    postalCode: z.string().trim().max(20).nullable().optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    isDefault: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update.",
  });

  export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;