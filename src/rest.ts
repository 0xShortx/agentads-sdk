import { fetchAd } from './client'
import { renderAd } from './formats'
import type { AgentAdsConfig, AgentAdsResult } from './types'

const DEFAULT_TIMEOUT_MS = 3000

/**
 * Simple function for non-Vercel-AI-SDK users.
 * Pass your user query and AI response, get back the enriched response.
 *
 * @example
 * const result = await getAd({
 *   publisherApiKey: 'pub_xxx',
 *   query: userMessage,
 *   response: aiResponse,
 * })
 * if (result.filled) {
 *   sendToUser(result.text) // AI response + ad appended
 * }
 */
export async function getAd(options: {
  publisherApiKey: string
  /** @deprecated use publisherApiKey */
  publisherId?: string
  query: string
  response: string
  format?: AgentAdsConfig['format']
  sessionId?: string
  apiUrl?: string
  timeoutMs?: number
}): Promise<AgentAdsResult> {
  // Support deprecated publisherId
  const apiKey = options.publisherApiKey ?? options.publisherId
  if (!apiKey) throw new Error('AgentAds: publisherApiKey is required')

  if (!options.publisherApiKey && options.publisherId) {
    console.warn('[AgentAds] publisherId is deprecated — use publisherApiKey instead')
  }

  const format = options.format ?? 'suffix'

  const ad = await fetchAd({
    publisherApiKey: apiKey,
    query: options.query,
    response: options.response,
    format,
    sessionId: options.sessionId,
    apiUrl: options.apiUrl,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  })

  if (!ad) return { filled: false }

  return {
    filled: true,
    ad,
    text: options.response + renderAd(ad, format),
  }
}
