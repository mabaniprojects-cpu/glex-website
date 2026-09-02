import 'dotenv/config'
import { defineConfig } from 'prisma/config'

/**
 * Prisma 7 moved the datasource connection URL out of `schema.prisma` and into
 * this file. The URL here is used exclusively by the Prisma CLI (migrate,
 * db push, studio, seed). The *runtime* client gets its connection from the
 * `@prisma/adapter-pg` driver adapter constructed in `src/lib/db.ts`.
 *
 * `datasource` is attached only when DATABASE_URL exists, and read through
 * `process.env` rather than Prisma's `env()` helper.
 *
 * `env()` resolves eagerly and THROWS on a missing variable, which happens
 * while the config file is being loaded — before the CLI has decided whether
 * the command even needs a database. `prisma generate` does not: it writes a
 * client from the schema and never connects. But `generate` runs from
 * `postinstall`, so an absent DATABASE_URL failed `npm install` itself:
 *
 *     PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL
 *
 * That is every fresh clone, and every host that installs dependencies before
 * its environment variables are configured — which is how it broke a Vercel
 * build at `npm install`, long before any application code ran. It went
 * unnoticed here because `.env` and the CI workflow both always set the
 * variable, so nothing that ran regularly was ever missing it.
 *
 * Prisma's own types call `datasource` "optional for most cases, but required
 * for migration / introspection commands", so omitting it is the documented
 * shape rather than a workaround: `generate` proceeds, and the commands that
 * genuinely need a connection still report a missing datasource.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  ...(process.env.DATABASE_URL
    ? { datasource: { url: process.env.DATABASE_URL } }
    : {}),
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
})
