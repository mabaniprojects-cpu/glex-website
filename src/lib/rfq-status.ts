import { RfqStatus } from '@prisma/client'

/**
 * Statuses after which an RFQ takes no further messages.
 *
 * Shared by the reply action and the pages that render the reply box. If the
 * two ever disagreed, the UI would offer a form the server refuses — which
 * reads to a client as the platform losing their message.
 *
 * `ACCEPTED` and `CONVERTED_TO_ORDER` are deliberately absent: the conversation
 * stays open once an offer is agreed, which is exactly when a client is most
 * likely to have a question.
 */
export const CLOSED_RFQ_STATUSES: readonly RfqStatus[] = [
  RfqStatus.CANCELLED,
  RfqStatus.REJECTED,
  RfqStatus.EXPIRED,
]

export const isRfqClosed = (status: RfqStatus): boolean => CLOSED_RFQ_STATUSES.includes(status)
