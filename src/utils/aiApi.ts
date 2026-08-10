const configuredApiBaseUrl = (import.meta.env.VITE_AI_API_BASE_URL || '').replace(/\/+$/, '')

/**
 * Uses Vite's local `/api` proxy during development and the current origin after
 * deployment. Set VITE_AI_API_BASE_URL only when the API is hosted separately.
 */
export const aiApiUrl = (path: string) => `${configuredApiBaseUrl}${path}`
