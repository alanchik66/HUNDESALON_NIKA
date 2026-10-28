import { ensurePaymentJobs, claimPaymentJob, completePaymentJob, releasePaymentJob } from './payment-orders.js';

/** Durable per-channel retry state; successful channels are not repeated on webhook redelivery. */
export async function runPaymentJob(env, orderId, kind, operation) {
  const queued = await ensurePaymentJobs(env, { orderId, kinds: [kind] });
  if (!queued.ok) return { ok: false, reason: 'payment_job_unavailable' };
  const claim = await claimPaymentJob(env, { orderId, kind });
  if (!claim.ok) return { ok: false, pending: claim.busy === true, reason: 'payment_job_busy' };
  if (claim.duplicate) return { ok: true, deduplicated: true };
  let result;
  try {
    result = await operation();
    if (result?.ok === true) {
      const completed = await completePaymentJob(env, { orderId, kind, claimToken: claim.claimToken });
      return completed.ok ? result : { ok: false, reason: 'payment_job_completion_pending' };
    }
  } catch {
    result = { ok: false, reason: 'payment_job_delivery_failed' };
  }
  await releasePaymentJob(env, { orderId, kind, claimToken: claim.claimToken });
  return result || { ok: false, reason: 'payment_job_delivery_failed' };
}
