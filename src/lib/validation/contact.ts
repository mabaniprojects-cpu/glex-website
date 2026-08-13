import { InquiryType } from '@prisma/client'
import { z } from 'zod'

/**
 * Contact-form schema, shared by the client form and the server action so both
 * sides enforce exactly the same rules. The server ALWAYS re-validates.
 */
export const contactSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  company: z.string().trim().max(160).optional().or(z.literal('')),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  country: z.string().trim().max(80).optional().or(z.literal('')),
  type: z.nativeEnum(InquiryType),
  subject: z.string().trim().min(3).max(200),
  message: z.string().trim().min(10).max(5000),
  consent: z.literal(true),
  /**
   * Honeypot — invisible to real users.
   *
   * Deliberately permissive: rejecting a filled value here would return a
   * validation error naming this field, telling a bot exactly which one is the
   * trap. The action accepts the submission and silently drops it instead.
   */
  website: z.string().optional(),
})

export type ContactInput = z.infer<typeof contactSchema>

export const INQUIRY_TYPES = [
  InquiryType.GENERAL,
  InquiryType.QUOTE_REQUEST,
  InquiryType.SUPPLIER_REGISTRATION,
  InquiryType.CLIENT_SUPPORT,
  InquiryType.SHIPMENT_SUPPORT,
  InquiryType.PARTNERSHIP,
  InquiryType.MEDIA,
  InquiryType.CAREERS,
  InquiryType.OTHER,
] as const
