import { pathToFileURL } from 'node:url';
import path from 'node:path';
const here = path.dirname(new URL(import.meta.url).pathname);
const STUB_AUTH = pathToFileURL(path.join(here, 'stub-require-user.mjs')).href;
const STUB_CLERK = pathToFileURL(path.join(here, 'stub-clerk.mjs')).href;
const STUB_HOOKS = pathToFileURL(path.join(here, 'stub-clerk-webhooks.mjs')).href;
export async function resolve(specifier, context, next) {
  if (specifier === '@clerk/express') return { url: STUB_CLERK, shortCircuit: true };
  if (specifier === '@clerk/express/webhooks') return { url: STUB_HOOKS, shortCircuit: true };
  const r = await next(specifier, context);
  if (r.url.endsWith('/backend/src/middleware/requireUser.js')) return { url: STUB_AUTH, shortCircuit: true };
  return r;
}
