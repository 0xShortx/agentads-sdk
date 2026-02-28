import type { BidRequest, BidResponse, AdUnit } from './types'

const DEFAULT_API_URL = 'https://api.tryagentads.com'
const DEFAULT_TIMEOUT_MS = 50

interface FetchAdOptions {
  publisherId: string
  query: string
  response: string
  format: string
  apiUrl?: string
  timeoutMs?: number
  onFill?: (ad: AdUnit) => void
  onNoFill?: () => void
  onError?: (error: Error) => void
}

export async function fetchAd(options: FetchAdOptions): Promise<AdUnit | null> {
  const apiUrl = options.apiUrl || DEFAULT_API_URL
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${apiUrl}/v1/bid`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${options.publisherId}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        publisherId: options.publisherId,
        query: options.query.slice(0, 300),      // cap at 300 chars
        response: options.response.slice(0, 300),
        format: options.format,
      } satisfies Partial<BidRequest>),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      options.onError?.(new Error(`AgentAds API error: ${response.status}`))
      return null
    }

    const data = await response.json() as BidResponse

    if (data.filled && data.ad) {
      options.onFill?.(data.ad)
      return data.ad
    } else {
      options.onNoFill?.()
      return null
    }
  } catch (error) {
    clearTimeout(timeout)
    if ((error as Error).name !== 'AbortError') {
      options.onError?.(error as Error)
    }
    return null
  }
}
