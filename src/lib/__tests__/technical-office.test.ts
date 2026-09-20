import { afterEach, describe, expect, it } from 'vitest'
import { technicalOfficeLabel, technicalOfficeRecipients } from '../technical-office'

/**
 * Who a referral is addressed to.
 *
 * This is the only address list in the application that points outside GLEX,
 * so the two failures worth pinning are opposite ones: a referral that reaches
 * nobody, and a referral that reaches someone it should not.
 */

const original = process.env.MABANI_TECHNICAL_EMAILS

afterEach(() => {
  if (original === undefined) delete process.env.MABANI_TECHNICAL_EMAILS
  else process.env.MABANI_TECHNICAL_EMAILS = original
})

describe('the Mabani PMO recipients', () => {
  it('defaults to the two named people, so a fresh deployment still reaches them', () => {
    delete process.env.MABANI_TECHNICAL_EMAILS

    expect(technicalOfficeRecipients().map((person) => person.email)).toEqual([
      'a.rabie@mabani.com.sa',
      'pmo@mabani.com.sa',
    ])
  })

  it('can be replaced per deployment, because people move on', () => {
    process.env.MABANI_TECHNICAL_EMAILS = 'pmo@mabani.com.sa, technical@mabani.com.sa'

    expect(technicalOfficeRecipients().map((person) => person.email)).toEqual([
      'pmo@mabani.com.sa',
      'technical@mabani.com.sa',
    ])
  })

  it('does not keep a name that belonged to a replaced address', () => {
    process.env.MABANI_TECHNICAL_EMAILS = 'someone-else@mabani.com.sa'

    expect(technicalOfficeRecipients()).toEqual([
      { name: '', role: '', email: 'someone-else@mabani.com.sa' },
    ])
  })

  it('falls back rather than sending nowhere when the setting is empty or malformed', () => {
    for (const value of ['', '   ', 'not-an-address']) {
      process.env.MABANI_TECHNICAL_EMAILS = value
      expect(technicalOfficeRecipients()).toHaveLength(2)
    }
  })

  it('reads as a line a person can check before sending', () => {
    delete process.env.MABANI_TECHNICAL_EMAILS

    expect(technicalOfficeLabel()).toBe(
      'Abubaker Rabie <a.rabie@mabani.com.sa>, Elhadi Elnegumi <pmo@mabani.com.sa>'
    )
  })
})
