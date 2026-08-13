import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

/**
 * Prisma 7 moved the datasource connection URL out of `schema.prisma` and into
 * this file. The URL here is used exclusively by the Prisma CLI (migrate,
 * db push, studio, seed). The *runtime* client gets its connection from the
 * `@prisma/adapter-pg` driver adapter constructed in `src/lib/db.ts`.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
})
