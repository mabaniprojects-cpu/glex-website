import 'dotenv/config'
import { OrganizationType } from '@prisma/client'
import { db } from '../src/lib/db'
import { SUPPLIER_RECORDS } from './supplier-records'

/**
 * Records a supplier GLEX already works with.
 *
 *   npx tsx scripts/create-suppliers.mts            # dry run
 *   npx tsx scripts/create-suppliers.mts --confirm  # apply
 *
 * Creates an Organization and a SupplierProfile, and nothing else. In
 * particular it creates no user account: Bahra are not signing in, GLEX is
 * recording them, and an account nobody asked for is an unused credential.
 * If they later register properly, that flow owns the user and this record
 * is already waiting for it.
 *
 * Safe to run more than once: a slug that already exists is left alone, and
 * nothing is updated. A supplier whose details have changed should be
 * edited in the admin portal, where the change is attributed to a person.
 */

const confirmed = process.argv.includes('--confirm')

const existing = await db.organization.findMany({
  where: { slug: { in: SUPPLIER_RECORDS.map((record) => record.slug) } },
  select: { slug: true, name: true },
})
const taken = new Set(existing.map((row) => row.slug))

console.log(`${SUPPLIER_RECORDS.length} supplier record(s) defined\n`)

for (const record of SUPPLIER_RECORDS) {
  console.log(`  ${record.legalName}`)
  console.log(`    slug   : ${record.slug}`)
  console.log(`    status : ${record.status}`)
  console.log(`    now    : ${taken.has(record.slug) ? 'already exists — left alone' : 'not present'}`)
}

const toCreate = SUPPLIER_RECORDS.filter((record) => !taken.has(record.slug))

if (toCreate.length === 0) {
  console.log('\nNothing to do.')
  await db.$disconnect()
  process.exit(0)
}

if (!confirmed) {
  console.log(`\nDry run — nothing written. Re-run with --confirm to create ${toCreate.length}.`)
  await db.$disconnect()
  process.exit(0)
}

for (const record of toCreate) {
  await db.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: {
        slug: record.slug,
        name: record.legalName,
        type: OrganizationType.SUPPLIER,
        country: record.country,
        city: record.city ?? null,
        website: record.website ?? null,
        description: record.description ?? null,
      },
      select: { id: true },
    })

    const profile = await tx.supplierProfile.create({
      data: {
        organizationId: organization.id,
        status: record.status,
        kind: record.kind,
        legalName: record.legalName,
        tradingName: record.tradingName ?? null,
        country: record.country,
        city: record.city ?? null,
        website: record.website ?? null,
        description: record.description ?? null,
        isManufacturer: record.isManufacturer,
        isDistributor: record.isDistributor,
        brands: record.brands ?? [],
        marketsServed: record.marketsServed ?? [],
        availableIncoterms: record.availableIncoterms ?? [],
        monthlyCapacity: record.monthlyCapacity ?? null,
        qualityControlNotes: record.qualityControlNotes ?? null,
        loadingPort: record.loadingPort ?? null,
        // Where the details came from, so nobody later mistakes this for
        // something the supplier filled in themselves.
        internalNotes: record.sourceNote,
        // Reviewed by GLEX in the sense that GLEX wrote it; there is no
        // application to approve and no reviewer to name.
        reviewedAt: new Date(),
      },
      select: { id: true },
    })

    await tx.auditLog.create({
      data: {
        actorId: null,
        action: 'supplier.recorded_by_glex',
        entityType: 'SupplierProfile',
        entityId: profile.id,
        changes: { after: { legalName: record.legalName, source: record.sourceNote } },
      },
    })

    console.log(`\nCreated ${record.legalName}`)
    console.log(`  supplier id: ${profile.id}`)
    console.log(`  import at  : /en/admin/suppliers/${profile.id}/import`)
  })
}

await db.$disconnect()
