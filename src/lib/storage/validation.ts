import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { env } from '@/lib/env'

/**
 * Upload validation.
 *
 * The client-supplied MIME type and filename extension are both attacker
 * controlled and are never trusted. Type is determined by sniffing the file's
 * magic number, and the stored key is generated server-side.
 */

export const ALLOWED_TYPES = {
  'application/pdf': ['pdf'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
} as const

export type AllowedMime = keyof typeof ALLOWED_TYPES

/** Leading bytes that identify each accepted format. */
const SIGNATURES: Array<{ mime: AllowedMime; bytes: number[]; offset?: number }> = [
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  // WEBP is "RIFF????WEBP" — the RIFF header plus the format tag at offset 8.
  { mime: 'image/webp', bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 },
]

/** DOCX and XLSX are ZIP containers, so they share one signature. */
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04]

function matches(buffer: Buffer, bytes: number[], offset = 0): boolean {
  if (buffer.length < offset + bytes.length) return false
  return bytes.every((byte, index) => buffer[offset + index] === byte)
}

export type SniffResult =
  | { ok: true; mime: AllowedMime }
  | { ok: false; reason: 'unsupported_type' }

/**
 * Determines the real type from the file's own bytes.
 *
 * For ZIP-based Office formats the declared type is used to disambiguate DOCX
 * from XLSX — but only after the container itself has been confirmed, so a
 * renamed executable can never pass.
 */
export function sniffType(buffer: Buffer, declaredMime: string): SniffResult {
  for (const signature of SIGNATURES) {
    if (matches(buffer, signature.bytes, signature.offset)) {
      return { ok: true, mime: signature.mime }
    }
  }

  if (matches(buffer, ZIP_SIGNATURE)) {
    if (
      declaredMime ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      declaredMime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ) {
      return { ok: true, mime: declaredMime }
    }
  }

  return { ok: false, reason: 'unsupported_type' }
}

/** Strips directory components and anything unsafe from a display filename. */
export function sanitizeFilename(filename: string): string {
  const base = path.basename(filename).replace(/\\/g, '')
  const cleaned = base
    .replace(/[^\w.\- ]+/g, '_')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+/, '')
    .trim()

  return (cleaned || 'file').slice(0, 120)
}

/**
 * Builds the storage key.
 *
 * A UUID segment makes the key unguessable, so possession of a key alone is
 * not a capability — the download route still authorizes.
 */
export function buildKey(prefix: string, filename: string, mime: AllowedMime): string {
  const extension = ALLOWED_TYPES[mime][0]
  const safePrefix = prefix.replace(/[^a-z0-9-]/gi, '').slice(0, 40) || 'uploads'
  return `${safePrefix}/${randomUUID()}.${extension}`
}

export type ValidationFailure =
  | { ok: false; reason: 'too_large'; maxMb: number }
  | { ok: false; reason: 'unsupported_type' }
  | { ok: false; reason: 'empty' }

export type ValidationSuccess = {
  ok: true
  mime: AllowedMime
  size: number
  originalName: string
}

export function validateUpload(
  buffer: Buffer,
  declaredMime: string,
  filename: string
): ValidationSuccess | ValidationFailure {
  if (buffer.length === 0) return { ok: false, reason: 'empty' }

  const maxMb = env().UPLOAD_MAX_MB
  if (buffer.length > maxMb * 1024 * 1024) return { ok: false, reason: 'too_large', maxMb }

  const sniffed = sniffType(buffer, declaredMime)
  if (!sniffed.ok) return { ok: false, reason: 'unsupported_type' }

  return {
    ok: true,
    mime: sniffed.mime,
    size: buffer.length,
    originalName: sanitizeFilename(filename),
  }
}

export type ScanResult = { clean: boolean; detail: string }

/**
 * Malware-scanning integration point.
 *
 * INTENTIONALLY NOT IMPLEMENTED. There is no scanner configured, and returning
 * `clean: true` unconditionally would be a false assurance — so the result is
 * recorded as "not scanned" and surfaced honestly on `StoredFile.scanResult`.
 *
 * To enable: call your scanner here (ClamAV, an AV gateway, a cloud API) and
 * return its verdict. Callers already persist whatever this returns.
 */
export async function scanForMalware(_buffer: Buffer): Promise<ScanResult> {
  return { clean: false, detail: 'not_scanned: no malware scanner configured' }
}
