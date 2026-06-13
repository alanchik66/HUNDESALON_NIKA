/**
 * Cloudflare Pages Function: POST /message-draft
 * Contact-form message draft endpoint.
 */

export { handleMessageDraft as onRequest } from './_lib/draft-service.js';
