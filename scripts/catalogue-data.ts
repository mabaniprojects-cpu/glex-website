/**
 * The product catalogue, transcribed from "GLEX - Company Portfolio V01.pdf".
 *
 * Nine categories, fifty-four products. HS codes are exactly as the portfolio
 * states them — they were read from the PDF's raw text order, where the two
 * columns pair one-to-one, and each was checked against the HS heading it
 * claims (rebar 7214.20, wire rod 7213.91/99, billets 7207.19, and so on).
 *
 * A layout-preserving extraction of the same pages appears to shift the codes
 * down a row. That is an artifact of the two-column table, not an error in the
 * source. Do not "fix" these against that reading.
 *
 * HS codes drive customs classification, so treat this file as a transcription
 * of a customer document rather than as an authority. Corrections belong with
 * GLEX, and the portfolio should be updated alongside any change here.
 *
 * Arabic names are supplied because Arabic is a primary audience locale and the
 * terms are standard trade vocabulary. German, French and Chinese are absent on
 * purpose: `pickTranslation()` falls back to the base English name, which is
 * honest, where a machine translation of a technical material name would look
 * authoritative while being unreliable.
 */

export type CatalogueProduct = {
  readonly slug: string
  readonly name: string
  readonly nameAr: string
  /** Exactly as printed in the portfolio; may name two headings. */
  readonly hsCode: string
}

export type CatalogueCategory = {
  readonly slug: string
  readonly name: string
  readonly nameAr: string
  readonly products: readonly CatalogueProduct[]
}

export const CATALOGUE: readonly CatalogueCategory[] = [
  {
    slug: 'steel-and-metals',
    name: 'Steel & Metals',
    nameAr: 'الحديد والمعادن',
    products: [
      { slug: 'steel-rebar', name: 'Steel Rebar', nameAr: 'حديد التسليح', hsCode: '7214.20' },
      {
        slug: 'wire-rod',
        name: 'Wire Rod (Low/High Carbon)',
        nameAr: 'أسياخ الأسلاك (كربون منخفض/عالي)',
        hsCode: '7213.91 / 7213.99',
      },
      { slug: 'steel-billets', name: 'Steel Billets', nameAr: 'بيليت الصلب', hsCode: '7207.19' },
      {
        slug: 'structural-steel',
        name: 'Structural Steel (I/H Beams, Channels)',
        nameAr: 'الصلب الإنشائي (كمرات I/H، قنوات)',
        hsCode: '7216.32 / 7216.33',
      },
      {
        slug: 'steel-angles-and-channels',
        name: 'Steel Angles & Channels',
        nameAr: 'زوايا وقنوات الصلب',
        hsCode: '7216.10 / 7216.21',
      },
      {
        slug: 'galvanized-coils',
        name: 'Galvanized Coils',
        nameAr: 'لفائف مجلفنة',
        hsCode: '7210.49',
      },
      {
        slug: 'ppgi-prepainted-coils',
        name: 'PPGI - Prepainted Coils',
        nameAr: 'لفائف مطلية مسبقًا PPGI',
        hsCode: '7210.70',
      },
      {
        slug: 'steel-mesh',
        name: 'Steel Mesh (Welded Wire Mesh)',
        nameAr: 'شبك حديد ملحوم',
        hsCode: '7314.20',
      },
      {
        slug: 'steel-pipes-welded',
        name: 'Steel Pipes (Welded)',
        nameAr: 'أنابيب صلب ملحومة',
        hsCode: '7306.30',
      },
      {
        slug: 'gi-pipes',
        name: 'GI Pipes',
        nameAr: 'أنابيب حديد مجلفن',
        hsCode: '7306.30 / 7306.50',
      },
    ],
  },
  {
    slug: 'electrical-and-mep',
    name: 'Electrical & MEP',
    nameAr: 'الكهرباء والأعمال الميكانيكية',
    products: [
      {
        slug: 'electrical-power-cables',
        name: 'Electrical Power Cables',
        nameAr: 'كابلات الطاقة الكهربائية',
        hsCode: '8544.49',
      },
      {
        slug: 'control-cables',
        name: 'Control Cables',
        nameAr: 'كابلات التحكم',
        hsCode: '8544.49',
      },
      {
        slug: 'switchgear-and-panels',
        name: 'Switchgear & Panels',
        nameAr: 'لوحات ومفاتيح التوزيع',
        hsCode: '8537.10',
      },
      { slug: 'pvc-pipes', name: 'PVC Pipes', nameAr: 'أنابيب PVC', hsCode: '3917.23' },
      { slug: 'cpvc-pipes', name: 'CPVC Pipes', nameAr: 'أنابيب CPVC', hsCode: '3917.29' },
      { slug: 'ppr-pipes', name: 'PPR Pipes', nameAr: 'أنابيب PPR', hsCode: '3917.31' },
      { slug: 'hdpe-pipes', name: 'HDPE Pipes', nameAr: 'أنابيب HDPE', hsCode: '3917.21' },
      {
        slug: 'ducting-sheets-gi',
        name: 'Ducting Sheets (GI)',
        nameAr: 'ألواح مجاري الهواء (مجلفن)',
        hsCode: '7210.49',
      },
      {
        slug: 'hvac-units',
        name: 'HVAC Units (Package/Splits)',
        nameAr: 'وحدات تكييف (مجمعة/منفصلة)',
        hsCode: '8415.81 / 8415.10',
      },
      {
        slug: 'firefighting-systems',
        name: 'Firefighting Systems',
        nameAr: 'أنظمة مكافحة الحريق',
        hsCode: '8421.21 / 8481.80',
      },
    ],
  },
  {
    slug: 'cement-and-related',
    name: 'Cement & Related',
    nameAr: 'الأسمنت ومشتقاته',
    products: [
      { slug: 'opc-cement', name: 'OPC Cement', nameAr: 'أسمنت بورتلاندي عادي', hsCode: '2523.29' },
      { slug: 'src-cement', name: 'SRC Cement', nameAr: 'أسمنت مقاوم للأملاح', hsCode: '2523.30' },
      { slug: 'clinker', name: 'Clinker', nameAr: 'كلنكر', hsCode: '2523.10' },
      { slug: 'ggbs', name: 'GGBS', nameAr: 'خبث أفران عالية محبب مطحون', hsCode: '2618' },
      { slug: 'white-cement', name: 'White Cement', nameAr: 'أسمنت أبيض', hsCode: '2523.21' },
    ],
  },
  {
    slug: 'blocks-and-precast',
    name: 'Blocks & Precast',
    nameAr: 'البلوك والخرسانة سابقة الصب',
    products: [
      {
        slug: 'concrete-blocks',
        name: 'Concrete Blocks (Hollow/Solid)',
        nameAr: 'بلوك خرساني (مفرغ/مصمت)',
        hsCode: '6810.11',
      },
      {
        slug: 'interlock-pavers',
        name: 'Interlock Pavers',
        nameAr: 'بلاط انترلوك',
        hsCode: '6810.19',
      },
      { slug: 'kerbstones', name: 'Kerbstones', nameAr: 'حجر أرصفة', hsCode: '6810.99' },
      {
        slug: 'precast-panels',
        name: 'Precast Panels',
        nameAr: 'ألواح سابقة الصب',
        hsCode: '6806.10',
      },
      {
        slug: 'precast-manholes',
        name: 'Precast Manholes',
        nameAr: 'غرف تفتيش سابقة الصب',
        hsCode: '6810.11 / 6810.99',
      },
    ],
  },
  {
    slug: 'insulation-and-waterproofing',
    name: 'Insulation & Waterproofing',
    nameAr: 'العزل ومنع تسرب المياه',
    products: [
      {
        slug: 'waterproofing-membrane',
        name: 'Waterproofing Membrane',
        nameAr: 'أغشية عزل مائي',
        hsCode: '6807.10',
      },
      { slug: 'xps-insulation', name: 'XPS Insulation', nameAr: 'عزل XPS', hsCode: '3921.19' },
      { slug: 'eps-insulation', name: 'EPS Insulation', nameAr: 'عزل EPS', hsCode: '3921.11' },
      {
        slug: 'rockwool-boards',
        name: 'Rockwool Boards',
        nameAr: 'ألواح صوف صخري',
        hsCode: '6806.10',
      },
      { slug: 'pu-boards', name: 'PU Boards', nameAr: 'ألواح بولي يوريثان', hsCode: '3921.13' },
    ],
  },
  {
    slug: 'chemicals-and-special-items',
    name: 'Chemicals & Special Items',
    nameAr: 'الكيماويات والمواد الخاصة',
    products: [
      {
        slug: 'construction-chemicals',
        name: 'Construction Chemicals',
        nameAr: 'كيماويات البناء',
        hsCode: '3824.40 / 3824.99',
      },
      { slug: 'admixtures', name: 'Admixtures', nameAr: 'إضافات خرسانية', hsCode: '3824.40' },
      { slug: 'solar-panels', name: 'Solar Panels', nameAr: 'ألواح شمسية', hsCode: '8541.43' },
      {
        slug: 'solar-mounting-structures',
        name: 'Solar Mounting Structures',
        nameAr: 'هياكل تثبيت الألواح الشمسية',
        hsCode: '7308.90 / 7610.90',
      },
    ],
  },
  {
    slug: 'infrastructure-materials',
    name: 'Infrastructure Materials',
    nameAr: 'مواد البنية التحتية',
    products: [
      { slug: 'geotextiles', name: 'Geotextiles', nameAr: 'أقمشة جيوتكستايل', hsCode: '5603.14' },
      { slug: 'geogrids', name: 'Geogrids', nameAr: 'شبكات جيوجريد', hsCode: '3926.90' },
      {
        slug: 'manhole-covers',
        name: 'Manhole Covers (Ductile Iron)',
        nameAr: 'أغطية غرف تفتيش (حديد مطيل)',
        hsCode: '7325.10',
      },
      {
        slug: 'road-barriers',
        name: 'Road Barriers (Plastic/Concrete)',
        nameAr: 'حواجز طرق (بلاستيك/خرسانة)',
        hsCode: '3926.90 / 6810.99',
      },
      {
        slug: 'road-marking-paint',
        name: 'Road Marking Paint',
        nameAr: 'دهان تخطيط الطرق',
        hsCode: '3208.90',
      },
    ],
  },
  {
    slug: 'modular-and-prefab',
    name: 'Modular & Prefab',
    nameAr: 'المباني الجاهزة والمعيارية',
    products: [
      {
        slug: 'portable-cabins',
        name: 'Portable Cabins',
        nameAr: 'كبائن متنقلة',
        hsCode: '9406.90',
      },
      {
        slug: 'modular-classrooms',
        name: 'Modular Classrooms/Units',
        nameAr: 'فصول ووحدات معيارية',
        hsCode: '9406.10',
      },
      {
        slug: 'light-steel-frame-systems',
        name: 'LSF - Light Steel Frame Systems',
        nameAr: 'أنظمة الهياكل الفولاذية الخفيفة',
        hsCode: '7308.90',
      },
    ],
  },
  {
    slug: 'finishing-materials',
    name: 'Finishing Materials',
    nameAr: 'مواد التشطيب',
    products: [
      { slug: 'gypsum-boards', name: 'Gypsum Boards', nameAr: 'ألواح جبسية', hsCode: '6809.11' },
      {
        slug: 'ceiling-metal-profiles',
        name: 'Ceiling Metal Profiles',
        nameAr: 'بروفايلات أسقف معدنية',
        hsCode: '7308.90',
      },
      {
        slug: 'ceramic-tiles',
        name: 'Tiles (Ceramic)',
        nameAr: 'بلاط سيراميك',
        hsCode: '6907.21 / 6908.90',
      },
      {
        slug: 'porcelain-tiles',
        name: 'Porcelain Tiles',
        nameAr: 'بلاط بورسلين',
        hsCode: '6907.90',
      },
      {
        slug: 'paints-and-coatings',
        name: 'Paints & Coatings',
        nameAr: 'الدهانات والطلاءات',
        hsCode: '3209.90',
      },
      {
        slug: 'aluminum-windows-and-doors',
        name: 'Aluminum Windows & Doors',
        nameAr: 'نوافذ وأبواب ألمنيوم',
        hsCode: '7610.10',
      },
      { slug: 'wooden-doors', name: 'Wooden Doors', nameAr: 'أبواب خشبية', hsCode: '4418.20' },
    ],
  },
]

/** Every product across every category, for counting and validation. */
export const ALL_PRODUCTS = CATALOGUE.flatMap((c) => c.products)
