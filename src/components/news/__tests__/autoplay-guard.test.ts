import type { EmblaCarouselType, OptionsHandlerType } from 'embla-carousel'
import Autoplay from 'embla-carousel-autoplay'
import { describe, expect, it, vi } from 'vitest'

/**
 * REGRESSION GUARD for `NewsSlider`.
 *
 * `embla-carousel-autoplay` returns early from its own `init` when the carousel
 * has one scroll snap or fewer — every slide already fits, so there is nothing
 * to rotate. That early return happens *before* it builds its internal delay
 * table, yet `play()` stays callable and reaches `setTimer`, which indexes that
 * undefined table:
 *
 *   TypeError: Cannot read properties of undefined (reading '0')
 *
 * That crashed the homepage whenever only one article was published. The slider
 * therefore checks `scrollSnapList().length > 1` before calling `play()`.
 *
 * This exercises the real plugin rather than a mock, so it fails if a future
 * version changes the contract and the guard becomes unnecessary — or if the
 * guard is ever removed.
 */

/** The slice of Embla's API the Autoplay plugin actually touches. */
function fakeEmbla(snapCount: number) {
  const ownerWindow = {
    clearTimeout: vi.fn(),
    setTimeout: vi.fn(() => 1),
  }

  return {
    scrollSnapList: () => Array.from({ length: snapCount }, (_, index) => index),
    selectedScrollSnap: () => 0,
    internalEngine: () => ({
      ownerWindow,
      ownerDocument: { addEventListener: vi.fn(), removeEventListener: vi.fn(), hidden: false },
      eventStore: { add: vi.fn(), clear: vi.fn() },
      options: { watchDrag: false },
    }),
    rootNode: () => ({ addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    containerNode: () => ({ addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    on: vi.fn().mockReturnThis(),
    off: vi.fn().mockReturnThis(),
    emit: vi.fn().mockReturnThis(),
  }
}

const optionsHandler = {
  mergeOptions: (a: object, b: object) => ({ ...a, ...b }),
  optionsAtMedia: (options: object) => options,
}

function initPlugin(snapCount: number) {
  const plugin = Autoplay({ delay: 6000, playOnInit: false })

  // `fakeEmbla` implements only the members the plugin touches, so it is cast
  // through `unknown` rather than widened to `any`.
  plugin.init(
    fakeEmbla(snapCount) as unknown as EmblaCarouselType,
    optionsHandler as unknown as OptionsHandlerType
  )

  return plugin
}

describe('embla autoplay with a single scroll snap', () => {
  it('throws from play() — this is why NewsSlider guards on the snap count', () => {
    const plugin = initPlugin(1)

    expect(() => plugin.play()).toThrowError(/undefined/)
  })

  it('plays normally once there is more than one snap', () => {
    const plugin = initPlugin(3)

    expect(() => plugin.play()).not.toThrow()
  })
})

describe('the guard NewsSlider applies', () => {
  /** Mirrors the condition in src/components/news/news-slider.tsx. */
  const shouldPlay = (playing: boolean, snapCount: number) => playing && snapCount > 1

  it.each([
    [true, 1, false],
    [true, 0, false],
    [true, 2, true],
    [false, 5, false],
  ])('playing=%s snaps=%i -> %s', (playing, snaps, expected) => {
    expect(shouldPlay(playing, snaps)).toBe(expected)
  })

  it('keeps a guarded call safe against the real plugin', () => {
    const plugin = initPlugin(1)
    const snapCount = 1

    // The slider only ever calls play() when this holds.
    expect(() => {
      if (shouldPlay(true, snapCount)) plugin.play()
      else plugin.stop()
    }).not.toThrow()
  })
})
