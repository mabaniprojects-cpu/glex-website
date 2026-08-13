import { generateText, stepCountIs } from 'ai'
import type { AppLocale } from '@/i18n/routing'
import type { SessionUser } from '@/lib/auth-guards'
import { env, isAiConfigured } from '@/lib/env'
import { answerFromKnowledge } from './fallback'
import {
  buildSystemPrompt,
  MAX_HISTORY_TURNS,
  sanitizeAssistantOutput,
} from './guardrails'
import { buildPrivateTools, buildPublicTools, extractToolNames } from './tools'

/**
 * Assistant provider.
 *
 * With `ANTHROPIC_API_KEY` set, the request goes to Claude with the guardrail
 * prompt and the authorized tools. Without a key, it degrades to deterministic
 * knowledge search — the application must build and run either way.
 */

export type ChatTurn = { role: 'user' | 'assistant'; content: string }

export type AssistantReply = {
  answer: string
  /** True when the deterministic fallback produced the answer. */
  usedFallback: boolean
  /** Follow-up questions to offer. Fallback mode only. */
  suggestions: string[]
  /**
   * Title of the FAQ entry or knowledge document the answer was taken from.
   * Fallback mode only — shown so the visitor can see which question was
   * matched rather than mistaking a near-miss for a direct reply.
   */
  sourceTitle: string | null
  /** Tool NAMES only — never arguments or retrieved content. */
  toolsUsed: string[]
}

export async function askAssistant({
  message,
  history,
  locale,
  user,
}: {
  message: string
  history: ChatTurn[]
  locale: AppLocale
  user: SessionUser | null
}): Promise<AssistantReply> {
  if (!isAiConfigured()) {
    return runFallback(message, locale)
  }

  try {
    const { anthropic } = await import('@ai-sdk/anthropic')
    const context = { user, locale }

    const tools = {
      ...buildPublicTools(context),
      // Private tools are registered ONLY for a signed-in person. An anonymous
      // visitor has no account tool available at all, so no prompt can reach
      // account data.
      ...(user ? buildPrivateTools(user, context) : {}),
    }

    const result = await generateText({
      model: anthropic(env().ANTHROPIC_MODEL),
      system: buildSystemPrompt({
        locale,
        isAuthenticated: Boolean(user),
        userName: user?.name,
      }),
      messages: [
        ...history.slice(-MAX_HISTORY_TURNS).map((turn) => ({
          role: turn.role,
          content: turn.content,
        })),
        { role: 'user' as const, content: message },
      ],
      tools,
      // Allow a few tool round-trips, then stop.
      stopWhen: stepCountIs(5),
    })

    const answer = sanitizeAssistantOutput(result.text)
    if (!answer) return runFallback(message, locale)

    return {
      answer,
      usedFallback: false,
      suggestions: [],
      sourceTitle: null,
      toolsUsed: extractToolNames(result.steps ?? []),
    }
  } catch (error) {
    // A provider outage must not take the assistant down — fall back to search.
    console.error('[ai] Provider call failed; using knowledge fallback:', error)
    return runFallback(message, locale)
  }
}

async function runFallback(message: string, locale: AppLocale): Promise<AssistantReply> {
  const result = await answerFromKnowledge(message, locale)

  return {
    answer: result.found ? result.answer : '',
    usedFallback: true,
    suggestions: result.suggestions,
    sourceTitle: result.found ? (result.source?.title ?? null) : null,
    toolsUsed: [],
  }
}
