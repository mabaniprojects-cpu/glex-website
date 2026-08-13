import { existsSync } from 'node:fs'
import { cp, readdir, rm } from 'node:fs/promises'
import path from 'node:path'

/**
 * Assembles `.next/standalone` into something that can actually be deployed.
 *
 * Two things `next build` leaves undone, both of which fail quietly:
 *
 * 1. `server.js` does not serve `public/` or `.next/static` unless they are
 *    copied in. Miss this and the site boots, answers 200, and every
 *    stylesheet, script, font and image 404s — it looks like a broken CDN
 *    rather than a missing build step.
 *
 * 2. Next copies `.env` and `.env.production` into the standalone output
 *    unconditionally, outside the file-tracing system, so
 *    `outputFileTracingExcludes` cannot prevent it (see
 *    `writeStandaloneDirectory` in next/dist/build/index.js). On a machine that
 *    has a real `.env`, that means AUTH_SECRET, the database password and the
 *    SMTP password are written into the deployment artifact. This removes them.
 *
 * Configuration belongs to the platform's environment, not to a file baked into
 * an image. A build running in CI has no `.env` on disk and nothing is copied
 * in the first place — this script is the safety net for every other case.
 */

const root = process.cwd()
const standalone = path.join(root, '.next', 'standalone')

if (!existsSync(standalone)) {
  console.error(
    'No .next/standalone directory. Run `npm run build` first — and check that\n' +
      "next.config.ts still sets `output: 'standalone'`."
  )
  process.exit(1)
}

// --- 1. Strip anything secret that Next copied in -------------------------

const stripped = []
for (const entry of await readdir(standalone)) {
  if (entry === '.env' || entry.startsWith('.env.')) {
    await rm(path.join(standalone, entry), { force: true })
    stripped.push(entry)
  }
}

console.log(
  stripped.length
    ? `Removed from the artifact: ${stripped.join(', ')} — supply configuration through the environment instead.`
    : 'No .env files in the artifact (nothing to remove).'
)

// --- 2. Copy the assets server.js will not serve without --------------------

const staticSource = path.join(root, '.next', 'static')
if (!existsSync(staticSource)) {
  console.error('.next/static is missing; the build did not complete.')
  process.exit(1)
}

await cp(staticSource, path.join(standalone, '.next', 'static'), { recursive: true })
console.log('Copied .next/static')

if (existsSync(path.join(root, 'public'))) {
  await cp(path.join(root, 'public'), path.join(standalone, 'public'), { recursive: true })
  console.log('Copied public/')
}

// --- 3. Refuse to report success on an artifact that would 404 -------------

for (const required of ['server.js', path.join('.next', 'static')]) {
  if (!existsSync(path.join(standalone, required))) {
    console.error(`Expected ${required} in the artifact and it is not there.`)
    process.exit(1)
  }
}

console.log('\n.next/standalone is ready. Start it with:\n  node .next/standalone/server.js')
