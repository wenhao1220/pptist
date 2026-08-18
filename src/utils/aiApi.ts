const configuredApiBaseUrl = (import.meta.env.VITE_AI_API_BASE_URL || '').replace(/\/+$/, '')
const appBaseUrl = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '')

/**
 * Uses an explicitly configured API origin when one is provided. Otherwise,
 * same-origin requests follow Vite's base path, which is `/ppt/` behind the
 * shared ALB, so `/api/edit` becomes `/ppt/api/edit`.
 */
export const aiApiUrl = (path: string) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return configuredApiBaseUrl
    ? `${configuredApiBaseUrl}${normalizedPath}`
    : `${appBaseUrl}${normalizedPath}`
}
