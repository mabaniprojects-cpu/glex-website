/**
 * The FAQ, in English and Arabic.
 *
 * It serves two audiences. A visitor reads it on /faq, and the GLEX Assistant
 * answers from it verbatim whenever no AI provider is configured — which is the
 * production setup today. So an answer missing here is an answer the assistant
 * cannot give, and a vague one is a vague reply to a customer.
 *
 * Two rules for anything added here:
 *
 *   1. Never state a commercial term the company has not fixed. Minimum order
 *      quantities, lead times, payment terms and prices vary per order, and the
 *      honest answer is that the quotation carries them. An invented figure
 *      here becomes a promise a client will hold GLEX to.
 *   2. Keep the question phrased the way a buyer would ask it. The assistant
 *      matches on the question text, so "Do you ship to Africa?" earns its
 *      keep in a way that "Geographic coverage" does not.
 */

export type FaqSeed = {
  category: string
  en: { question: string; answer: string }
  ar: { question: string; answer: string }
}

export const FAQ: FaqSeed[] = [
  // --- Requests and quotations ---------------------------------------------
  {
    category: 'RFQ',
    en: {
      question: 'How do I submit a request for quotation?',
      answer:
        'Browse the marketplace, add the products you need to your RFQ, then enter quantities, destination and any project details before submitting. You will receive a reference number by email and can follow progress from your dashboard.',
    },
    ar: {
      question: 'كيف أقدّم طلب عرض سعر؟',
      answer:
        'تصفّح السوق الإلكتروني، وأضف المنتجات التي تحتاجها إلى طلبك، ثم أدخل الكميات وجهة الشحن وتفاصيل المشروع قبل الإرسال. ستصلك إشارة مرجعية عبر البريد الإلكتروني، ويمكنك متابعة حالة الطلب من لوحة التحكم.',
    },
  },
  {
    category: 'RFQ',
    en: {
      question: 'Do I need an account to submit an RFQ?',
      answer:
        'No. Guest requests are accepted, but we will email you a verification link so we can confirm your address before the request is finalised. Creating an account lets you save drafts and track status.',
    },
    ar: {
      question: 'هل أحتاج إلى حساب لتقديم طلب عرض سعر؟',
      answer:
        'لا. نقبل الطلبات من الزوار، لكننا نرسل رابط تحقق إلى بريدك الإلكتروني لتأكيد العنوان قبل اعتماد الطلب. وإنشاء حساب يتيح لك حفظ المسودات ومتابعة الحالة.',
    },
  },
  {
    category: 'RFQ',
    en: {
      question: 'How long does a quotation take?',
      answer:
        'Most quotations are prepared within four to six working days. A standard order priced from the market is usually faster; a large or technical order goes to our technical office for a material study first, which is what sets the upper end of that window.',
    },
    ar: {
      question: 'كم يستغرق إعداد عرض السعر؟',
      answer:
        'تُعدّ معظم عروض الأسعار خلال أربعة إلى ستة أيام عمل. والطلب الاعتيادي الذي يُسعَّر من السوق يكون أسرع عادةً، أمّا الطلبات الكبيرة أو الفنية فتُحال أولًا إلى المكتب الفني لإعداد دراسة المواد، وهو ما يحدّد الحدّ الأعلى لهذه المدة.',
    },
  },
  {
    category: 'RFQ',
    en: {
      question: 'What happens after I submit a request?',
      answer:
        'Our customer service team reviews it and passes it to supply chain, who price the goods and the freight in parallel. The compiled offer is approved internally before it reaches you, and you can follow the status from your dashboard throughout.',
    },
    ar: {
      question: 'ماذا يحدث بعد إرسال الطلب؟',
      answer:
        'يراجع فريق خدمة العملاء الطلب ويحيله إلى إدارة سلسلة الإمداد، حيث يُسعَّر كلٌّ من البضاعة والشحن في الوقت نفسه. ويُعتمد العرض داخليًا قبل وصوله إليك، ويمكنك متابعة الحالة من لوحة التحكم في كل مرحلة.',
    },
  },

  // --- Pricing and commercial terms ----------------------------------------
  {
    category: 'Pricing',
    en: {
      question: 'Why are prices not shown on the website?',
      answer:
        'Prices for building materials depend on specification, quantity, destination and Incoterm. GLEX prepares a written commercial offer for each request rather than publishing indicative figures.',
    },
    ar: {
      question: 'لماذا لا تُعرض الأسعار على الموقع؟',
      answer:
        'تعتمد أسعار مواد البناء على المواصفات والكمية وجهة الشحن وشرط التسليم. ولذلك تُعدّ GLEX عرضًا تجاريًا مكتوبًا لكل طلب بدلًا من نشر أسعار استرشادية.',
    },
  },
  {
    category: 'Pricing',
    en: {
      question: 'What is the minimum order quantity?',
      answer:
        'It depends on the product and the manufacturer. Where a minimum is fixed it is shown on the product page; otherwise it is confirmed in your quotation. Full-container quantities are the most economical to ship.',
    },
    ar: {
      question: 'ما هو الحد الأدنى لكمية الطلب؟',
      answer:
        'يختلف باختلاف المنتج والمصنع. وحين يكون الحد الأدنى ثابتًا فإنه يظهر في صفحة المنتج، وإلا فيُحدَّد في عرض السعر. وتبقى الكميات المعبّأة بحاوية كاملة هي الأوفر في الشحن.',
    },
  },
  {
    category: 'Pricing',
    en: {
      question: 'Which Incoterms do you work with?',
      answer:
        'EXW, FCA, FOB, CFR, CIF, CPT, CIP, DAP, DPU and DDP. The term is agreed per order and stated on the quotation, because it decides where cost and risk pass from GLEX to you.',
    },
    ar: {
      question: 'ما شروط التسليم (الإنكوترمز) التي تعملون بها؟',
      answer:
        'نعمل بشروط EXW وFCA وFOB وCFR وCIF وCPT وCIP وDAP وDPU وDDP. ويُتفق على الشرط لكل طلب ويُذكر في عرض السعر، لأنه يحدّد النقطة التي تنتقل عندها التكلفة والمخاطر من GLEX إليك.',
    },
  },
  {
    category: 'Pricing',
    en: {
      question: 'What are your payment terms?',
      answer:
        'Payment terms are agreed per order and set out in the quotation, and depend on the value, the destination and the instrument used — a letter of credit, for example. GLEX never asks for payment details through this website or by chat.',
    },
    ar: {
      question: 'ما هي شروط الدفع لديكم؟',
      answer:
        'يُتفق على شروط الدفع لكل طلب وتُدوَّن في عرض السعر، وتعتمد على قيمة الطلب وجهة الشحن وأداة الدفع المستخدمة، كالاعتماد المستندي. ولا تطلب GLEX بيانات الدفع عبر هذا الموقع أو عبر المحادثة إطلاقًا.',
    },
  },
  {
    category: 'Pricing',
    en: {
      question: 'How long does a quotation stay valid?',
      answer:
        'Each offer carries its own validity date, shown on the quotation and in your dashboard. Building-material prices move with raw material and freight markets, so an expired offer is re-quoted rather than extended.',
    },
    ar: {
      question: 'ما مدة صلاحية عرض السعر؟',
      answer:
        'لكل عرض تاريخ صلاحية خاص به يظهر في العرض وفي لوحة التحكم. ولأن أسعار مواد البناء تتحرك مع أسواق المواد الخام والشحن، فإن العرض المنتهي يُعاد تسعيره بدلًا من تمديده.',
    },
  },

  // --- Products -------------------------------------------------------------
  {
    category: 'Products',
    en: {
      question: 'What products does GLEX export?',
      answer:
        'Saudi building materials across nine categories: steel and metals, electrical and MEP, cement and related products, blocks and precast, insulation and waterproofing, chemicals and special items, infrastructure materials, modular and prefab, and finishing materials. The full catalogue is on the marketplace page.',
    },
    ar: {
      question: 'ما المنتجات التي تصدّرها GLEX؟',
      answer:
        'مواد بناء سعودية ضمن تسع فئات: الحديد والمعادن، والكهرباء والأعمال الميكانيكية، والأسمنت ومشتقاته، والبلوك والخرسانة مسبقة الصب، والعزل ومانعات التسرب، والكيماويات والمواد الخاصة، ومواد البنية التحتية، والمباني الجاهزة والمودولار، ومواد التشطيب. والكتالوج الكامل متاح في صفحة السوق الإلكتروني.',
    },
  },
  {
    category: 'Products',
    en: {
      question: 'Can you supply a product that is not in the catalogue?',
      answer:
        'Often, yes. The catalogue shows what we export most; our sourcing team works with a wider network of Saudi manufacturers. Describe what you need in a request for quotation, with specifications and quantities, and we will tell you what is available.',
    },
    ar: {
      question: 'هل يمكنكم توريد منتج غير موجود في الكتالوج؟',
      answer:
        'غالبًا نعم. فالكتالوج يعرض ما نصدّره أكثر من غيره، بينما يعمل فريق التوريد مع شبكة أوسع من المصنّعين السعوديين. صِف ما تحتاجه في طلب عرض سعر مع المواصفات والكميات، وسنوضّح لك المتاح منه.',
    },
  },
  {
    category: 'Products',
    en: {
      question: 'Are the product photographs of the exact goods supplied?',
      answer:
        'No. The catalogue photographs are illustrative, and each product page says so. What you receive is governed by the specification in the quotation, not by the image.',
    },
    ar: {
      question: 'هل صور المنتجات مطابقة تمامًا للبضاعة المورَّدة؟',
      answer:
        'لا. صور الكتالوج توضيحية، وهذا مذكور في كل صفحة منتج. والمعتمد فيما تستلمه هو المواصفات الواردة في عرض السعر وليس الصورة.',
    },
  },
  {
    category: 'Products',
    en: {
      question: 'Can you provide certificates and test reports?',
      answer:
        'Yes. Mill certificates, test reports and conformity documents are available for the materials we supply; tell us in the request which ones your project or customs authority requires, and they are prepared with the shipment documents.',
    },
    ar: {
      question: 'هل يمكنكم تزويدنا بالشهادات وتقارير الفحص؟',
      answer:
        'نعم. تتوفر شهادات المصنع وتقارير الفحص ووثائق المطابقة للمواد التي نوردها. أخبرنا في الطلب بما يشترطه مشروعك أو الجهة الجمركية لديك، وتُجهَّز مع مستندات الشحنة.',
    },
  },

  // --- Shipping and destinations -------------------------------------------
  {
    category: 'Shipping',
    en: {
      question: 'Which shipping methods does GLEX coordinate?',
      answer:
        'Ocean freight (FCL and LCL), air freight, road freight, rail and multimodal combinations. The right option depends on volume, destination and required delivery date.',
    },
    ar: {
      question: 'ما طرق الشحن التي تنسّقها GLEX؟',
      answer:
        'الشحن البحري (حاوية كاملة أو مجمّعة)، والشحن الجوي، والشحن البري، والسكك الحديدية، والحلول متعددة الوسائط. ويعتمد الخيار الأنسب على الحجم وجهة الشحن وموعد التسليم المطلوب.',
    },
  },
  {
    category: 'Shipping',
    en: {
      question: 'Which countries do you export to?',
      answer:
        'GLEX exports from Saudi Arabia to markets across Africa, Asia and Europe, and has taken part in trade events in Algeria, Syria and beyond. Tell us your destination port or project site in a request and we will confirm the route and the terms.',
    },
    ar: {
      question: 'إلى أي دول تصدّرون؟',
      answer:
        'تصدّر GLEX من المملكة العربية السعودية إلى أسواق في أفريقيا وآسيا وأوروبا، وشاركت في فعاليات تجارية في الجزائر وسوريا وغيرها. أخبرنا بميناء الوصول أو موقع المشروع في طلبك، ونؤكد لك المسار والشروط.',
    },
  },
  {
    category: 'Shipping',
    en: {
      question: 'How do I track a shipment?',
      answer:
        'Use the tracking page with your GLEX shipment reference, container number, bill of lading or carrier tracking number. Clients with an account can also see all their shipments in the dashboard.',
    },
    ar: {
      question: 'كيف أتتبّع الشحنة؟',
      answer:
        'استخدم صفحة التتبّع مع الإشارة المرجعية لشحنة GLEX أو رقم الحاوية أو بوليصة الشحن أو رقم تتبّع الناقل. ويمكن لأصحاب الحسابات الاطّلاع على جميع شحناتهم من لوحة التحكم.',
    },
  },
  {
    category: 'Shipping',
    en: {
      question: 'Can I get a freight quote without ordering materials?',
      answer:
        'Yes. The freight quote page takes the lane, the mode and the cargo details on their own, for when you have your own supplier and need the shipping arranged.',
    },
    ar: {
      question: 'هل يمكنني الحصول على عرض سعر للشحن فقط دون شراء مواد؟',
      answer:
        'نعم. صفحة عرض سعر الشحن تستقبل خط السير ووسيلة النقل وتفاصيل البضاعة بشكل مستقل، وذلك حين يكون لديك مورّدك الخاص وتحتاج إلى ترتيب الشحن فقط.',
    },
  },

  // --- Documents and compliance --------------------------------------------
  {
    category: 'Documents',
    en: {
      question: 'Which export documents are typically required?',
      answer:
        'A commercial invoice, packing list and certificate of origin are common to most shipments, alongside a bill of lading or air waybill. Requirements vary by destination and product category, and must be confirmed with the relevant authorities.',
    },
    ar: {
      question: 'ما المستندات التي يتطلبها التصدير عادةً؟',
      answer:
        'الفاتورة التجارية وقائمة التعبئة وشهادة المنشأ مشتركة في معظم الشحنات، إلى جانب بوليصة الشحن البحري أو الجوي. وتختلف المتطلبات بحسب جهة الوصول وفئة المنتج، ويجب تأكيدها مع الجهات المختصة.',
    },
  },

  // --- Suppliers -------------------------------------------------------------
  {
    category: 'Suppliers',
    en: {
      question: 'How do I register as a supplier or distributor?',
      answer:
        'Complete the supplier registration form, which covers your company details, product capabilities, certifications and contacts. Our team reviews each application and responds by email. We never ask for banking details during registration.',
    },
    ar: {
      question: 'كيف أسجّل كمورّد أو موزّع؟',
      answer:
        'أكمل نموذج تسجيل المورّدين، وهو يشمل بيانات الشركة والقدرات الإنتاجية والشهادات وجهات الاتصال. ويراجع فريقنا كل طلب ويردّ عبر البريد الإلكتروني. ولا نطلب بيانات بنكية أثناء التسجيل إطلاقًا.',
    },
  },
  {
    category: 'Suppliers',
    en: {
      question: 'Which manufacturers do you work with?',
      answer:
        'Our network includes established Saudi producers across steel, cement, electrical and finishing materials — SABIC, Yanbu Cement, alfanar, Jotun, Elsewedy, Bahra Electric, Al-Ittefaq Steel and others shown on the home page. GLEX is part of Mabani Al Jazeera Holding Group.',
    },
    ar: {
      question: 'مع أي مصنّعين تعملون؟',
      answer:
        'تضم شبكتنا منتجين سعوديين راسخين في الحديد والأسمنت والكهرباء ومواد التشطيب، منهم سابك، وأسمنت ينبع، وألفنار، وجوتن، والسويدي، وبحرة للكهرباء، وحديد الاتفاق، وغيرهم ممن تظهر شعاراتهم في الصفحة الرئيسية. وGLEX جزء من مجموعة مباني الجزيرة القابضة.',
    },
  },

  // --- The company -----------------------------------------------------------
  {
    category: 'Contact',
    en: {
      question: 'Where is GLEX based?',
      answer:
        'GLEX operates from King Road Tower, Floor 10, Office 03, Ash Shati District, Jeddah, Saudi Arabia. You can reach the office on +966 9200 31827.',
    },
    ar: {
      question: 'أين يقع مقر GLEX؟',
      answer:
        'تعمل GLEX من برج كنج رود، الدور العاشر، مكتب 03، حي الشاطئ، جدة، المملكة العربية السعودية. ويمكنك التواصل مع المكتب على الرقم ‎+966 9200 31827‎.',
    },
  },
  {
    category: 'Contact',
    en: {
      question: 'Who is GLEX, and who owns the company?',
      answer:
        'Global Export House (GLEX) exports Saudi building materials to international markets. It was launched in 2025 by Mabani Al Jazeera Holding Group, and works alongside the Saudi Export Development Authority and the Saudi Export-Import Bank in support of the Kingdom’s non-oil export goals under Vision 2030.',
    },
    ar: {
      question: 'من هي GLEX ومن يملك الشركة؟',
      answer:
        'جلوبال إكسبورت هاوس (GLEX) شركة متخصصة في تصدير مواد البناء السعودية إلى الأسواق العالمية، دشّنتها مجموعة مباني الجزيرة القابضة عام 2025. وتعمل بالتعاون مع هيئة تنمية الصادرات السعودية وبنك التصدير والاستيراد السعودي دعمًا لأهداف الصادرات غير النفطية ضمن رؤية 2030.',
    },
  },
  {
    category: 'Contact',
    en: {
      question: 'How do I reach a person rather than the website?',
      answer:
        'Use the contact form and your message reaches the team directly, or write to info@exporthouse.com.sa. Requests for quotation are best sent through the RFQ page, so they arrive with the reference and the details attached.',
    },
    ar: {
      question: 'كيف أتواصل مع موظف بدلًا من الموقع؟',
      answer:
        'استخدم نموذج الاتصال لتصل رسالتك إلى الفريق مباشرة، أو راسلنا على info@exporthouse.com.sa. أما طلبات عروض الأسعار فيُفضَّل إرسالها عبر صفحة الطلبات لتصل مرفقة بالإشارة المرجعية وكامل التفاصيل.',
    },
  },
  {
    category: 'Contact',
    en: {
      question: 'In which languages can I deal with GLEX?',
      answer:
        'The website is published in English, Arabic, German, French and Chinese, and our team answers in Arabic and English. A quotation can be issued in either.',
    },
    ar: {
      question: 'بأي اللغات يمكنني التعامل مع GLEX؟',
      answer:
        'الموقع متاح بالإنجليزية والعربية والألمانية والفرنسية والصينية، ويردّ فريقنا بالعربية والإنجليزية. ويمكن إصدار عرض السعر بأي منهما.',
    },
  },
]
