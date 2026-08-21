const configuredApiBaseUrl = (import.meta.env.VITE_AI_API_BASE_URL || '').replace(/\/+$/, '')
const appBaseUrl = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '')

/**
 * Uses an explicitly configured API origin when one is provided. Otherwise,
 * same-origin requests follow Vite's base path, which is `/ppt/` behind the
 * shared ALB, so `/api/edit` becomes `/ppt/api/edit`.
 */
export const aiApiUrl = (path: string) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  // Vite's development server proxies `/api/*` to the local Express server.
  // The app itself is served at `/ppt/` to match production, but `/ppt/api/*`
  // is not a Vite proxy route and therefore produced a local 404.
  if (import.meta.env.DEV && !configuredApiBaseUrl) return normalizedPath
  return configuredApiBaseUrl
    ? `${configuredApiBaseUrl}${normalizedPath}`
    : `${appBaseUrl}${normalizedPath}`
}
