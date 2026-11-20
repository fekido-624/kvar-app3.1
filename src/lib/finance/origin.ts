/** Accept only exact origins, never arbitrary forwarded-host values from a request. */
function parseOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
    return url.origin;
  } catch { return null; }
}
export function isAllowedFinanceOrigin(origin: string | null, requestOrigin: string, publicOrigin = process.env.APP_ORIGIN): boolean {
  // Non-browser clients still require authentication and application/json at the route.
  if (origin === null) return true;
  const source = parseOrigin(origin);
  if (!source) return false;
  return source === parseOrigin(requestOrigin) || Boolean(publicOrigin && source === parseOrigin(publicOrigin));
}
