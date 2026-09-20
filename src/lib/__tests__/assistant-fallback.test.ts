import { describe, expect, it, vi } from 'vitest'

// The module reads the FAQ from the database at import time; the ranking it
// exports needs none of that.
vi.mock('@/lib/db', () => ({ db: {} }))

const { rankCandidates, tokenize } = await import('@/lib/ai/fallback')
type Candidate = Parameters<typeof rankCandidates>[1][number]

/**
 * What the assistant answers when it has no AI provider.
 *
 * The failure worth preventing is not silence — it is a confident answer to a
 * different question. Asked on the live site whether GLEX exports steel rebar
 * to Kenya and what the minimum order is, it replied about export documents,
 * because "export" appears in half the FAQ and one word was enough.
 */

const faq = (question: string, answer: string, locale = 'en'): Candidate => ({
  kind: 'faq',
  title: question,
  body: answer,
  locale,
})

const CORPUS: Candidate[] = [
  faq(
    'Which export documents are typically required?',
    'A commercial invoice, packing list and certificate of origin are common to most shipments, alongside a bill of lading or air waybill.'
  ),
  faq(
    'How do I submit a request for quotation?',
    'Add the products you need to your request and submit it from the RFQ page. You can also export a copy for your records.'
  ),
  faq(
    'Why are prices not shown on the website?',
    'Building materials are quoted per order. Price depends on quantity, destination and delivery terms.'
  ),
  faq(
    'Which countries do you export to?',
    'GLEX ships to Africa, Asia and Europe, and arranges delivery to the destination port agreed in the quotation.'
  ),
  faq(
    'What are Incoterms?',
    'Incoterms set out where cost and risk pass from seller to buyer — FOB, CFR and CIF are the terms most often used.'
  ),
]

describe('a question the FAQ cannot answer', () => {
  it('refuses rather than answering a different question', () => {
    const { best, suggestions } = rankCandidates(
      'Do you export steel rebar to Kenya, and what are your minimum order quantities?',
      CORPUS,
      'en'
    )

    // The old behaviour: "Which export documents are typically required?".
    expect(best).toBeNull()
    // The visitor is not left with nothing — the near misses are offered as
    // questions to pick from, which is honest about what happened.
    expect(suggestions.length).toBeGreaterThan(0)
  })

  it('does not let one common word carry a long question', () => {
    const { best } = rankCandidates(
      'Can you export cement to Mombasa before the end of the month?',
      CORPUS,
      'en'
    )
    expect(best).toBeNull()
  })

  it('answers a short question from its one matched word', () => {
    // Three words or fewer: the word that matched is what was asked about.
    const { best } = rankCandidates('Which countries?', CORPUS, 'en')
    expect(best?.title).toBe('Which countries do you export to?')
  })
})

describe('a question the FAQ can answer', () => {
  it('still answers when the question genuinely matches', () => {
    const { best } = rankCandidates(
      'Which documents do I need for an export shipment?',
      CORPUS,
      'en'
    )
    expect(best?.title).toBe('Which export documents are typically required?')
  })

  it('answers a one-word question, where a single match is all there is', () => {
    const { best } = rankCandidates('Incoterms?', CORPUS, 'en')
    expect(best?.title).toBe('What are Incoterms?')
  })

  it('picks the entry about prices when asked about prices', () => {
    const { best } = rankCandidates('Why is there no price on the product page?', CORPUS, 'en')
    expect(best?.title).toBe('Why are prices not shown on the website?')
  })
})

describe('language preference', () => {
  const bilingual: Candidate[] = [
    faq('What are Incoterms?', 'English answer about Incoterms, FOB and CFR.', 'en'),
    faq('What are Incoterms?', 'Arabic answer about Incoterms, FOB and CFR.', 'ar'),
  ]

  it('prefers the reader’s language when two answers are equally relevant', () => {
    expect(rankCandidates('Incoterms?', bilingual, 'ar').best?.locale).toBe('ar')
    expect(rankCandidates('Incoterms?', bilingual, 'en').best?.locale).toBe('en')
  })

  it('does not let the language bonus promote an irrelevant answer', () => {
    // This was the other half of the live failure: a weak match in the reader's
    // own language was pushed over the threshold by the bonus alone.
    const { best } = rankCandidates('Do you deliver to Kenya next week?', bilingual, 'ar')
    expect(best).toBeNull()
  })
})

describe('the scoring helpers', () => {
  it('drops stop words and short tokens', () => {
    expect(tokenize('What is the RFQ process?')).toEqual(['rfq', 'process'])
  })

  it('treats singular and plural as the same word', () => {
    expect(tokenize('prices')).toEqual(tokenize('price'))
    expect(tokenize('quantities')).toEqual(['quantity'])
    // Not every trailing s is a plural.
    expect(tokenize('business')).toEqual(['business'])
  })

  it('returns nothing for an empty question', () => {
    expect(rankCandidates('', CORPUS, 'en').best).toBeNull()
  })
})
