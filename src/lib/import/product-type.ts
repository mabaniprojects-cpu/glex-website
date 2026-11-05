import type { TypeCode } from '@/lib/catalogue-code'

/**
 * Guessing a product's type code from its name.
 *
 * Used when coding a catalogue that predates the scheme, and when an import
 * creates a product nobody has typed a code for. It is a proposal: the code
 * it leads to is permanent, so a human confirms before anything is
 * published, and `setProductVisibility` enforces that.
 *
 * Ordered, and the order is the rule. "GI Pipes" matches both the pipe
 * keyword and the galvanised one, and it is a pipe; "Galvanized Coils" is a
 * coils?. More specific phrases therefore come first, and the first match
 * wins rather than the best-scoring one — a scoring function here would be
 * harder to predict and no more correct.
 */

const RULES: ReadonlyArray<{ match: RegExp; type: TypeCode }> = [
  // Steel, before the generic pipe and sheet words.
  { match: /\brebar\b|reinforc(ing|ement) bar/i, type: 'REB' },
  { match: /wire rod/i, type: 'WRD' },
  { match: /billets?/i, type: 'BLT' },
  { match: /structural steel|i\/h beam|\bbeam\b/i, type: 'STR' },
  { match: /angle|channel/i, type: 'ANG' },
  { match: /wire mesh|welded mesh/i, type: 'MSH' },
  { match: /coils?/i, type: 'COL' },

  // Pipes and fittings. "GI pipe" and "steel pipe" are pipes, not coils?s.
  { match: /\belbow\b/i, type: 'ELB' },
  { match: /\btee\b/i, type: 'TEE' },
  { match: /reducers?/i, type: 'RED' },
  { match: /couplings?/i, type: 'CPL' },
  { match: /\bflange\b/i, type: 'FLG' },
  { match: /conduits?/i, type: 'CND' },
  { match: /\bpipes?\b|\bpiping\b/i, type: 'PIP' },

  // Cables, most specific first: a "fire resistant power cable" is filed
  // under fire resistance, which is why someone buys it.
  { match: /fire[- ]?resistan|fire[- ]?rated/i, type: 'CBF' },
  { match: /ls0h|lszh|low smoke/i, type: 'CBH' },
  { match: /submersible/i, type: 'CBM' },
  { match: /solar cable/i, type: 'CBS' },
  { match: /instrumentation/i, type: 'CBI' },
  { match: /control (&|and )?auxiliary|control cable/i, type: 'CBC' },
  { match: /overhead|ohtl|conductor.*(acsr|aac)/i, type: 'CBO' },
  { match: /bare (copper )?conductor/i, type: 'CBB' },
  // Accessories before the generic cable rule: a "cable lug" and a "cable
  // gland" both contain the word cable, and neither of them is a cable.
  { match: /\blugs?\b/i, type: 'LUG' },
  { match: /glands?/i, type: 'GLD' },
  { match: /\bcables?\b|\bwires?\b/i, type: 'CBL' },
  { match: /busbar|busway/i, type: 'BUS' },
  { match: /transformers?/i, type: 'TRF' },
  { match: /switchgear|panel board|\bpanels?\b.*(electric|switch)/i, type: 'SWG' },
  { match: /earthing|grounding/i, type: 'ERT' },
  { match: /wiring device|socket|switch plate/i, type: 'WDV' },
  { match: /enclosures?/i, type: 'ENC' },

  // Cement and concrete.
  { match: /clinkers?/i, type: 'CLK' },
  { match: /\bggbs\b|blast[- ]furnace/i, type: 'GGB' },
  { match: /cement/i, type: 'CEM' },
  { match: /interlock|paver/i, type: 'PAV' },
  { match: /kerb|curb/i, type: 'KRB' },
  { match: /precast manhole/i, type: 'PCM' },
  { match: /precast/i, type: 'PCP' },
  { match: /\bblocks?\b/i, type: 'BLK' },

  // Insulation and waterproofing.
  { match: /waterproof/i, type: 'WPM' },
  { match: /\bxps\b|\beps\b|rockwool|insulation|\bpu boards?\b/i, type: 'INS' },

  // Chemicals and energy.
  { match: /admixtures?/i, type: 'ADM' },
  { match: /solar mounting|mounting structure/i, type: 'SMS' },
  { match: /solar panel|photovoltaic/i, type: 'SOL' },
  { match: /chemical|adhesive|grout|sealant|mortar|render|primer|skim/i, type: 'CHM' },

  // Infrastructure.
  { match: /geotextiles?/i, type: 'GTX' },
  { match: /geogrids?/i, type: 'GGR' },
  { match: /manhole cover/i, type: 'MHC' },
  { match: /road barrier|barrier/i, type: 'BAR' },
  { match: /road marking|marking paint/i, type: 'RMP' },

  // Modular.
  { match: /portable cabin|porta ?cabin/i, type: 'CAB' },
  { match: /light steel frame|\blsf\b/i, type: 'LSF' },
  { match: /modular/i, type: 'MOD' },

  // Finishing. Paint comes after road-marking paint above.
  { match: /gypsum/i, type: 'GYP' },
  { match: /ceiling.*profile|metal profile/i, type: 'CMP' },
  { match: /tiles?\b|porcelain|ceramic/i, type: 'TIL' },
  { match: /paint|coating/i, type: 'PNT' },
  { match: /alumini?um (window|door)/i, type: 'ALW' },
  { match: /alumini?um .*profile|profile system/i, type: 'ALP' },
  { match: /wooden door|wood door/i, type: 'WDR' },
  { match: /luminaire|\bled\b|high bay|flood ?light|lighting/i, type: 'LUM' },

  // Mechanical.
  { match: /ducting|duct sheet/i, type: 'DCT' },
  { match: /hvac|air conditioning|chiller|split unit/i, type: 'HVC' },
  { match: /firefighting|fire fighting|sprinkler/i, type: 'FFS' },
]

/**
 * The proposed type, or GEN when nothing matches and a human must look.
 *
 * The NAME is matched on its own first, and the category only consulted
 * when the name says nothing. Searching both at once lets the category
 * decide: GLEX's categories are pairs — "Blocks & Precast", "Insulation &
 * Waterproofing" — so every concrete block matched "precast" and every
 * sheet of EPS matched "waterproofing", from a word that was never in the
 * product's own name.
 */
export function guessType(name: string, category?: string): TypeCode {
  for (const rule of RULES) {
    if (rule.match.test(name)) return rule.type
  }

  if (category) {
    for (const rule of RULES) {
      if (rule.match.test(category)) return rule.type
    }
  }

  return 'GEN'
}
