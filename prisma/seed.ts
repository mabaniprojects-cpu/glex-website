/**
 * Database seed.
 *
 * Reference data (categories, offices, routes, email templates, FAQs) is always
 * seeded and is safe for production. Demonstration accounts and sample content
 * are created ONLY when SEED_DEMO_DATA=true and NODE_ENV is not production —
 * every such record is flagged `isDemo`/`isSample` so it can be filtered or
 * removed from the admin portal.
 */
import 'dotenv/config'
import {
  ContentStatus,
  Incoterm,
  Locale,
  OrganizationType,
  RfqStatus,
  ShipmentMode,
  ShipmentStatus,
  SupplierKind,
  SupplierStatus,
  UnitOfMeasure,
  UserRole,
} from '@prisma/client'
import { db } from '../src/lib/db'
import { GLEX_COMPANY } from '../src/lib/company'
import { hashPassword, isStrongPassword } from '../src/lib/password'
import { formatReference } from '../src/lib/references'
import { slugify } from '../src/lib/utils'

const DEMO_ENABLED =
  process.env.SEED_DEMO_DATA === 'true' && process.env.NODE_ENV !== 'production'

const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? 'GlexDemo!2026'

// --- Reference data ---------------------------------------------------------

const CATEGORIES: ReadonlyArray<{ name: string; icon: string }> = [
  { name: 'Cement and Concrete Products', icon: 'blocks' },
  { name: 'Steel and Reinforcement', icon: 'bar-chart-3' },
  { name: 'Electrical Products', icon: 'zap' },
  { name: 'Plumbing Products', icon: 'droplets' },
  { name: 'HVAC Products', icon: 'wind' },
  { name: 'Tiles and Ceramics', icon: 'grid-3x3' },
  { name: 'Marble and Stone', icon: 'gem' },
  { name: 'Glass and Aluminum', icon: 'square' },
  { name: 'Doors and Windows', icon: 'door-open' },
  { name: 'Paints and Coatings', icon: 'paint-bucket' },
  { name: 'Waterproofing', icon: 'umbrella' },
  { name: 'Insulation', icon: 'layers' },
  { name: 'Sanitary Ware', icon: 'bath' },
  { name: 'Lighting', icon: 'lightbulb' },
  { name: 'Fire and Safety Systems', icon: 'flame' },
  { name: 'Landscaping Materials', icon: 'trees' },
  { name: 'Furniture and Fit-Out', icon: 'armchair' },
  { name: 'Renewable Energy Products', icon: 'sun' },
  { name: 'Construction Equipment', icon: 'truck' },
  { name: 'Tools and Accessories', icon: 'wrench' },
]

/** Indicative destination markets for the animated homepage map. */
const ROUTES: ReadonlyArray<{
  label: string
  destName: string
  destLat: number
  destLng: number
  mode: ShipmentMode
}> = [
  { label: 'Jeddah → Rotterdam', destName: 'Rotterdam', destLat: 51.9244, destLng: 4.4777, mode: ShipmentMode.OCEAN },
  { label: 'Jeddah → Shanghai', destName: 'Shanghai', destLat: 31.2304, destLng: 121.4737, mode: ShipmentMode.OCEAN },
  { label: 'Jeddah → Mumbai', destName: 'Mumbai', destLat: 19.076, destLng: 72.8777, mode: ShipmentMode.OCEAN },
  { label: 'Jeddah → Durban', destName: 'Durban', destLat: -29.8587, destLng: 31.0218, mode: ShipmentMode.OCEAN },
  { label: 'Jeddah → Hamburg', destName: 'Hamburg', destLat: 53.5511, destLng: 9.9937, mode: ShipmentMode.OCEAN },
  { label: 'Jeddah → Singapore', destName: 'Singapore', destLat: 1.3521, destLng: 103.8198, mode: ShipmentMode.OCEAN },
  { label: 'Jeddah → New York', destName: 'New York', destLat: 40.7128, destLng: -74.006, mode: ShipmentMode.OCEAN },
  { label: 'Jeddah → Casablanca', destName: 'Casablanca', destLat: 33.5731, destLng: -7.5898, mode: ShipmentMode.OCEAN },
  { label: 'Jeddah → Istanbul', destName: 'Istanbul', destLat: 41.0082, destLng: 28.9784, mode: ShipmentMode.MULTIMODAL },
  { label: 'Jeddah → Nairobi', destName: 'Nairobi', destLat: -1.2921, destLng: 36.8219, mode: ShipmentMode.AIR },
]

const FAQS: ReadonlyArray<{ question: string; answer: string; category: string }> = [
  {
    category: 'RFQ',
    question: 'How do I submit a request for quotation?',
    answer:
      'Browse the marketplace, add the products you need to your RFQ, then enter quantities, destination and any project details before submitting. You will receive a reference number by email and can follow progress from your dashboard.',
  },
  {
    category: 'RFQ',
    question: 'Do I need an account to submit an RFQ?',
    answer:
      'No. Guest requests are accepted, but we will email you a verification link so we can confirm your address before the request is finalised. Creating an account lets you save drafts and track status.',
  },
  {
    category: 'Pricing',
    question: 'Why are prices not shown on the website?',
    answer:
      'Prices for building materials depend on specification, quantity, destination and Incoterm. GLEX prepares a written commercial offer for each request rather than publishing indicative figures.',
  },
  {
    category: 'Suppliers',
    question: 'How do I register as a supplier or distributor?',
    answer:
      'Complete the supplier registration form, which covers your company details, product capabilities, certifications and contacts. Our team reviews each application and responds by email. We never ask for banking details during registration.',
  },
  {
    category: 'Shipping',
    question: 'Which shipping methods does GLEX coordinate?',
    answer:
      'Ocean freight (FCL and LCL), air freight, road freight, rail and multimodal combinations. The right option depends on volume, destination and required delivery date.',
  },
  {
    category: 'Shipping',
    question: 'How do I track a shipment?',
    answer:
      'Use the tracking page with your GLEX shipment reference, container number, bill of lading or carrier tracking number. Clients with an account can also see all their shipments in the dashboard.',
  },
  {
    category: 'Documents',
    question: 'Which export documents are typically required?',
    answer:
      'A commercial invoice, packing list and certificate of origin are common to most shipments, alongside a bill of lading or air waybill. Requirements vary by destination and product category, and must be confirmed with the relevant authorities.',
  },
  {
    category: 'Contact',
    question: 'Where is GLEX based?',
    answer: `GLEX operates from ${GLEX_COMPANY.office.addressLines.slice(0, 3).join(', ')}, ${GLEX_COMPANY.office.city}, ${GLEX_COMPANY.office.country}. You can reach the office on ${GLEX_COMPANY.phoneDisplay}.`,
  },
]

const EMAIL_TEMPLATES: ReadonlyArray<{ key: string; subject: string; heading: string; body: string }> = [
  { key: 'welcome', subject: 'Welcome to GLEX', heading: 'Welcome to GLEX', body: 'Your account has been created. You can now build RFQs, follow shipments and manage your documents.' },
  { key: 'email-verification', subject: 'Verify your email address', heading: 'Confirm your email', body: 'Please confirm your email address to activate your GLEX account.' },
  { key: 'password-reset', subject: 'Reset your GLEX password', heading: 'Password reset', body: 'A password reset was requested for your account. If this was not you, no action is needed.' },
  { key: 'supplier-submitted', subject: 'Supplier application received', heading: 'Application received', body: 'Thank you for registering. Our team will review your application and respond by email.' },
  { key: 'supplier-clarification', subject: 'Additional information required', heading: 'Clarification required', body: 'We need some additional information before we can complete our review.' },
  { key: 'supplier-approved', subject: 'Your GLEX supplier application is approved', heading: 'Application approved', body: 'Your company has been approved. You can now manage your catalogue and receive sourcing opportunities.' },
  { key: 'supplier-rejected', subject: 'Update on your GLEX supplier application', heading: 'Application update', body: 'Thank you for your interest. On this occasion we are unable to proceed with your application.' },
  { key: 'client-registered', subject: 'Your GLEX account is ready', heading: 'Account created', body: 'Your client account is active. Explore the marketplace and submit your first request for quotation.' },
  { key: 'rfq-submitted', subject: 'We have received your request for quotation', heading: 'RFQ received', body: 'Thank you. Your request has been logged and our team will respond shortly.' },
  { key: 'rfq-clarification', subject: 'Clarification required on your RFQ', heading: 'Clarification required', body: 'We need a little more detail before we can prepare your quotation.' },
  { key: 'quotation-available', subject: 'Your quotation is ready', heading: 'Quotation available', body: 'Your commercial offer is ready to review in your dashboard.' },
  { key: 'rfq-accepted', subject: 'Quotation accepted', heading: 'Thank you', body: 'We have recorded your acceptance and will proceed with sourcing and logistics.' },
  { key: 'shipment-created', subject: 'Your shipment has been booked', heading: 'Shipment created', body: 'A shipment has been created for your order. You can follow its progress at any time.' },
  { key: 'shipment-departed', subject: 'Your shipment has departed', heading: 'Shipment departed', body: 'Your shipment has departed the origin port.' },
  { key: 'shipment-delayed', subject: 'Update: your shipment is delayed', heading: 'Shipment delayed', body: 'We are tracking a delay on your shipment and will update you as soon as we have more information.' },
  { key: 'shipment-exception', subject: 'Action may be required on your shipment', heading: 'Shipment exception', body: 'An exception has been recorded against your shipment. Our team is reviewing it.' },
  { key: 'shipment-delivered', subject: 'Your shipment has been delivered', heading: 'Shipment delivered', body: 'Your shipment has been delivered. Thank you for working with GLEX.' },
  { key: 'contact-received', subject: 'We have received your message', heading: 'Message received', body: 'Thank you for contacting GLEX. Our team will respond as soon as possible.' },
  { key: 'support-response', subject: 'Update on your support request', heading: 'Support update', body: 'There is a new response on your support request.' },
  { key: 'team-invitation', subject: 'You have been invited to a GLEX team', heading: 'Team invitation', body: 'You have been invited to join an organization on GLEX.' },
]

// --- Seeding ----------------------------------------------------------------

async function seedReferenceData() {
  console.log('· office, routes, categories, FAQs, email templates')

  await db.office.upsert({
    where: { id: '00000000-0000-4000-8000-000000000001' },
    create: {
      id: '00000000-0000-4000-8000-000000000001',
      name: GLEX_COMPANY.office.name,
      addressLines: [...GLEX_COMPANY.office.addressLines],
      city: GLEX_COMPANY.office.city,
      country: GLEX_COMPANY.office.country,
      poBox: GLEX_COMPANY.office.poBox,
      postalCode: GLEX_COMPANY.office.postalCode,
      phone: GLEX_COMPANY.phoneDisplay,
      latitude: GLEX_COMPANY.office.latitude,
      longitude: GLEX_COMPANY.office.longitude,
      isPrimary: true,
      businessHours: [
        { day: 'sunday', open: '09:00', close: '18:00' },
        { day: 'monday', open: '09:00', close: '18:00' },
        { day: 'tuesday', open: '09:00', close: '18:00' },
        { day: 'wednesday', open: '09:00', close: '18:00' },
        { day: 'thursday', open: '09:00', close: '18:00' },
        { day: 'friday', open: null, close: null },
        { day: 'saturday', open: null, close: null },
      ],
    },
    update: {},
  })

  for (const [index, route] of ROUTES.entries()) {
    await db.globalRoute.upsert({
      where: { id: `00000000-0000-4000-8100-${String(index).padStart(12, '0')}` },
      create: {
        id: `00000000-0000-4000-8100-${String(index).padStart(12, '0')}`,
        label: route.label,
        originName: GLEX_COMPANY.office.city,
        originLat: GLEX_COMPANY.office.latitude,
        originLng: GLEX_COMPANY.office.longitude,
        destName: route.destName,
        destLat: route.destLat,
        destLng: route.destLng,
        mode: route.mode,
        sortOrder: index,
      },
      update: {},
    })
  }

  for (const [index, category] of CATEGORIES.entries()) {
    await db.category.upsert({
      where: { slug: slugify(category.name) },
      create: {
        slug: slugify(category.name),
        name: category.name,
        icon: category.icon,
        sortOrder: index,
      },
      update: { icon: category.icon, sortOrder: index },
    })
  }

  for (const [index, faq] of FAQS.entries()) {
    const existing = await db.faqEntry.findFirst({
      where: { question: faq.question, locale: Locale.en },
    })
    if (!existing) {
      await db.faqEntry.create({
        data: { ...faq, locale: Locale.en, sortOrder: index },
      })
    }
  }

  for (const template of EMAIL_TEMPLATES) {
    await db.emailTemplate.upsert({
      where: { key_locale: { key: template.key, locale: Locale.en } },
      create: { ...template, locale: Locale.en },
      update: {},
    })
  }
}

async function seedDemoData() {
  console.log('· demo accounts, catalogue, RFQ, shipment, news')

  if (!isStrongPassword(DEMO_PASSWORD)) {
    throw new Error(
      'SEED_DEMO_PASSWORD does not meet the password policy (10+ characters, a letter and a digit).'
    )
  }
  const passwordHash = await hashPassword(DEMO_PASSWORD)
  const verified = new Date()

  // --- Internal ---
  const glexOrg = await db.organization.upsert({
    where: { slug: 'glex-internal' },
    create: {
      slug: 'glex-internal',
      name: GLEX_COMPANY.displayName,
      type: OrganizationType.INTERNAL,
      country: GLEX_COMPANY.office.country,
      city: GLEX_COMPANY.office.city,
      crNumber: GLEX_COMPANY.crNumber,
      phone: GLEX_COMPANY.phoneDisplay,
    },
    update: {},
  })

  const admin = await db.user.upsert({
    where: { email: 'admin@glex.demo' },
    create: {
      email: 'admin@glex.demo',
      name: 'GLEX Super Admin (Demo)',
      passwordHash,
      emailVerified: verified,
      role: UserRole.SUPER_ADMIN,
      organizationId: glexOrg.id,
    },
    update: {},
  })

  // --- Client organization ---
  const clientOrg = await db.organization.upsert({
    where: { slug: 'demo-contracting' },
    create: {
      slug: 'demo-contracting',
      name: 'Demo Contracting Co.',
      type: OrganizationType.CLIENT,
      country: 'United Arab Emirates',
      city: 'Dubai',
    },
    update: {},
  })

  const client = await db.user.upsert({
    where: { email: 'client@glex.demo' },
    create: {
      email: 'client@glex.demo',
      name: 'Demo Client',
      passwordHash,
      emailVerified: verified,
      role: UserRole.CLIENT_ORG_ADMIN,
      organizationId: clientOrg.id,
    },
    update: {},
  })

  await db.clientProfile.upsert({
    where: { userId: client.id },
    create: {
      userId: client.id,
      clientType: 'CONTRACTOR',
      companyName: clientOrg.name,
      country: 'United Arab Emirates',
      city: 'Dubai',
      industry: 'Construction',
    },
    update: {},
  })

  // --- Suppliers (one approved, one pending) ---
  const approvedOrg = await db.organization.upsert({
    where: { slug: 'demo-approved-supplier' },
    create: {
      slug: 'demo-approved-supplier',
      name: 'Demo Saudi Materials Factory',
      type: OrganizationType.SUPPLIER,
      country: 'Saudi Arabia',
      city: 'Jeddah',
    },
    update: {},
  })

  const approvedSupplier = await db.supplierProfile.upsert({
    where: { organizationId: approvedOrg.id },
    create: {
      organizationId: approvedOrg.id,
      status: SupplierStatus.APPROVED,
      kind: SupplierKind.SUPPLIER,
      legalName: approvedOrg.name,
      country: 'Saudi Arabia',
      city: 'Jeddah',
      isManufacturer: true,
      completionPercent: 100,
      submittedAt: new Date(),
      reviewedAt: new Date(),
      reviewedById: admin.id,
      declarationAccepted: true,
      declarationAt: new Date(),
      availableIncoterms: [Incoterm.EXW, Incoterm.FOB, Incoterm.CIF],
      marketsServed: ['GCC', 'East Africa', 'South Asia'],
    },
    update: {},
  })

  await db.user.upsert({
    where: { email: 'supplier@glex.demo' },
    create: {
      email: 'supplier@glex.demo',
      name: 'Demo Approved Supplier',
      passwordHash,
      emailVerified: verified,
      role: UserRole.APPROVED_SUPPLIER,
      organizationId: approvedOrg.id,
    },
    update: {},
  })

  const pendingOrg = await db.organization.upsert({
    where: { slug: 'demo-pending-supplier' },
    create: {
      slug: 'demo-pending-supplier',
      name: 'Demo Pending Supplier Co.',
      type: OrganizationType.SUPPLIER,
      country: 'Saudi Arabia',
      city: 'Riyadh',
    },
    update: {},
  })

  await db.supplierProfile.upsert({
    where: { organizationId: pendingOrg.id },
    create: {
      organizationId: pendingOrg.id,
      status: SupplierStatus.SUBMITTED,
      kind: SupplierKind.BOTH,
      legalName: pendingOrg.name,
      country: 'Saudi Arabia',
      city: 'Riyadh',
      isDistributor: true,
      completionPercent: 70,
      submittedAt: new Date(),
      declarationAccepted: true,
      declarationAt: new Date(),
    },
    update: {},
  })

  await db.user.upsert({
    where: { email: 'pending-supplier@glex.demo' },
    create: {
      email: 'pending-supplier@glex.demo',
      name: 'Demo Pending Supplier',
      passwordHash,
      emailVerified: verified,
      role: UserRole.PENDING_SUPPLIER,
      organizationId: pendingOrg.id,
    },
    update: {},
  })

  // --- Catalogue ---
  const categories = await db.category.findMany({ orderBy: { sortOrder: 'asc' } })
  const byName = (name: string) => categories.find((c) => c.name === name)!

  const SAMPLE_PRODUCTS = [
    {
      name: 'Ordinary Portland Cement Type I (Sample)',
      category: 'Cement and Concrete Products',
      unit: UnitOfMeasure.TON,
      moq: 25,
      lead: 14,
      short: 'Sample catalogue entry — bulk or bagged Portland cement for general construction.',
    },
    {
      name: 'Deformed Steel Reinforcement Bar B500B (Sample)',
      category: 'Steel and Reinforcement',
      unit: UnitOfMeasure.TON,
      moq: 20,
      lead: 21,
      short: 'Sample catalogue entry — ribbed reinforcement bar in standard diameters.',
    },
    {
      name: 'Porcelain Floor Tile 600×600 (Sample)',
      category: 'Tiles and Ceramics',
      unit: UnitOfMeasure.SQUARE_METER,
      moq: 500,
      lead: 18,
      short: 'Sample catalogue entry — rectified porcelain floor tile for commercial interiors.',
    },
    {
      name: 'Bituminous Waterproofing Membrane 4mm (Sample)',
      category: 'Waterproofing',
      unit: UnitOfMeasure.ROLL,
      moq: 200,
      lead: 12,
      short: 'Sample catalogue entry — torch-applied SBS modified bituminous membrane.',
    },
    {
      name: 'Architectural Aluminium Profile System (Sample)',
      category: 'Glass and Aluminum',
      unit: UnitOfMeasure.METER,
      moq: 1000,
      lead: 25,
      short: 'Sample catalogue entry — powder-coated aluminium profiles for façades and windows.',
    },
    {
      name: 'LED High Bay Luminaire 150W (Sample)',
      category: 'Lighting',
      unit: UnitOfMeasure.PIECE,
      moq: 100,
      lead: 20,
      short: 'Sample catalogue entry — industrial LED high bay fitting for warehouses.',
    },
  ]

  for (const [index, product] of SAMPLE_PRODUCTS.entries()) {
    await db.product.upsert({
      where: { slug: slugify(product.name) },
      create: {
        slug: slugify(product.name),
        name: product.name,
        shortDescription: product.short,
        description: `${product.short}\n\nThis is demonstration content created by the seed script. Replace or remove it from the admin portal before going live.`,
        categoryId: byName(product.category).id,
        supplierId: approvedSupplier.id,
        countryOfOrigin: 'Saudi Arabia',
        isSaudiMade: true,
        minimumOrderQty: product.moq,
        leadTimeDays: product.lead,
        availableUnits: [product.unit],
        isFeatured: index < 3,
        specifications: [
          { key: 'Standard', value: 'Sample specification' },
          { key: 'Packaging', value: 'As agreed per order' },
        ],
      },
      update: {},
    })
  }

  // --- RFQ ---
  const year = new Date().getFullYear()
  const rfqReference = formatReference('RFQ', year, 1)
  const firstProduct = await db.product.findFirst({ orderBy: { createdAt: 'asc' } })

  const existingRfq = await db.rFQ.findUnique({ where: { reference: rfqReference } })
  if (!existingRfq && firstProduct) {
    await db.referenceCounter.upsert({
      where: { scope_year: { scope: 'RFQ', year } },
      create: { scope: 'RFQ', year, value: 1 },
      update: { value: 1 },
    })

    await db.rFQ.create({
      data: {
        reference: rfqReference,
        status: RfqStatus.UNDER_REVIEW,
        createdById: client.id,
        organizationId: clientOrg.id,
        destinationCountry: 'United Arab Emirates',
        destinationCity: 'Dubai',
        destinationPort: 'Jebel Ali',
        incoterm: Incoterm.CIF,
        projectName: 'Demo Residential Tower',
        notes: 'Demonstration RFQ created by the seed script.',
        submittedAt: new Date(),
        items: {
          create: [
            {
              productId: firstProduct.id,
              name: firstProduct.name,
              quantity: 120,
              unit: UnitOfMeasure.TON,
              sortOrder: 0,
            },
          ],
        },
        activities: {
          create: [
            { actorId: client.id, action: 'SUBMITTED', toStatus: RfqStatus.SUBMITTED },
            {
              actorId: admin.id,
              action: 'STATUS_CHANGED',
              fromStatus: RfqStatus.SUBMITTED,
              toStatus: RfqStatus.UNDER_REVIEW,
            },
          ],
        },
      },
    })
  }

  // --- Shipment ---
  const shipmentReference = formatReference('SHP', year, 1)
  const existingShipment = await db.shipment.findUnique({ where: { reference: shipmentReference } })

  if (!existingShipment) {
    await db.referenceCounter.upsert({
      where: { scope_year: { scope: 'SHP', year } },
      create: { scope: 'SHP', year, value: 1 },
      update: { value: 1 },
    })

    const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000)

    await db.shipment.create({
      data: {
        reference: shipmentReference,
        status: ShipmentStatus.IN_TRANSIT,
        mode: ShipmentMode.OCEAN,
        organizationId: clientOrg.id,
        originCountry: 'Saudi Arabia',
        originCity: 'Jeddah',
        originPort: 'Jeddah Islamic Port',
        destinationCountry: 'United Arab Emirates',
        destinationCity: 'Dubai',
        destinationPort: 'Jebel Ali',
        carrier: 'Demo Carrier Line',
        containerNumber: 'DEMU1234567',
        billOfLading: 'DEMOBL0000001',
        estimatedDeparture: daysAgo(9),
        actualDeparture: daysAgo(8),
        estimatedArrival: new Date(Date.now() + 4 * 86_400_000),
        progressPercent: 62,
        provider: 'internal',
        isDemo: true,
        events: {
          create: [
            { status: ShipmentStatus.BOOKING_CREATED, title: 'Booking created', occurredAt: daysAgo(14), dedupeKey: 'seed-1' },
            { status: ShipmentStatus.COLLECTED, title: 'Cargo collected', location: 'Jeddah', occurredAt: daysAgo(12), dedupeKey: 'seed-2' },
            { status: ShipmentStatus.EXPORT_DOCUMENTATION, title: 'Export documentation prepared', location: 'Jeddah', occurredAt: daysAgo(11), dedupeKey: 'seed-3' },
            { status: ShipmentStatus.AT_ORIGIN_PORT, title: 'Arrived at origin port', location: 'Jeddah Islamic Port', occurredAt: daysAgo(10), dedupeKey: 'seed-4' },
            { status: ShipmentStatus.LOADED, title: 'Loaded on vessel', location: 'Jeddah Islamic Port', occurredAt: daysAgo(9), dedupeKey: 'seed-5' },
            { status: ShipmentStatus.DEPARTED, title: 'Vessel departed', location: 'Jeddah Islamic Port', occurredAt: daysAgo(8), dedupeKey: 'seed-6' },
            { status: ShipmentStatus.IN_TRANSIT, title: 'In transit', occurredAt: daysAgo(3), dedupeKey: 'seed-7' },
          ],
        },
      },
    })
  }

  // --- News ---
  const newsCategories = [
    'Company News',
    'Saudi Exports',
    'Global Markets',
    'Logistics',
    'Construction Materials',
    'Partnerships',
    'Events',
    'Industry Insights',
  ]

  for (const [index, name] of newsCategories.entries()) {
    await db.newsCategory.upsert({
      where: { slug: slugify(name) },
      create: { slug: slugify(name), name, sortOrder: index },
      update: {},
    })
  }

  const companyNews = await db.newsCategory.findUnique({ where: { slug: slugify('Company News') } })

  const SAMPLE_ARTICLES = [
    {
      title: 'Sample: GLEX launches its digital export platform',
      summary:
        'A demonstration article describing the launch of the GLEX platform for sourcing, RFQ management and shipment visibility.',
    },
    {
      title: 'Sample: Understanding Incoterms for building-material exports',
      summary:
        'A demonstration article outlining how Incoterms allocate cost and risk between buyer and seller.',
    },
    {
      title: 'Sample: Preparing export documentation from Saudi Arabia',
      summary:
        'A demonstration article covering the commercial documents commonly required for export shipments.',
    },
  ]

  for (const [index, article] of SAMPLE_ARTICLES.entries()) {
    await db.newsArticle.upsert({
      where: { slug: slugify(article.title) },
      create: {
        slug: slugify(article.title),
        title: article.title,
        summary: article.summary,
        body: `${article.summary}\n\nThis article is sample content generated by the seed script so that the news system can be demonstrated. It does not describe real events, partnerships or achievements, and can be edited or deleted from the admin portal.`,
        status: ContentStatus.PUBLISHED,
        publishedAt: new Date(Date.now() - index * 86_400_000),
        isFeatured: index === 0,
        isSample: true,
        readingMinutes: 3,
        categoryId: companyNews?.id,
        authorId: admin.id,
      },
      update: {},
    })
  }

  // --- Announcement ---
  const announcementId = '00000000-0000-4000-8200-000000000001'
  await db.announcement.upsert({
    where: { id: announcementId },
    create: {
      id: announcementId,
      message: 'Demo environment — sample content is clearly labelled and editable in the admin portal.',
      variant: 'info',
      isActive: true,
    },
    update: {},
  })

  console.log('\n  Demo accounts (local development only):')
  for (const email of [
    'admin@glex.demo',
    'client@glex.demo',
    'supplier@glex.demo',
    'pending-supplier@glex.demo',
  ]) {
    console.log(`    ${email.padEnd(30)} ${DEMO_PASSWORD}`)
  }
}

async function main() {
  console.log('Seeding GLEX database…\n')

  await seedReferenceData()

  if (DEMO_ENABLED) {
    await seedDemoData()
  } else {
    console.log('· demo data skipped (SEED_DEMO_DATA is not "true", or NODE_ENV=production)')
  }

  console.log('\nSeed complete.')
}

main()
  .then(() => db.$disconnect())
  .catch(async (error) => {
    console.error('Seed failed:', error)
    await db.$disconnect()
    process.exit(1)
  })
