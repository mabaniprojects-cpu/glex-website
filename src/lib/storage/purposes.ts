/**
 * Upload purposes, named once.
 *
 * The purpose string travels from a component, through a form field, to the
 * endpoint that decides whether an anonymous caller may use it — so a literal
 * typed twice is a 401 nobody can explain. That is exactly what happened:
 * the form posted "supplier-logos" while the endpoint allowed
 * "supplier-logo", and every applicant's company logo was refused.
 */

/** Company logo, step 2 of the supplier registration form. */
export const SUPPLIER_LOGO_PURPOSE = 'supplier-logos'

/** Company documents, step 4 of the same form. */
export const SUPPLIER_DOCUMENTS_PURPOSE = 'supplier-documents'

/**
 * The purposes reachable without a session.
 *
 * Both belong to public supplier registration, where the account that would
 * authenticate the upload does not exist yet — creating it is what the form
 * is for. Every other purpose requires a signed-in user.
 */
export const ANONYMOUS_UPLOAD_PURPOSES: ReadonlySet<string> = new Set([
  SUPPLIER_LOGO_PURPOSE,
  SUPPLIER_DOCUMENTS_PURPOSE,
])
