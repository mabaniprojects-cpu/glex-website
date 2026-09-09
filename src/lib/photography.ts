/**
 * Editorial photography slots.
 *
 * The site has no photography yet, and photography is the single largest
 * difference between it and the sites it is measured against. This manifest is
 * both the brief for the shoot and the wiring for the result: each slot names
 * the shot, the minimum size and where the headline will sit, and carries the
 * file once it exists.
 *
 * `src: null` means the photograph has not been supplied. A section whose slot
 * is empty renders a labelled placeholder in development and is SKIPPED
 * ENTIRELY in production — a live customer-facing page must never show a grey
 * box captioned "photo goes here".
 *
 * To fill a slot: drop the file in `public/photography/`, set `src`, done.
 */

/** Where the headline sits, and therefore where the photo must stay quiet. */
export type TextSide = 'start' | 'end'

export type PhotoSlot = {
  /** Stable id; also the expected filename stem under public/photography/. */
  readonly id: string
  /** Path under public/, or null while the shot is outstanding. */
  readonly src: string | null
  /** Shortest acceptable long edge, in pixels, before compression. */
  readonly minWidth: number
  readonly minHeight: number
  /** What to photograph. Shown in the development placeholder. */
  readonly brief: string
  /** Which side the type overlays, so the shot keeps that side uncluttered. */
  readonly textSide: TextSide
}

/**
 * Alt text is NOT here. It is content, it differs per locale, and it belongs in
 * `messages/*.json` alongside the headline it accompanies.
 *
 * `src` is annotated rather than left to inference: without it, an unfilled
 * slot's type is the literal `null`, and `hasPhoto()` then narrows to `never`
 * instead of to a usable string. Filling a slot would not type-check.
 */
export const PHOTOGRAPHY = {
  hero: {
    id: 'hero',
    src: null as string | null,
    minWidth: 3200,
    minHeight: 1800,
    brief:
      'Elevated or aerial view of a container terminal — Jeddah Islamic Port or King Abdullah Port. Wide, with open sky or water across the leading half of the frame for the headline to sit in.',
    textSide: 'start',
  },
  network: {
    id: 'network',
    src: null as string | null,
    minWidth: 2400,
    minHeight: 1600,
    brief:
      'Gantry cranes working a vessel, or containers stacked at height. Shot from below or from distance; late afternoon light. No people identifiable.',
    textSide: 'start',
  },
  handling: {
    id: 'handling',
    src: null as string | null,
    minWidth: 2400,
    minHeight: 1600,
    brief:
      'Warehouse interior — racking, forklift, palletised goods under inspection. Depth down an aisle rather than a flat wall of shelving.',
    textSide: 'end',
  },
} satisfies Record<string, PhotoSlot>

export type PhotoSlotKey = keyof typeof PHOTOGRAPHY

/** True once a real file has been supplied for this slot. */
export function hasPhoto(slot: PhotoSlot): slot is PhotoSlot & { src: string } {
  return slot.src !== null
}
