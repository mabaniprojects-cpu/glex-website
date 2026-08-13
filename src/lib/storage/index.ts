import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { env } from '@/lib/env'
import type { PutInput, StorageProvider, StoredObject } from './types'

/**
 * Storage provider selection.
 *
 * `local` writes under ./storage and is a development convenience; `s3` targets
 * any S3-compatible endpoint. `src/lib/env.ts` refuses `s3` without credentials.
 */

/** Guards against a key escaping the storage root via `..` or an absolute path. */
function resolveLocalPath(key: string): string {
  const root = path.resolve(process.cwd(), 'storage')
  const target = path.resolve(root, key)

  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error('Refusing to resolve a storage key outside the storage root')
  }
  return target
}

const localProvider: StorageProvider = {
  name: 'local',

  async put({ key, body }: PutInput): Promise<StoredObject> {
    const target = resolveLocalPath(key)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, body)
    return { key, size: body.length }
  },

  // Local files are streamed through the authorized download route, never
  // exposed by URL — there is no origin that could serve them directly.
  async getSignedUrl(): Promise<string | null> {
    return null
  },

  async get(key: string): Promise<Buffer | null> {
    try {
      return await readFile(resolveLocalPath(key))
    } catch {
      return null
    }
  },

  async delete(key: string): Promise<void> {
    try {
      await unlink(resolveLocalPath(key))
    } catch {
      // Already gone is an acceptable outcome for a delete.
    }
  },
}

function createS3Provider(): StorageProvider {
  const config = env()

  // Imported lazily so the AWS SDK is never pulled into a build that uses
  // local storage.
  const clientPromise = (async () => {
    const { S3Client } = await import('@aws-sdk/client-s3')
    return new S3Client({
      region: config.S3_REGION ?? 'us-east-1',
      endpoint: config.S3_ENDPOINT || undefined,
      forcePathStyle: config.S3_FORCE_PATH_STYLE ?? false,
      credentials: {
        accessKeyId: config.S3_ACCESS_KEY_ID!,
        secretAccessKey: config.S3_SECRET_ACCESS_KEY!,
      },
    })
  })()

  return {
    name: 's3',

    async put({ key, body, contentType }: PutInput): Promise<StoredObject> {
      const { PutObjectCommand } = await import('@aws-sdk/client-s3')
      const client = await clientPromise

      await client.send(
        new PutObjectCommand({
          Bucket: config.S3_BUCKET!,
          Key: key,
          Body: body,
          ContentType: contentType,
          // Never let an object become publicly readable by default.
          ACL: 'private',
        })
      )

      return { key, size: body.length }
    },

    async getSignedUrl(key: string, expiresInSeconds: number): Promise<string> {
      const { GetObjectCommand } = await import('@aws-sdk/client-s3')
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner')
      const client = await clientPromise

      return getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: config.S3_BUCKET!, Key: key }),
        { expiresIn: expiresInSeconds }
      )
    },

    async get(key: string): Promise<Buffer | null> {
      const { GetObjectCommand } = await import('@aws-sdk/client-s3')
      const client = await clientPromise

      try {
        const response = await client.send(
          new GetObjectCommand({ Bucket: config.S3_BUCKET!, Key: key })
        )
        const bytes = await response.Body?.transformToByteArray()
        return bytes ? Buffer.from(bytes) : null
      } catch {
        return null
      }
    },

    async delete(key: string): Promise<void> {
      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3')
      const client = await clientPromise
      await client.send(new DeleteObjectCommand({ Bucket: config.S3_BUCKET!, Key: key }))
    },
  }
}

let cached: StorageProvider | undefined

export function getStorageProvider(): StorageProvider {
  if (!cached) {
    cached = env().STORAGE_PROVIDER === 's3' ? createS3Provider() : localProvider
  }
  return cached
}

export type { StorageProvider, StoredObject } from './types'
