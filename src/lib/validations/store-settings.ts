import { z } from 'zod';

export const updateStoreSettingsSchema = z.object({
  name: z
    .string()
    .min(1, 'Store name is required')
    .max(100, 'Store name cannot exceed 100 characters'),
  street1: z
    .string()
    .min(1, 'Street address is required')
    .max(100, 'Street address cannot exceed 100 characters'),
  street2: z
    .string()
    .max(100, 'Street address line 2 cannot exceed 100 characters')
    .nullable()
    .optional()
    .transform((val) => val || null),
  city: z
    .string()
    .min(1, 'City is required')
    .max(50, 'City cannot exceed 50 characters'),
  zip: z
    .string()
    .min(1, 'ZIP code is required')
    .max(10, 'ZIP code cannot exceed 10 characters'),
  phone: z
    .string()
    .min(1, 'Store phone is required')
    .max(20, 'Store phone cannot exceed 20 characters'),
  email: z
    .string()
    .email('Invalid email format')
    .max(100, 'Store email cannot exceed 100 characters'),
  hours: z
    .string()
    .min(1, 'Store hours are required')
    .max(200, 'Store hours cannot exceed 200 characters'),
});

export type UpdateStoreSettingsInput = z.infer<typeof updateStoreSettingsSchema>;
