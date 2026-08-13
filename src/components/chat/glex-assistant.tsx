'use client'

import { Info, MessageCircle, RotateCcw, Send, ThumbsDown, ThumbsUp, X } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

type Turn = {
  role: 'user' | 'assistant'
  content: string
  /** Matched FAQ question, shown in fallback mode so a near-miss is obvious. */
  sourceTitle?: string | null
}

type ChatResponse = {
  answer: string
  usedFallback: boolean
  suggestions: string[]
  sourceTitle: string | null
  conversationId: string | null
}

type HandoffResponse = {
  ticketCreated: boolean
  reference: string | null
  alreadyEscalated?: boolean
}

/** Turns of local history sent back for context. */
const HISTORY_TURNS = 12

/**
 * GLEX Assistant widget.
 *
 * Accessibility: the panel is a labelled dialog with focus trapped while open
 * and returned to the launcher on close. The transcript is a `role="log"` with
 * `aria-live="polite"`, so replies are announced without stealing focus.
 *
 * Assistant text is rendered as plain text — never as HTML — so nothing the
 * model produces can inject markup.
 */
export function GlexAssistant() {
  const t = useTranslations('chatbot')
  const common = useTranslations('common')
  const locale = useLocale()

  const [open, setOpen] = React.useState(false)
  const [turns, setTurns] = React.useState<Turn[]>([])
  const [input, setInput] = React.useState('')
  const [pending, setPending] = React.useState(false)
  const [notice, setNotice] = React.useState<string | null>(null)
  const [showContactLink, setShowContactLink] = React.useState(false)
  const [suggestions, setSuggestions] = React.useState<string[]>([])
  const [conversationId, setConversationId] = React.useState<string | null>(null)
  const [feedback, setFeedback] = React.useState<1 | -1 | null>(null)

  const panelRef = React.useRef<HTMLDivElement>(null)
  const launcherRef = React.useRef<HTMLButtonElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const logEndRef = React.useRef<HTMLDivElement>(null)

  // Focus trap, scroll lock and focus restoration.
  React.useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    inputRef.current?.focus()
    const launcher = launcherRef.current

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        return
      }
      if (event.key !== 'Tab') return

      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled])'
      )
      if (!focusables?.length) return

      const first = focusables[0]!
      const last = focusables[focusables.length - 1]!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
      launcher?.focus()
    }
  }, [open])

  React.useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: 'end' })
  }, [turns, pending])

  async function send(text: string) {
    const question = text.trim()
    if (!question || pending) return

    setNotice(null)
    setShowContactLink(false)
    setSuggestions([])
    setInput('')
    setTurns((current) => [...current, { role: 'user', content: question }])
    setPending(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: question,
          locale,
          history: turns
            .slice(-HISTORY_TURNS)
            .map((turn) => ({ role: turn.role, content: turn.content })),
          ...(conversationId ? { conversationId } : {}),
        }),
      })

      if (response.status === 429) {
        setNotice(t('rateLimited'))
        return
      }
      if (!response.ok) {
        setNotice(t('error'))
        return
      }

      const data = (await response.json()) as ChatResponse
      if (data.conversationId) setConversationId(data.conversationId)

      if (data.usedFallback) {
        setNotice(t('fallbackMode'))
        setSuggestions(data.suggestions)
      }

      setTurns((current) => [
        ...current,
        {
          role: 'assistant',
          content: data.answer || t('noAnswer'),
          sourceTitle: data.answer ? data.sourceTitle : null,
        },
      ])
    } catch {
      setNotice(t('error'))
    } finally {
      setPending(false)
    }
  }

  async function rate(value: 1 | -1) {
    if (!conversationId || feedback !== null) return
    // Optimistic: the rating is a courtesy, not something to block the UI on.
    setFeedback(value)

    try {
      const response = await fetch('/api/chat/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, feedback: value }),
      })
      if (!response.ok) setFeedback(null)
    } catch {
      setFeedback(null)
    }
  }

  async function requestHuman() {
    if (pending) return

    // Without a conversation there is nothing to escalate — send the visitor
    // straight to the contact form.
    if (!conversationId) {
      setNotice(t('handoffContact'))
      setShowContactLink(true)
      return
    }

    setPending(true)
    try {
      const response = await fetch('/api/chat/handoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId }),
      })

      if (!response.ok) {
        setNotice(t('error'))
        return
      }

      const data = (await response.json()) as HandoffResponse

      if (data.alreadyEscalated) {
        setNotice(t('handoffAlready'))
        setShowContactLink(false)
        return
      }

      if (data.ticketCreated) {
        setNotice(data.reference ? `${t('handoffCreated')} (${data.reference})` : t('handoffCreated'))
        setShowContactLink(false)
        return
      }

      // Anonymous visitor: we have no way to reach them, so ask for details.
      setNotice(t('handoffContact'))
      setShowContactLink(true)
    } catch {
      setNotice(t('error'))
    } finally {
      setPending(false)
    }
  }

  function reset() {
    setTurns([])
    setSuggestions([])
    setNotice(null)
    setShowContactLink(false)
    setConversationId(null)
    setFeedback(null)
    inputRef.current?.focus()
  }

  const starters = [t('suggestion1'), t('suggestion2'), t('suggestion3'), t('suggestion4')]
  const hasReply = turns.some((turn) => turn.role === 'assistant')

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('open')}
        aria-expanded={open}
        className={cn(
          'fixed bottom-5 end-5 z-90 inline-flex size-14 items-center justify-center rounded-full',
          'bg-glex-green-600 text-white shadow-lg transition-colors hover:bg-glex-green-700',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-glex-gold-400',
          open && 'hidden'
        )}
      >
        <MessageCircle className="size-6" aria-hidden="true" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-100 sm:inset-auto sm:bottom-5 sm:end-5">
          <div
            className="absolute inset-0 bg-glex-green-950/40 sm:hidden"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={t('name')}
            className={cn(
              'absolute inset-0 flex flex-col bg-white',
              'sm:static sm:h-[min(34rem,80vh)] sm:w-[24rem] sm:rounded-2xl',
              'sm:border sm:border-border-subtle sm:shadow-2xl'
            )}
          >
            {/* Header */}
            <header className="flex shrink-0 items-center justify-between border-b border-border-subtle px-4 py-2.5">
              <h2 className="text-base font-semibold text-glex-green-900">{t('name')}</h2>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={reset}
                  aria-label={t('reset')}
                  className="inline-flex size-9 items-center justify-center rounded-lg text-glex-green-800 hover:bg-glex-green-50"
                >
                  <RotateCcw className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label={t('close')}
                  className="inline-flex size-9 items-center justify-center rounded-lg text-glex-green-800 hover:bg-glex-green-50"
                >
                  <X className="size-5" aria-hidden="true" />
                </button>
              </div>
            </header>

            {/* Transcript */}
            <div
              role="log"
              aria-live="polite"
              aria-label={t('name')}
              className="flex-1 space-y-4 overflow-y-auto p-4"
            >
              {turns.length === 0 ? (
                <>
                  <p className="rounded-xl bg-surface-muted p-3 text-sm leading-relaxed text-glex-green-900">
                    {t('greeting')}
                  </p>

                  <div>
                    <p className="mb-2 text-xs font-semibold text-glex-green-800/60">
                      {t('suggested')}
                    </p>
                    <ul className="space-y-2">
                      {starters.map((question) => (
                        <li key={question}>
                          <button
                            type="button"
                            onClick={() => void send(question)}
                            className="w-full rounded-lg border border-border-subtle p-2.5 text-start text-sm text-glex-green-800 transition-colors hover:bg-glex-green-50"
                          >
                            {question}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : null}

              {turns.map((turn, index) => (
                <div
                  key={index}
                  className={cn(
                    'max-w-[85%] rounded-xl p-3 text-sm leading-relaxed whitespace-pre-line',
                    turn.role === 'user'
                      ? 'ms-auto bg-glex-green-600 text-white'
                      : 'bg-surface-muted text-glex-green-900'
                  )}
                >
                  {turn.sourceTitle ? (
                    <p className="mb-1.5 border-b border-glex-green-900/10 pb-1.5 text-xs font-semibold text-glex-green-800/70">
                      {t('answerSource', { title: turn.sourceTitle })}
                    </p>
                  ) : null}
                  {/* Plain text — assistant output is never rendered as HTML. */}
                  {turn.content}
                </div>
              ))}

              {pending ? (
                <p className="text-sm text-glex-green-800/60">{common('loading')}</p>
              ) : null}

              {suggestions.length > 0 ? (
                <ul className="space-y-2">
                  {suggestions.map((question) => (
                    <li key={question}>
                      <button
                        type="button"
                        onClick={() => void send(question)}
                        className="w-full rounded-lg border border-border-subtle p-2.5 text-start text-sm text-glex-green-800 transition-colors hover:bg-glex-green-50"
                      >
                        {question}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              <div ref={logEndRef} />
            </div>

            {/* Notice: fallback mode, rate limit, handoff outcome, errors. */}
            {notice ? (
              <p
                role="status"
                className="shrink-0 border-t border-border-subtle bg-glex-ivory px-4 py-2 text-xs leading-relaxed text-glex-green-900"
              >
                {notice}{' '}
                {showContactLink ? (
                  <Link
                    href="/contact"
                    onClick={() => setOpen(false)}
                    className="font-semibold underline underline-offset-2"
                  >
                    {t('handoffOpenContact')}
                  </Link>
                ) : null}
              </p>
            ) : null}

            {/* Feedback and human handoff */}
            {hasReply ? (
              <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border-subtle px-4 py-2">
                {feedback === null ? (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-glex-green-800/60">
                      {t('feedbackQuestion')}
                    </span>
                    <button
                      type="button"
                      onClick={() => void rate(1)}
                      aria-label={t('feedbackHelpful')}
                      className="inline-flex size-8 items-center justify-center rounded-lg text-glex-green-800 hover:bg-glex-green-50"
                    >
                      <ThumbsUp className="size-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void rate(-1)}
                      aria-label={t('feedbackNotHelpful')}
                      className="inline-flex size-8 items-center justify-center rounded-lg text-glex-green-800 hover:bg-glex-green-50"
                    >
                      <ThumbsDown className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-glex-green-800/60">{t('feedbackThanks')}</span>
                )}

                <button
                  type="button"
                  onClick={() => void requestHuman()}
                  disabled={pending}
                  className="text-xs font-semibold text-glex-green-700 underline underline-offset-2 disabled:opacity-50"
                >
                  {t('handoff')}
                </button>
              </div>
            ) : null}

            {/* Composer */}
            <form
              onSubmit={(event) => {
                event.preventDefault()
                void send(input)
              }}
              className="shrink-0 border-t border-border-subtle p-3"
            >
              <label htmlFor="glex-chat-input" className="sr-only">
                {t('placeholder')}
              </label>
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  id="glex-chat-input"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder={t('placeholder')}
                  maxLength={2000}
                  autoComplete="off"
                  className="h-11 w-full rounded-lg border border-border-subtle px-3 text-sm text-glex-green-900 focus:border-glex-green-600 focus:outline-none"
                />
                <Button type="submit" size="icon" disabled={pending || !input.trim()}>
                  <Send className="rtl-flip" aria-hidden="true" />
                  <span className="sr-only">{t('send')}</span>
                </Button>
              </div>

              <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-snug text-glex-green-800/60">
                <Info className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                {t('privacyNotice')}
              </p>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
