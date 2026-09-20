/**
 * GLEX news, written from the company's own announcements.
 *
 * Every item below comes from a post published by GLEX, by Mabani Al Jazeera
 * Holding Group, or by someone who took part in the event, and each carries the
 * link it was taken from. The wording here is GLEX's own: a company newsroom
 * summarising what happened, not a copy of somebody else's post — several of
 * these were written by people outside the company, and their words are theirs.
 *
 * Dates are the posts' own publication dates, decoded from the LinkedIn
 * activity identifiers rather than read off a "1 year ago" label.
 */

export type NewsSeed = {
  slug: string
  /** Matches a NewsCategory slug seeded in prisma/seed.ts. */
  category: string
  publishedAt: string
  featured?: boolean
  /**
   * A photograph in public/news/, where one exists and is usable. Two of the
   * source posts carried a video thumbnail with a play button burned into it
   * and a personal snapshot that crops badly, so those articles run without a
   * picture rather than with a poor one.
   */
  image?: boolean
  source: string
  en: { title: string; summary: string; body: string }
  ar: { title: string; summary: string; body: string }
}

export const NEWS: NewsSeed[] = [
  {
    slug: 'glex-launched-by-mabani-al-jazeera',
    image: true,
    category: 'company-news',
    publishedAt: '2025-08-14',
    featured: true,
    source:
      'https://ae.linkedin.com/posts/mabani-aljazeera-holding-group_%D9%85%D8%A8%D8%A7%D9%86%D9%8A%D8%A7%D9%84%D8%AC%D8%B2%D9%8A%D8%B1%D8%A9-%D8%AC%D9%84%D9%88%D8%A8%D8%A7%D9%84%D8%A5%D9%83%D8%B3%D8%A8%D9%88%D8%B1%D8%AA%D9%87%D8%A7%D9%88%D8%B3-%D8%B1%D8%A4%D9%8A%D8%A9-activity-7361621577093783552-qjxm',
    en: {
      title: 'Mabani Al Jazeera Holding Group launches Global Export House',
      summary:
        'GLEX is established to take Saudi building materials to international markets and to raise the Kingdom’s non-oil exports, in line with Vision 2030.',
      body: `Mabani Al Jazeera Holding Group has announced the launch of Global Export House (GLEX), a company dedicated to exporting Saudi building materials to markets around the world.

The launch extends the group's work in construction beyond the Kingdom. GLEX is built to connect Saudi manufacturers with international buyers, and to add to the Kingdom's non-oil exports — one of the aims set out in Saudi Vision 2030.

The company works in cooperation with the Saudi Export Development Authority and the Saudi Export-Import Bank, whose representatives attended the launch alongside the group's executives.

From KSA to the world.`,
    },
    ar: {
      title: 'مجموعة مباني الجزيرة القابضة تدشّن جلوبال إكسبورت هاوس',
      summary:
        'تأسيس GLEX لتصدير مواد البناء السعودية إلى الأسواق العالمية ورفع الصادرات غير النفطية، بما يتماشى مع رؤية المملكة 2030.',
      body: `أعلنت مجموعة مباني الجزيرة القابضة تدشين شركة جلوبال إكسبورت هاوس (GLEX)، المتخصصة في تصدير مواد البناء السعودية إلى الأسواق العالمية.

يمثّل التدشين امتدادًا لعمل المجموعة في قطاع التشييد والبناء إلى ما وراء حدود المملكة. وتعمل GLEX على ربط المصنّعين السعوديين بالمشترين الدوليين، وعلى الإسهام في رفع الصادرات غير النفطية، وهو أحد أهداف رؤية المملكة 2030.

وتعمل الشركة بالتعاون مع هيئة تنمية الصادرات السعودية وبنك التصدير والاستيراد السعودي، وقد حضر ممثلوهما حفل التدشين إلى جانب قيادات المجموعة.

من السعودية إلى العالم.`,
    },
  },
  {
    slug: 'glex-launch-message-from-the-chairman',
    image: true,
    category: 'company-news',
    publishedAt: '2025-08-13',
    source:
      'https://ae.linkedin.com/posts/faris-mudathir-mohamed-409524b2_%D8%B5%D9%86%D8%B9%D9%81%D9%8A%D8%A7%D9%84%D8%B3%D8%B9%D9%88%D8%AF%D9%8A%D8%A9-%D8%AC%D9%84%D9%88%D8%A8%D8%A7%D9%84%D8%A5%D9%83%D8%B3%D8%A8%D9%88%D8%B1%D8%AA%D9%87%D8%A7%D9%88%D8%B3-activity-7361278205875355648-RAle',
    en: {
      title: 'A strategic step towards global markets',
      summary:
        'Faris Mudathir Mohamed on the launch of GLEX: a milestone for the group, and for Saudi building materials abroad.',
      body: `Announcing the launch of Global Export House, Faris Mudathir Mohamed described it as an important milestone in the group's path — a step that strengthens its capability in construction not only inside the Kingdom, but internationally.

GLEX specialises in exporting Saudi building materials to global markets, under Mabani Al Jazeera Holding Group, and in line with the diversification goals of Saudi Vision 2030.

Made in Saudi Arabia, sold to the world.`,
    },
    ar: {
      title: 'خطوة استراتيجية نحو العالمية',
      summary:
        'فارس مدثر محمد عن تدشين GLEX: محطة مهمة في مسيرة المجموعة، وللمنتج السعودي في الأسواق الخارجية.',
      body: `بمناسبة تدشين شركة جلوبال إكسبورت هاوس، وصف فارس مدثر محمد الخطوة بأنها محطة مهمة في مسيرة المجموعة، تعزّز قدراتها وخدماتها في قطاع التشييد والبناء، لا داخل المملكة وحدها بل على مستوى العالم.

وتختص GLEX، التابعة لمجموعة مباني الجزيرة القابضة، بتصدير مواد البناء السعودية إلى الأسواق العالمية، بما يتماشى مع أهداف التنويع الاقتصادي في رؤية المملكة 2030.

صنع في السعودية، ويُصدَّر إلى العالم.`,
    },
  },
  {
    slug: 'johnson-controls-arabia-visit',
    category: 'partnerships',
    publishedAt: '2025-08-20',
    source:
      'https://ae.linkedin.com/posts/maher-mousa-mba-cmi-b8881818_%D8%AA%D9%88%D8%B7%D9%8A%D9%86%D8%A7%D9%84%D8%AA%D9%82%D9%86%D9%8A%D8%A9-%D8%A7%D9%84%D9%85%D8%AD%D8%AA%D9%88%D9%89%D8%A7%D9%84%D9%85%D8%AD%D9%84%D9%8A-%D8%A7%D9%84%D8%B5%D8%A7%D8%AF%D8%B1%D8%A7%D8%AA-activity-7363782428697513984-1pfh',
    en: {
      title: 'Visit to Johnson Controls Arabia in King Abdullah Economic City',
      summary:
        'A partnership between Mabani Al Jazeera and Johnson Controls Arabia, aimed at national industry, local content and technology localisation.',
      body: `Faris Mudathir Mohamed visited the Johnson Controls Arabia facility in King Abdullah Economic City, marking a partnership between the manufacturer and Mabani Al Jazeera Holding Group.

The visit was described as part of the group's plan to support national industry and local content, and to build an integrated Saudi team across its projects.

For GLEX, partnerships of this kind matter directly: the stronger the manufacturing base at home, the more there is to offer buyers abroad.`,
    },
    ar: {
      title: 'زيارة إلى جونسون كنترولز العربية في مدينة الملك عبدالله الاقتصادية',
      summary:
        'شراكة بين مباني الجزيرة وجونسون كنترولز العربية لدعم الصناعة الوطنية والمحتوى المحلي وتوطين التقنية.',
      body: `زار فارس مدثر محمد مصنع جونسون كنترولز العربية في مدينة الملك عبدالله الاقتصادية، في إطار شراكة بين الشركة المصنّعة ومجموعة مباني الجزيرة القابضة.

وتأتي الزيارة ضمن خطة المجموعة الهادفة إلى دعم الصناعة الوطنية والمحتوى المحلي، وتكوين فريق وطني متكامل في مشاريعها.

وتمثّل هذه الشراكات أهمية مباشرة لـ GLEX: فكلما قويت القاعدة الصناعية محليًا، اتسع ما يمكن تقديمه للمشترين في الخارج.`,
    },
  },
  {
    slug: 'damascus-international-exhibition-2025',
    category: 'events',
    publishedAt: '2025-08-21',
    source:
      'https://ae.linkedin.com/posts/faris-m-mohamed-409524b2_%D9%86%D8%B4%D8%A8%D9%87%D8%A8%D8%B9%D8%B6%D9%86%D8%A7-%D9%85%D8%B9%D8%B1%D8%B6%D8%AF%D9%85%D8%B4%D9%82%D8%A7%D9%84%D8%AF%D9%88%D9%84%D9%8A2025-%D8%A7%D9%84%D9%85%D8%B4%D8%A7%D8%B1%D9%83%D8%A9%D8%A7%D9%84%D8%B3%D8%B9%D9%88%D8%AF%D9%8A%D8%A9%D8%B3%D9%88%D8%B1%D9%8A%D8%A7-activity-7364312627218386945--tV6',
    en: {
      title: 'Saudi participation at the Damascus International Exhibition 2025',
      summary:
        'The Saudi presence in Damascus was read as a message of support for reconstruction, and an opening for trade between the two countries.',
      body: `The Damascus International Exhibition 2025 drew a Saudi delegation, a participation described by Faris Mudathir Mohamed as a message of support and a commitment to Syria's reconstruction.

Rebuilding needs materials, and at volume: cement, steel, electrical and finishing products of the kind Saudi manufacturers already export. For GLEX, the exhibition is part of a wider search for markets where Saudi supply and local demand meet.`,
    },
    ar: {
      title: 'المشاركة السعودية في معرض دمشق الدولي 2025',
      summary:
        'حضور سعودي في دمشق حمل رسالة دعم لإعادة الإعمار، وفرصة لفتح آفاق التبادل التجاري بين البلدين.',
      body: `شهد معرض دمشق الدولي 2025 مشاركة سعودية، وصفها فارس مدثر محمد بأنها رسالة دعم والتزام تجاه إعادة إعمار سوريا.

وإعادة الإعمار تحتاج إلى مواد بكميات كبيرة: الأسمنت والحديد والمنتجات الكهربائية ومواد التشطيب، وهي مما يصدّره المصنّعون السعوديون بالفعل. ويأتي المعرض بالنسبة إلى GLEX ضمن بحث أوسع عن أسواق يلتقي فيها العرض السعودي بالطلب المحلي.`,
    },
  },
  {
    slug: 'logistics-agreement-q-saudi-trading',
    category: 'partnerships',
    publishedAt: '2025-08-22',
    source:
      'https://ae.linkedin.com/posts/ahmad-sinada-2018_%D9%85%D8%B4%D9%88%D8%A7%D8%B1-%D8%A7%D9%84%D8%A3%D9%84%D9%81-%D9%85%D9%8A%D9%84-%D9%8A%D8%A8%D8%AF%D8%A3-%D8%A8%D8%AE%D8%B7%D9%88%D8%A9-activity-7364691562989080577-RhLa',
    en: {
      title: 'Logistics agreement signed with Q Saudi Trading Company',
      summary:
        'A cooperation agreement covering logistics and maritime shipping for projects of Mabani Al Jazeera and GLEX, inside the Kingdom and beyond it.',
      body: `A strategic cooperation agreement has been signed with Q Saudi Trading Company, covering logistics and maritime shipping services for the projects of Mabani Al Jazeera Holding Group and GLEX, inside the Kingdom and abroad.

Export is only partly a commercial matter; the rest is movement. An agreement of this kind is what turns a quotation into a delivery — vessels booked, cargo handled, documents in order.`,
    },
    ar: {
      title: 'توقيع اتفاقية لوجستية مع شركة كيو السعودية التجارية',
      summary:
        'اتفاقية تعاون تشمل الخدمات اللوجستية والشحن البحري لمشاريع مباني الجزيرة و GLEX داخل المملكة وخارجها.',
      body: `وُقّعت اتفاقية تعاون استراتيجي مع شركة كيو السعودية التجارية، تشمل الخدمات اللوجستية والشحن البحري لمشاريع مجموعة مباني الجزيرة القابضة و GLEX داخل المملكة وخارجها.

والتصدير ليس مسألة تجارية فحسب، بل حركة أيضًا. ومثل هذه الاتفاقيات هي ما يحوّل عرض السعر إلى شحنة تصل: حجز للسفن، ومناولة للبضائع، ومستندات مكتملة.`,
    },
  },
  {
    slug: 'iatf-2025-algeria',
    category: 'events',
    publishedAt: '2025-09-09',
    source:
      'https://ae.linkedin.com/posts/faris-mudathir-mohamed-409524b2_%D8%A7%D9%84%D8%AC%D8%B2%D8%A7%D8%A6%D8%B1%D8%A8%D9%88%D8%A7%D8%A8%D8%A9%D8%A7%D9%81%D8%B1%D9%8A%D9%82%D9%8A%D8%A7-algeria-iatf2025-activity-7371092151201390592-aFPo',
    en: {
      title: 'GLEX at IATF2025 in Algeria',
      summary:
        'Algeria hosted the Intra-African Trade Fair, where GLEX and Mabani Al Jazeera took part in the continent’s largest trade gathering.',
      body: `GLEX and Mabani Al Jazeera Holding Group took part in IATF2025, held in Algeria — a country Faris Mudathir Mohamed called a gateway to Africa and a pillar of the continent's economic development.

Africa is a priority market for Saudi building materials, and IATF is where its buyers, financiers and manufacturers meet. The company thanked Algeria's government and people for the hospitality and the organisation of the event.`,
    },
    ar: {
      title: 'GLEX في معرض التجارة البينية الأفريقية IATF2025 بالجزائر',
      summary:
        'استضافت الجزائر معرض التجارة البينية الأفريقية، وشاركت فيه GLEX ومجموعة مباني الجزيرة ضمن أكبر تجمّع تجاري في القارة.',
      body: `شاركت GLEX ومجموعة مباني الجزيرة القابضة في معرض التجارة البينية الأفريقية IATF2025 المقام في الجزائر، البلد الذي وصفه فارس مدثر محمد بأنه بوابة أفريقيا وركيزة من ركائز التنمية الاقتصادية في القارة.

وتُعدّ أفريقيا سوقًا ذات أولوية لمواد البناء السعودية، ويجتمع في هذا المعرض المشترون وجهات التمويل والمصنّعون. وقد وجّهت الشركة شكرها إلى حكومة الجزائر وشعبها على حسن الضيافة وتنظيم الفعالية.`,
    },
  },
  {
    slug: 'afreximbank-cooperation-talks',
    image: true,
    category: 'partnerships',
    publishedAt: '2025-10-09',
    source:
      'https://www.linkedin.com/posts/elhadielnigumi_afreximbank-mabanialjazeera-saudieximbank-activity-7381978719592206338-i9gh',
    en: {
      title: 'Talks with Afreximbank on Saudi–African project pipelines',
      summary:
        'Meetings at the African Export-Import Bank on cooperation in infrastructure, industrial development and technology transfer.',
      body: `A delegation from Mabani Al Jazeera Holding Group met executives of the African Export-Import Bank (Afreximbank) at the bank's headquarters, to discuss closer cooperation and a wider partnership framework.

The discussion centred on a pipeline of projects matching Africa's development priorities with Saudi Vision 2030 — infrastructure, industrial development and technology transfer — with GLEX as the bridge for the trade that follows.`,
    },
    ar: {
      title: 'مباحثات مع البنك الأفريقي للاستيراد والتصدير حول مشاريع سعودية أفريقية',
      summary:
        'لقاءات في البنك الأفريقي للاستيراد والتصدير بشأن التعاون في البنية التحتية والتنمية الصناعية ونقل التقنية.',
      body: `التقى وفد من مجموعة مباني الجزيرة القابضة قيادات البنك الأفريقي للاستيراد والتصدير (أفريكسيم بنك) في مقر البنك، لبحث تعزيز التعاون وتوسيع إطار الشراكة.

وتركّزت المباحثات على محفظة مشاريع تجمع بين أولويات التنمية في أفريقيا ورؤية المملكة 2030 — في البنية التحتية والتنمية الصناعية ونقل التقنية — على أن تكون GLEX جسرًا للتبادل التجاري الذي يعقبها.`,
    },
  },
  {
    slug: 'saudi-exim-global-partners-forum-2025',
    image: true,
    category: 'events',
    publishedAt: '2025-11-23',
    source:
      'https://ae.linkedin.com/posts/faris-mudathir-mohamed-409524b2_%D9%81%D8%B9%D8%A7%D9%84%D9%8A%D8%A7%D8%AA%D9%85%D8%B4%D8%A7%D8%B1%D9%83%D8%A7%D8%AA-saudieximglobalpartnersforum2025-activity-7398266511221665792-UQK2',
    en: {
      title: 'GLEX at the Saudi EXIM Global Partners Forum 2025',
      summary:
        'Turning strategic dialogue into projects: raising Saudi local content in international work, and the Kingdom’s standing as an export hub.',
      body: `GLEX took part in the Saudi EXIM Global Partners Forum 2025, the Saudi Export-Import Bank's gathering of its international partners.

The theme the company brought to it was a practical one: converting strategic dialogue into projects that are actually built, raising the share of Saudi local content in international work, and supporting the Kingdom's position as a global export hub.`,
    },
    ar: {
      title: 'GLEX في ملتقى الشركاء العالميين لبنك التصدير والاستيراد السعودي 2025',
      summary:
        'تحويل الحوار الاستراتيجي إلى مشاريع: رفع المحتوى المحلي السعودي في الأعمال الدولية، ومكانة المملكة مركزًا للتصدير.',
      body: `شاركت GLEX في ملتقى الشركاء العالميين 2025 الذي ينظّمه بنك التصدير والاستيراد السعودي ويجمع شركاءه الدوليين.

وكان المحور الذي حملته الشركة عمليًا بطبيعته: تحويل الحوار الاستراتيجي إلى مشاريع تُنفَّذ فعلًا، ورفع نسبة المحتوى المحلي السعودي في الأعمال الدولية، ودعم مكانة المملكة مركزًا عالميًا للتصدير.`,
    },
  },
]

/**
 * Category names in the other four locales.
 *
 * The categories are seeded in English only, so an Arabic reader saw "COMPANY
 * NEWS" stamped on an Arabic article. Keyed by the category slug.
 */
export const CATEGORY_LABELS: Record<string, Record<'ar' | 'de' | 'fr' | 'zh-CN', string>> = {
  'company-news': {
    ar: 'أخبار الشركة',
    de: 'Unternehmensnews',
    fr: 'Actualités de l’entreprise',
    'zh-CN': '公司新闻',
  },
  'saudi-exports': {
    ar: 'الصادرات السعودية',
    de: 'Saudische Exporte',
    fr: 'Exportations saoudiennes',
    'zh-CN': '沙特出口',
  },
  'global-markets': {
    ar: 'الأسواق العالمية',
    de: 'Globale Märkte',
    fr: 'Marchés mondiaux',
    'zh-CN': '全球市场',
  },
  logistics: {
    ar: 'الخدمات اللوجستية',
    de: 'Logistik',
    fr: 'Logistique',
    'zh-CN': '物流',
  },
  'construction-materials': {
    ar: 'مواد البناء',
    de: 'Baustoffe',
    fr: 'Matériaux de construction',
    'zh-CN': '建筑材料',
  },
  partnerships: {
    ar: 'الشراكات',
    de: 'Partnerschaften',
    fr: 'Partenariats',
    'zh-CN': '合作伙伴',
  },
  events: {
    ar: 'الفعاليات',
    de: 'Veranstaltungen',
    fr: 'Événements',
    'zh-CN': '活动',
  },
  'industry-insights': {
    ar: 'رؤى القطاع',
    de: 'Brancheneinblicke',
    fr: 'Analyses sectorielles',
    'zh-CN': '行业洞察',
  },
}
