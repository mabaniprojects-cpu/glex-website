/**
 * File storage contract.
 *
 * Concrete providers (local disk in development, S3-compatible in production)
 * implement this, so calling code never knows which is configured. Keys are
 * always provider-relative — a raw URL or filesystem path must never leak to a
 * client.
 */

export type PutInput = {
  /** Provider-relative key, e.g. `supplier-documents/<uuid>/<name>`. */
  key: string
  body: Buffer
  contentType: string
}

export type StoredObject = {
  key: string
  size: number
}

export interface StorageProvider {
  readonly name: string
  put(input: PutInput): Promise<StoredObject>
  /** A time-limited URL, or null when the provider streams instead. */
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string | null>
  /** Reads an object back, for providers that stream through the app. */
  get(key: string): Promise<Buffer | null>
  delete(key: string): Promise<void>
}
