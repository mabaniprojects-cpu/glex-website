/**
 * What the supplier data-collection workbook asks for, and the values its
 * dropdowns offer.
 *
 * Kept apart from the generator so the question set can be reviewed without
 * reading spreadsheet plumbing, and so the importer that reads the returned
 * file can share these exact lists. A dropdown whose options drift from what
 * the importer accepts produces a file that looks correct and fails to load.
 *
 * Every column states which database field it feeds. Columns marked
 * `needsSchema` have NO home in the schema yet — price, packing and the
 * dimensions the container-fit feature will need. They are collected
 * deliberately: the sheet is sized for where this is going, and the migration
 * follows. Until it lands those columns import into nothing.
 */

/** The nine live categories, from `scripts/catalogue-data.ts`. */
export const CATEGORIES = [
  'Steel & Metals',
  'Electrical & MEP',
  'Cement & Related',
  'Blocks & Precast',
  'Insulation & Waterproofing',
  'Chemicals & Special Items',
  'Infrastructure Materials',
  'Modular & Prefab',
  'Finishing Materials',
] as const

/** `UnitOfMeasure` in prisma/schema.prisma, in the words a supplier uses. */
export const UNITS = [
  'Piece',
  'Box',
  'Carton',
  'Pack',
  'Pallet',
  'Kilogram',
  'Ton',
  'Meter',
  'Square meter',
  'Cubic meter',
  'Roll',
  'Set',
  'Container',
] as const

/** `Incoterm` in prisma/schema.prisma. A price without one means nothing. */
export const INCOTERMS = [
  'EXW - Ex Works',
  'FCA - Free Carrier',
  'FOB - Free On Board',
  'CFR - Cost and Freight',
  'CIF - Cost, Insurance and Freight',
  'CPT - Carriage Paid To',
  'CIP - Carriage and Insurance Paid To',
  'DAP - Delivered At Place',
  'DPU - Delivered At Place Unloaded',
  'DDP - Delivered Duty Paid',
] as const

export const CURRENCIES = ['SAR', 'USD', 'EUR'] as const

/**
 * How the goods are presented for loading.
 *
 * This list exists because `Product.packaging` is free text today, and free
 * text cannot be stacked into a container by a calculator. Each option is a
 * shape a loading plan can reason about.
 */
export const PACKING_METHODS = [
  'Carton',
  'Wooden crate',
  'Wooden box',
  'Pallet (shrink-wrapped)',
  'Pallet (strapped)',
  'Bundle',
  'Coil',
  'Roll',
  'Drum',
  'Bag',
  'Big bag (FIBC)',
  'IBC tote',
  'Loose / bulk',
] as const

/** Common origins; the field accepts anything, so the list is a convenience. */
export const ORIGINS = [
  'Saudi Arabia',
  'United Arab Emirates',
  'Bahrain',
  'Kuwait',
  'Oman',
  'Qatar',
  'Egypt',
  'Jordan',
  'Turkey',
  'India',
  'China',
  'Germany',
  'Italy',
  'Spain',
  'United Kingdom',
  'Other',
] as const

export const YES_NO = ['Yes', 'No'] as const

export type ColumnSpec = {
  header: string
  /** Shown in the Read me, and as a cell note on the header. */
  help: string
  /** The database field this feeds, or why it has none yet. */
  maps: string
  width: number
  required?: boolean
  list?: readonly string[]
  /** Free typing allowed alongside the list — a warning, not a refusal. */
  listIsSuggestion?: boolean
  numeric?: boolean
  date?: boolean
  /** No column in the schema accepts this yet. */
  needsSchema?: boolean
  /** One realistic value, for the worked example row. */
  example: string | number
}

export const PRODUCT_COLUMNS: readonly ColumnSpec[] = [
  {
    header: 'Product name (English)',
    help: 'The name a buyer would recognise. Include grade or standard where it distinguishes the product.',
    maps: 'Product.name',
    width: 38,
    required: true,
    example: 'Steel Rebar B500B, 16mm',
  },
  {
    header: 'Product name (Arabic)',
    help: 'Optional. Left blank, the English name is shown to Arabic visitors.',
    maps: 'ProductTranslation.name (locale ar)',
    width: 30,
    example: 'حديد تسليح B500B مقاس 16 مم',
  },
  {
    header: 'Category',
    help: 'Pick the closest. If nothing fits, tell us rather than forcing it.',
    maps: 'Product.categoryId',
    width: 26,
    required: true,
    list: CATEGORIES,
    example: 'Steel & Metals',
  },
  {
    header: 'Brand',
    help: 'Buyers filter by brand on the website.',
    maps: 'Product.brand (marketplace filter)',
    width: 20,
    example: 'Hadeed',
  },
  {
    header: 'Manufacturer',
    help: 'If different from the brand.',
    maps: 'Product.manufacturer',
    width: 22,
    example: 'Saudi Iron & Steel Co.',
  },
  {
    header: 'Country of origin',
    help: 'Where the goods are produced. Drives the origin filter and the certificate of origin.',
    maps: 'Product.countryOfOrigin (marketplace filter)',
    width: 20,
    required: true,
    list: ORIGINS,
    listIsSuggestion: true,
    example: 'Saudi Arabia',
  },
  {
    header: 'Saudi made?',
    help: 'Yes only if it qualifies as Saudi origin. It earns a badge on the website.',
    maps: 'Product.isSaudiMade (marketplace filter)',
    width: 13,
    required: true,
    list: YES_NO,
    example: 'Yes',
  },
  {
    header: 'HS code',
    help: 'Six digits or more. Drives customs classification — please check it rather than guessing.',
    maps: 'Product.hsCode',
    width: 16,
    required: true,
    example: '7214.20',
  },
  {
    header: 'Short description',
    help: 'One or two sentences. What it is, what it is used for.',
    maps: 'Product.shortDescription',
    width: 46,
    example: 'Hot-rolled ribbed reinforcement bar to BS 4449:2005 Grade B500B.',
  },
  {
    header: 'Unit of sale',
    help: 'The unit your price below refers to.',
    maps: 'Product.availableUnits',
    width: 16,
    required: true,
    list: UNITS,
    example: 'Ton',
  },
  {
    header: 'Minimum order qty',
    help: 'In the unit of sale above.',
    maps: 'Product.minimumOrderQty',
    width: 16,
    numeric: true,
    example: 25,
  },
  {
    header: 'Price per unit',
    help: 'Numbers only — no currency symbol. Indicative is fine; tell us how long it holds.',
    maps: 'NEW FIELD — no price column exists on Product yet',
    width: 14,
    numeric: true,
    needsSchema: true,
    example: 2450,
  },
  {
    header: 'Currency',
    help: 'The currency of the price.',
    maps: 'NEW FIELD',
    width: 11,
    list: CURRENCIES,
    needsSchema: true,
    example: 'SAR',
  },
  {
    header: 'Price basis (Incoterm)',
    help: 'A price without an Incoterm cannot be compared with another supplier.',
    maps: 'NEW FIELD',
    width: 34,
    list: INCOTERMS,
    needsSchema: true,
    example: 'FOB - Free On Board',
  },
  {
    header: 'Price valid until',
    help: 'Date, DD/MM/YYYY. Leave blank if the price is firm until you tell us otherwise.',
    maps: 'NEW FIELD',
    width: 16,
    date: true,
    needsSchema: true,
    example: '31/03/2027',
  },
  {
    header: 'Lead time (days)',
    help: 'From a confirmed order to goods ready for collection.',
    maps: 'Product.leadTimeDays',
    width: 15,
    numeric: true,
    example: 21,
  },
  {
    header: 'Packing method',
    help: 'How the goods are presented for loading.',
    maps: 'NEW FIELD — Product.packaging is free text and cannot be calculated with',
    width: 24,
    required: true,
    list: PACKING_METHODS,
    needsSchema: true,
    example: 'Bundle',
  },
  {
    header: 'Units per pack',
    help: 'How many units of sale are in one pack, bundle or pallet.',
    maps: 'NEW FIELD',
    width: 14,
    numeric: true,
    needsSchema: true,
    example: 2,
  },
  {
    header: 'Pack length (cm)',
    help: 'The packed unit, not the bare product.',
    maps: 'NEW FIELD — needed to calculate container loading',
    width: 15,
    numeric: true,
    needsSchema: true,
    example: 1200,
  },
  {
    header: 'Pack width (cm)',
    help: 'The packed unit, not the bare product.',
    maps: 'NEW FIELD — needed to calculate container loading',
    width: 15,
    numeric: true,
    needsSchema: true,
    example: 120,
  },
  {
    header: 'Pack height (cm)',
    help: 'The packed unit, not the bare product.',
    maps: 'NEW FIELD — needed to calculate container loading',
    width: 15,
    numeric: true,
    needsSchema: true,
    example: 60,
  },
  {
    header: 'Pack gross weight (kg)',
    help: 'Including the packing itself. Containers hit a weight limit long before they fill up.',
    maps: 'NEW FIELD — needed to calculate container loading',
    width: 18,
    numeric: true,
    needsSchema: true,
    example: 2000,
  },
  {
    header: 'Packs per pallet',
    help: 'Leave blank if the item is not palletised.',
    maps: 'NEW FIELD',
    width: 14,
    numeric: true,
    needsSchema: true,
    example: '',
  },
  {
    header: 'Stackable?',
    help: 'Can an identical pack be loaded on top of this one?',
    maps: 'NEW FIELD — a non-stackable item wastes the container above it',
    width: 12,
    list: YES_NO,
    needsSchema: true,
    example: 'Yes',
  },
  {
    header: 'Certifications',
    help: 'Separate several with a semicolon. For example: SASO; ISO 9001.',
    maps: 'Product.certifications',
    width: 26,
    example: 'SASO; ISO 9001',
  },
  {
    header: 'Notes',
    help: 'Anything that does not fit above — grade variants, seasonal pricing, tooling costs.',
    maps: 'Product.description',
    width: 34,
    example: 'Also available in 12mm, 18mm, 20mm and 25mm at the same price per ton.',
  },
]

/**
 * The company questions.
 *
 * Most of these already exist on `SupplierProfile` from registration. They are
 * repeated because the registration form is often filled in a hurry by whoever
 * created the account, and this sheet is usually completed by someone who
 * knows the answers. The importer treats the sheet as the newer truth, but
 * flags any field that disagrees rather than overwriting silently.
 */
export const COMPANY_FIELDS: readonly {
  label: string
  maps: string
  help?: string
  list?: readonly string[]
  required?: boolean
  example: string
}[] = [
  { label: 'Legal company name', maps: 'SupplierProfile.legalName', required: true, example: 'Example Building Materials Co. Ltd.' },
  { label: 'Trading name', maps: 'SupplierProfile.tradingName', example: 'Example Materials' },
  { label: 'Country', maps: 'SupplierProfile.country', required: true, list: ORIGINS, example: 'Saudi Arabia' },
  { label: 'City', maps: 'SupplierProfile.city', example: 'Jeddah' },
  { label: 'Address', maps: 'SupplierProfile.address', example: 'Industrial City Phase 3, Street 12' },
  { label: 'Website', maps: 'SupplierProfile.website', example: 'https://example.com.sa' },
  { label: 'Commercial registration (CR) number', maps: 'SupplierProfile.crNumber', required: true, example: '4030XXXXXX' },
  { label: 'VAT number', maps: 'SupplierProfile.vatNumber', example: '3105XXXXXXXXXXX' },
  { label: 'Year established', maps: 'SupplierProfile.yearEstablished', example: '1998' },
  { label: 'Number of employees', maps: 'SupplierProfile.employeeCount', example: '120' },
  { label: 'Are you the manufacturer?', maps: 'SupplierProfile.isManufacturer', list: YES_NO, required: true, example: 'Yes' },
  { label: 'Are you a distributor?', maps: 'SupplierProfile.isDistributor', list: YES_NO, required: true, example: 'No' },
  { label: 'Brands you supply', maps: 'SupplierProfile.brands', help: 'Separate several with a semicolon.', example: 'Hadeed; Example' },
  { label: 'Monthly production capacity', maps: 'SupplierProfile.monthlyCapacity', example: '8,000 tons' },
  { label: 'Markets you already export to', maps: 'SupplierProfile.marketsServed', help: 'Separate several with a semicolon.', example: 'Sudan; Egypt; Jordan' },
  { label: 'Incoterms you can quote', maps: 'SupplierProfile.availableIncoterms', help: 'Separate several with a semicolon.', example: 'EXW; FOB; CFR' },
  { label: 'Typical lead time', maps: 'SupplierProfile.leadTimeNotes', example: '3 to 4 weeks from confirmed order' },
  { label: 'Quality control process', maps: 'SupplierProfile.qualityControlNotes', example: 'Mill test certificate issued per heat; third-party inspection on request.' },
  { label: 'Loading port / point', maps: 'NEW FIELD', help: 'Where goods are collected or loaded. Needed to quote freight.', required: true, example: 'Jeddah Islamic Port' },
  { label: 'Contact name', maps: 'SupplierContact.name', required: true, example: 'Full name' },
  { label: 'Contact role', maps: 'SupplierContact.role', example: 'Export Sales Manager' },
  { label: 'Contact email', maps: 'SupplierContact.email', required: true, example: 'sales@example.com.sa' },
  { label: 'Contact phone', maps: 'SupplierContact.phone', required: true, example: '+966 5X XXX XXXX' },
]
