import { adminJson, authorizeAdmin } from '../../_lib/site-admin-auth.js';
import { pageEditorEntries } from '../../_lib/page-editor-catalog.js';

export async function onRequestGet({ request, env }) {
  const denied = await authorizeAdmin(request, env);
  return denied || adminJson({ pages: pageEditorEntries });
}
