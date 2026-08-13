import { ClientType } from '@prisma/client'
import { z } from 'zod'
import { isStrongPassword } from '@/lib/password'

/**
 * Auth schemas, shared by the client forms and the server actions so both
 * enforce identical rules. The server ALWAYS re-validates.
 */

const password = z
  .string()
  .min(10)
  .max(200)
  .refine(isStrongPassword, { message: 'passwordWeak' })

export const loginSchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(1).max(200),
})

export const clientRegisterSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(200),
    phone: z.string().trim().max(40).optional().or(z.literal('')),
    companyName: z.string().trim().min(2).max(160),
    position: z.string().trim().max(120).optional().or(z.literal('')),
    clientType: z.nativeEnum(ClientType),
    industry: z.string().trim().max(120).optional().or(z.literal('')),
    country: z.string().trim().min(2).max(80),
    city: z.string().trim().max(80).optional().or(z.literal('')),
    preferredLocale: z.enum(['en', 'ar', 'de', 'fr', 'zh-CN']),
    password,
    confirmPassword: z.string(),
    acceptTerms: z.literal(true),
    /** Honeypot — permissive on purpose; the action drops filled values silently. */
    website: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'passwordMismatch',
    path: ['confirmPassword'],
  })

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email().max(200),
  website: z.string().optional(),
})

export const resetPasswordSchema = z
  .object({
    token: z.string().min(10),
    password,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'passwordMismatch',
    path: ['confirmPassword'],
  })

export type LoginInput = z.infer<typeof loginSchema>
export type ClientRegisterInput = z.infer<typeof clientRegisterSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>

export const CLIENT_TYPES = [
  ClientType.CONTRACTOR,
  ClientType.DEVELOPER,
  ClientType.CONSULTANT,
  ClientType.DISTRIBUTOR,
  ClientType.RETAILER,
  ClientType.GOVERNMENT_ENTITY,
  ClientType.PROJECT_OWNER,
  ClientType.PROCUREMENT_COMPANY,
  ClientType.INDIVIDUAL_BUYER,
  ClientType.OTHER,
] as const
