import { toDbLocale } from '@/i18n/locale'
import { db } from '@/lib/db'

/**
 * Deterministic knowledge search.
 *
 * Used when no `ANTHROPIC_API_KEY` is configured — the application must run
 * fully without one. It performs keyword scoring over the FAQ and the
 * admin-approved knowledge documents and returns the best match verbatim.
 *
 * It never generates prose, so it cannot fabricate a price, a date or a
 * requirement. The worst case is "I could not find an answer".
 */

/** Words too common to carry meaning in a score. */
const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'do',
  'does',
  'did',
  'how',
  'what',
  'when',
  'where',
  'which',
  'who',
  'why',
  'can',
  'could',
  'would',
  'should',
  'i',
  'you',
  'we',
  'my',
  'me',
  'to',
  'of',
  'in',
  'on',
  'for',
  'and',
  'or',
  'with',
  'from',
  'at',
  'by',
  'it',
  'this',
  'that',
  'as',
  'your',
  // Fillers that were missing, and which counted against a match: "why is
  // there no price on the product page?" scored one word out of five, four of
  // them carrying no meaning at all.
  'no',
  'not',
  'there',
  'any',
  'some',
  'please',
  'about',
  'will',
  'have',
  'has',
  'had',
  'us',
  'our',
  'their',
  'they',
  'get',
  'want',
  'need',
  'like',
])

export function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token))
    .map(singular)
}

/**
 * Crude English de-pluralisation, so "prices" matches "price" and "documents"
 * matches "document". Without it someone asking about prices missed the entry
 * titled "Why are prices not shown on the website?" — the words differed by a
 * single letter. Arabic is left alone: its plurals are not suffixes.
 */
function singular(token: string): string {
  if (token.length <= 3) return token
  if (token.endsWith('ies')) return `${token.slice(0, -3)}y`
  if (token.endsWith('ss')) return token
  if (token.endsWith('s')) return token.slice(0, -1)
  return token
}

export type FallbackAnswer = {
  found: boolean
  answer: string
  source?: { kind: 'faq' | 'knowledge'; title: string }
  suggestions: string[]
}

/**
 * Minimum normalised score before an answer is considered relevant.
 *
 * Lower than it looks: every score is now weighted by how distinctive the
 * matched words are, so all of them are smaller than under the old plain count.
 */
const RELEVANCE_THRESHOLD = 0.3

/**
 * How many distinct query words a match must contain to stand on its own.
 *
 * One was enough before: asked whether GLEX exports steel rebar to Kenya and
 * what the minimum order is, the assistant answered about export documents,
 * because "export" appeared in that title. One common word out of seven is not
 * a match, it is a coincidence.
 */
const MIN_MATCHED_TOKENS = 2

/**
 * When a single matched word is enough: in a short question, and only if the
 * word appears in the question being answered.
 *
 * A word threshold was tried first and does not work. Measured against the real
 * FAQ, "export" weighs 0.61 and "product" 0.53 — so any cut-off that lets
 * someone asking "what products do you sell?" through also lets "export" answer
 * a question about steel rebar to Kenya, which is the failure being fixed.
 *
 * Length is the better signal. In three words or fewer, the one word that
 * matched is what the question is about; in seven, it is one of seven and the
 * other six went unanswered.
 */
const SHORT_QUERY_TOKENS = 3

export type Candidate = { kind: 'faq' | 'knowledge'; title: string; body: string; locale: string }

export type Ranked = Candidate & {
  /** Relevance on its own merits, before any language preference. */
  score: number
  /** How many distinct query words this candidate actually contains. */
  matched: number
  /** The most distinctive query word found in the title; 0 if none was. */
  bestTitleWeight: number
}

/**
 * How common a word is across the corpus, as a weight.
 *
 * A word in nearly every entry ("export", "GLEX", "shipment") carries almost no
 * information about which entry is wanted, so matching it should barely count.
 * A word in one entry ("Incoterms", "supplier") is close to decisive.
 */
function tokenWeights(candidates: Candidate[]): Map<string, number> {
  const documentCount = Math.max(1, candidates.length)
  const appearances = new Map<string, number>()

  for (const candidate of candidates) {
    for (const token of new Set([...tokenize(candidate.title), ...tokenize(candidate.body)])) {
      appearances.set(token, (appearances.get(token) ?? 0) + 1)
    }
  }

  const weights = new Map<string, number>()
  for (const [token, count] of appearances) {
    // 1 for a word unique to one entry, falling towards 0 as it spreads.
    weights.set(token, Math.log(1 + documentCount / count) / Math.log(1 + documentCount))
  }
  return weights
}

/**
 * Ranks the candidates for a question. Pure, so the behaviour above can be
 * tested without a database.
 */
export function rankCandidates(
  question: string,
  candidates: Candidate[],
  preferredLocale: string
): { best: Ranked | null; suggestions: string[] } {
  const queryTokens = tokenize(question)
  const weights = tokenWeights(candidates)

  const ranked: Ranked[] = candidates
    .map((candidate) => {
      const titleTokens = new Set(tokenize(candidate.title))
      const bodyTokens = new Set(tokenize(candidate.body))

      let weighted = 0
      let matched = 0
      let bestTitleWeight = 0

      for (const token of new Set(queryTokens)) {
        const weight = weights.get(token) ?? 1
        if (titleTokens.has(token)) {
          weighted += 2 * weight
          matched += 1
          bestTitleWeight = Math.max(bestTitleWeight, weight)
        } else if (bodyTokens.has(token)) {
          weighted += weight
          matched += 1
        }
      }

      return {
        ...candidate,
        score: queryTokens.length === 0 ? 0 : weighted / queryTokens.length,
        matched,
        bestTitleWeight,
      }
    })
    // The language preference orders equally relevant answers; it must not
    // promote an irrelevant one over the threshold, which is what it used to do.
    .sort((a, b) => {
      const byScore = b.score - a.score
      if (Math.abs(byScore) > 0.001) return byScore

      // A word matched in the question itself beats the same weight spread over
      // body text: asked why there is no price on the product page, "prices" in
      // a title should win over "product" and "page" in a different answer.
      const byTitle = b.bestTitleWeight - a.bestTitleWeight
      if (Math.abs(byTitle) > 0.001) return byTitle

      const aPreferred = a.locale === preferredLocale ? 1 : 0
      const bPreferred = b.locale === preferredLocale ? 1 : 0
      return bPreferred - aPreferred
    })

  const top = ranked[0]
  const singleWordIsEnough =
    queryTokens.length <= SHORT_QUERY_TOKENS && top !== undefined && top.bestTitleWeight > 0
  const convincing =
    top !== undefined &&
    top.score >= RELEVANCE_THRESHOLD &&
    (top.matched >= MIN_MATCHED_TOKENS || singleWordIsEnough)
  const good = convincing ? top : null

  // Offer what else was close. When nothing was good enough these are all the
  // visitor gets, so they are worth showing even then.
  const suggestions = ranked
    .filter((candidate) => candidate !== good && candidate.matched > 0)
    .slice(0, 3)
    .map((candidate) => candidate.title)

  return {
    best: good,
    suggestions:
      suggestions.length > 0 ? suggestions : ranked.slice(0, 3).map((candidate) => candidate.title),
  }
}

export async function answerFromKnowledge(
  question: string,
  locale: string
): Promise<FallbackAnswer> {
  const dbLocale = toDbLocale(locale)

  const [faqs, documents] = await Promise.all([
    db.faqEntry
      .findMany({
        where: { isActive: true, locale: { in: [dbLocale, 'en'] } },
        select: { question: true, answer: true, locale: true },
      })
      .catch(() => []),
    db.knowledgeDocument
      .findMany({
        // Only admin-approved documents are ever surfaced.
        where: { isActive: true, approvedAt: { not: null }, locale: { in: [dbLocale, 'en'] } },
        select: { title: true, body: true, locale: true },
      })
      .catch(() => []),
  ])

  const candidates: Candidate[] = [
    ...faqs.map((faq) => ({
      kind: 'faq' as const,
      title: faq.question,
      body: faq.answer,
      locale: faq.locale as string,
    })),
    ...documents.map((doc) => ({
      kind: 'knowledge' as const,
      title: doc.title,
      body: doc.body,
      locale: doc.locale as string,
    })),
  ]

  const { best, suggestions } = rankCandidates(question, candidates, dbLocale)

  if (!best) return { found: false, answer: '', suggestions }

  return {
    found: true,
    answer: best.body,
    source: { kind: best.kind, title: best.title },
    suggestions,
  }
}
