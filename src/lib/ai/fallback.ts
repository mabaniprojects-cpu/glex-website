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
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'do', 'does', 'did',
  'how', 'what', 'when', 'where', 'which', 'who', 'why', 'can', 'could', 'would',
  'should', 'i', 'you', 'we', 'my', 'me', 'to', 'of', 'in', 'on', 'for', 'and',
  'or', 'with', 'from', 'at', 'by', 'it', 'this', 'that', 'as', 'your',
])

export function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token))
}

/**
 * Overlap score between a query and a document.
 *
 * A term in the title/question counts double, since a match there is a much
 * stronger signal than one buried in the body.
 */
export function scoreMatch(queryTokens: string[], title: string, body: string): number {
  if (queryTokens.length === 0) return 0

  const titleTokens = new Set(tokenize(title))
  const bodyTokens = new Set(tokenize(body))

  let score = 0
  for (const token of queryTokens) {
    if (titleTokens.has(token)) score += 2
    else if (bodyTokens.has(token)) score += 1
  }

  // Normalise so a long document does not win purely on length.
  return score / queryTokens.length
}

export type FallbackAnswer = {
  found: boolean
  answer: string
  source?: { kind: 'faq' | 'knowledge'; title: string }
  suggestions: string[]
}

/** Minimum normalised score before an answer is considered relevant. */
const RELEVANCE_THRESHOLD = 0.4

export async function answerFromKnowledge(
  question: string,
  locale: string
): Promise<FallbackAnswer> {
  const queryTokens = tokenize(question)
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

  type Candidate = { kind: 'faq' | 'knowledge'; title: string; body: string; score: number }

  const candidates: Candidate[] = [
    ...faqs.map((faq) => ({
      kind: 'faq' as const,
      title: faq.question,
      body: faq.answer,
      score:
        scoreMatch(queryTokens, faq.question, faq.answer) +
        // Prefer an entry already in the requested language.
        (faq.locale === dbLocale ? 0.15 : 0),
    })),
    ...documents.map((doc) => ({
      kind: 'knowledge' as const,
      title: doc.title,
      body: doc.body,
      score:
        scoreMatch(queryTokens, doc.title, doc.body) + (doc.locale === dbLocale ? 0.15 : 0),
    })),
  ]

  candidates.sort((a, b) => b.score - a.score)
  const best = candidates[0]

  // Up to three other reasonably-scoring questions to offer as next steps.
  const suggestions = candidates
    .slice(1)
    .filter((candidate) => candidate.score > 0)
    .slice(0, 3)
    .map((candidate) => candidate.title)

  if (!best || best.score < RELEVANCE_THRESHOLD) {
    return { found: false, answer: '', suggestions: candidates.slice(0, 3).map((c) => c.title) }
  }

  return {
    found: true,
    answer: best.body,
    source: { kind: best.kind, title: best.title },
    suggestions,
  }
}
