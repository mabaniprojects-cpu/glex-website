import { expect, test, type Page } from '@playwright/test'

/**
 * GLEX Assistant.
 *
 * No `ANTHROPIC_API_KEY` is configured in the test environment, so these
 * exercise the deterministic FAQ fallback — which is the path that must work
 * whether or not an AI provider is ever configured.
 *
 * NOTE on locators: the widget renders inside a `role="dialog"`. Scope to it,
 * because the page behind it also contains links and buttons with similar
 * names (for example "Contact Us" in the header and footer).
 */

const dialog = (page: Page) => page.getByRole('dialog', { name: 'GLEX Assistant' })

async function openAssistant(page: Page) {
  await page.getByRole('button', { name: 'Open GLEX Assistant' }).click()
  await expect(dialog(page)).toBeVisible()
}

test.describe('GLEX Assistant', () => {
  test('answers from the FAQ and cites the matched question', async ({ page }) => {
    await page.goto('/en')
    await openAssistant(page)

    const panel = dialog(page)
    await panel.getByRole('button', { name: 'How can I track my shipment?' }).click()

    // The fallback answers verbatim from the FAQ, and says which entry it used.
    await expect(panel.getByText(/From our FAQ:/)).toBeVisible({ timeout: 20_000 })
    await expect(panel.getByText(/tracking page/i)).toBeVisible()

    // It must be honest that the AI provider is not configured.
    await expect(panel.getByRole('status')).toContainText(/not configured/i)
  })

  test('answers a typed question', async ({ page }) => {
    await page.goto('/en')
    await openAssistant(page)

    const panel = dialog(page)
    await panel.getByRole('textbox').fill('Why are prices not shown?')
    await panel.getByRole('button', { name: 'Send' }).click()

    await expect(panel.getByText(/From our FAQ:/)).toBeVisible({ timeout: 20_000 })

    // Section 12: the assistant must never state a price.
    await expect(panel).not.toContainText(/\bSAR\s*\d/)
    await expect(panel).not.toContainText(/\bUSD\s*\d/)
  })

  test('offers a human handoff that anonymous visitors can act on', async ({ page }) => {
    await page.goto('/en')
    await openAssistant(page)

    const panel = dialog(page)
    await panel.getByRole('button', { name: 'How do I register as a supplier?' }).click()
    await expect(panel.getByText(/From our FAQ:/)).toBeVisible({ timeout: 20_000 })

    await panel.getByRole('button', { name: 'Talk to a person' }).click()

    // No account means no way to reply, so it must point at the contact form
    // rather than promise a follow-up it cannot deliver.
    const status = panel.getByRole('status')
    await expect(status).toContainText(/contact form/i, { timeout: 20_000 })
    await expect(status.getByRole('link')).toHaveAttribute('href', '/en/contact')
  })

  test('records feedback and thanks the visitor', async ({ page }) => {
    await page.goto('/en')
    await openAssistant(page)

    const panel = dialog(page)
    await panel.getByRole('button', { name: 'How do I submit an RFQ?' }).click()
    await expect(panel.getByText(/From our FAQ:/)).toBeVisible({ timeout: 20_000 })

    // `exact` is required: the default substring match would also select
    // "Not helpful".
    await panel.getByRole('button', { name: 'Helpful', exact: true }).click()
    await expect(panel.getByText('Thank you for the feedback.')).toBeVisible()
  })

  test('resets the transcript', async ({ page }) => {
    await page.goto('/en')
    await openAssistant(page)

    const panel = dialog(page)
    await panel.getByRole('button', { name: 'How do I submit an RFQ?' }).click()
    await expect(panel.getByText(/From our FAQ:/)).toBeVisible({ timeout: 20_000 })

    await panel.getByRole('button', { name: 'Start a new conversation' }).click()

    // Back to the greeting, with no transcript left behind.
    await expect(panel.getByText(/I'm the GLEX Assistant/)).toBeVisible()
    await expect(panel.getByText(/From our FAQ:/)).toHaveCount(0)
  })

  test('closes on Escape and returns focus to the launcher', async ({ page }) => {
    await page.goto('/en')

    const launcher = page.getByRole('button', { name: 'Open GLEX Assistant' })
    await openAssistant(page)

    await page.keyboard.press('Escape')

    await expect(dialog(page)).toHaveCount(0)
    await expect(launcher).toBeFocused()
  })

  test('is fully translated in Arabic and lays out right-to-left', async ({ page }) => {
    await page.goto('/ar')

    // Activated from the keyboard rather than clicked: the launcher sits at the
    // inline end, which in RTL is bottom-left — exactly where `next dev` pins
    // its overlay. That overlay exists only in development, but it does swallow
    // synthetic clicks. Keyboard activation is unaffected, and it doubles as a
    // check that the launcher is operable without a pointer.
    const launcher = page.getByRole('button', { name: 'فتح مساعد GLEX' })
    await launcher.focus()
    await page.keyboard.press('Enter')

    // Named explicitly: the cookie-consent banner is also a dialog, so an
    // unscoped role locator matches two elements.
    const panel = page.getByRole('dialog', { name: 'مساعد GLEX' })
    await expect(panel).toBeVisible()

    // No untranslated English may leak into a non-English locale.
    await expect(panel.getByText(/Suggested questions|Ask about services/)).toHaveCount(0)
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  })
})
