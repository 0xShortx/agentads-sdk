import { fetchAd } from './client'
import { renderAd } from './formats'
import type { AgentAdsConfig, AgentAdsResult } from './types'

/**
 * Simple function for non-Vercel-AI-SDK users.
 * Pass your user query and AI response, get back the enriched response.
 *
 * @example
 * const result = await getAd({
 *   publisherId: 'pub_xxx',
 *   query: userMessage,
 *   response: aiResponse,
 * })
 * if (result.filled) {
 *   sendToUser(result.text) // AI response + ad appended
 * }
 */
export async function getAd(options: {
  publisherId: string
  query: string
  response: string
  format?: AgentAdsConfig['format']
  apiUrl?: string
  timeoutMs?: number
}): Promise<AgentAdsResult> {
  const format = options.format || 'suffix'

  const ad = await fetchAd({
    publisherId: options.publisherId,
    query: options.query,
    response: options.response,
    format,
    apiUrl: options.apiUrl,
    timeoutMs: options.timeoutMs ?? 50,
  })

  if (!ad) return { filled: false }

  return {
    filled: true,
    ad,
    text: options.response + renderAd(ad, format),
  }
}
