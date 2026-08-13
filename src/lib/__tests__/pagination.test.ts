import { describe, expect, it } from 'vitest'
import { ADMIN_PAGE_SIZE, buildPageHref, pageCount, pageWindow, parsePageParam } from '../pagination'

describe('parsePageParam', () => {
  it('defaults to page 1 when absent', () => {
    expect(parsePageParam(undefined)).toBe(1)
  })

  it('reads the first value when the param repeats', () => {
    expect(parsePageParam(['3', '9'])).toBe(3)
  })

  it.each(['0', '-4', 'abc', '', 'NaN', 'Infinity'])('falls back to 1 for %j', (value) => {
    expect(parsePageParam(value)).toBe(1)
  })

  it('truncates a fractional page', () => {
    expect(parsePageParam('2.9')).toBe(2)
  })

  it('clamps a huge page so the skip cannot explode', () => {
    expect(parsePageParam('999999999')).toBe(1000)
  })
})

describe('pageWindow', () => {
  it('turns a page number into a skip', () => {
    expect(pageWindow('3')).toEqual({ page: 3, skip: 2 * ADMIN_PAGE_SIZE, take: ADMIN_PAGE_SIZE })
  })

  it('never skips on page 1', () => {
    expect(pageWindow(undefined).skip).toBe(0)
  })

  it('honours a custom page size', () => {
    expect(pageWindow('2', 10)).toEqual({ page: 2, skip: 10, take: 10 })
  })
})

describe('pageCount', () => {
  it('rounds a partial final page up', () => {
    expect(pageCount(113, 25)).toBe(5)
  })

  it('is exact when the total divides evenly', () => {
    expect(pageCount(50, 25)).toBe(2)
  })

  // An empty list should still render as "page 1 of 1", not "page 1 of 0".
  it('is at least 1 for an empty list', () => {
    expect(pageCount(0, 25)).toBe(1)
  })
})

describe('buildPageHref', () => {
  it('omits page=1 so the first page has one canonical URL', () => {
    expect(buildPageHref('/admin/rfqs', {}, 1)).toBe('/admin/rfqs')
  })

  it('preserves other active filters', () => {
    const href = buildPageHref('/admin/rfqs', { status: 'SUBMITTED', page: '2' }, 3)
    expect(href).toContain('status=SUBMITTED')
    expect(href).toContain('page=3')
  })

  // The incoming `page` must not survive, or paging would never move.
  it('replaces the incoming page rather than appending to it', () => {
    const href = buildPageHref('/admin/rfqs', { page: '2' }, 4)
    expect(href).toBe('/admin/rfqs?page=4')
  })

  it('takes the first value of a repeated param', () => {
    expect(buildPageHref('/admin/rfqs', { status: ['A', 'B'] }, 1)).toBe('/admin/rfqs?status=A')
  })

  it('drops empty params', () => {
    expect(buildPageHref('/admin/rfqs', { status: '' }, 1)).toBe('/admin/rfqs')
  })
})
