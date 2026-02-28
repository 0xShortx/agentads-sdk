import type { BidRequest, BidResponse, AdUnit } from './types'

const DEFAULT_API_URL = 'https://api.tryagentads.com'
const DEFAULT_TIMEOUT_MS = 3000
const SDK_VERSION = '0.2.0'
const SDK_HEADER_VALUE = `@agentads/sdk/${SDK_VERSION}`

interface FetchAdOptions {
  publisherApiKey: string
  query: string
  response: string
  format: string
  sessionId?: string
  apiUrl?: string
  timeoutMs?: number
  onFill?: (ad: AdUnit) => void
  onNoFill?: () => void
  onError?: (error: Error) => void
}

export async function fetchAd(options: FetchAdOptions): Promise<AdUnit | null> {
  // Env var kill switch (Node.js environments)
  if (typeof process !== 'undefined' && process.env?.AGENTADS_DISABLED === '1') {
    options.onNoFill?.()
    return null
  }

  const apiUrl = options.apiUrl ?? DEFAULT_API_URL
  const totalTimeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const startTime = Date.now()

  const body: BidRequest = {
    query: options.query.slice(0, 500),
    response: options.response.slice(0, 300),
    format: options.format as BidRequest['format'],
    sessionId: options.sessionId,
    context: {
      timestamp: startTime,
      responseLength: options.response.length,
    },
  }

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${options.publisherApiKey}`,
    'Content-Type': 'application/json',
    'X-AgentAds-SDK': SDK_HEADER_VALUE,
  }

  // Attempt with 1 retry
  for (let attempt = 0; attempt <= 1; attempt++) {
    const elapsed = Date.now() - startTime
    const remaining = totalTimeoutMs - elapsed

    if (remaining < 200) break // not enough budget

    if (attempt > 0) {
      // Exponential backoff: 200ms before retry
      await new Promise<void>((r) => setTimeout(r, 200))
      const elapsed2 = Date.now() - startTime
      if (totalTimeoutMs - elapsed2 < 100) break
    }

    const controller = new AbortController()
    const timeLeft = totalTimeoutMs - (Date.now() - startTime)
    const timer = setTimeout(() => controller.abort(), timeLeft)

    try {
      const res = await fetch(`${apiUrl}/v1/bid`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      clearTimeout(timer)

      if (!res.ok) {
        // Don't retry on 4xx (auth failure, bad request) — only on 5xx/network
        if (res.status < 500) {
          options.onError?.(new Error(`AgentAds API error: ${res.status}`))
          return null
        }
        // 5xx: allow retry
        continue
      }

      const data = (await res.json()) as BidResponse

      if (data.filled && data.ad) {
        options.onFill?.(data.ad)
        return data.ad
      } else {
        options.onNoFill?.()
        return null
      }
    } catch (err) {
      clearTimeout(timer)
      const error = err as Error
      if (error.name === 'AbortError') {
        // Timeout — try once more if budget allows
        continue
      }
      options.onError?.(error)
      return null
    }
  }

  // All attempts exhausted
  options.onNoFill?.()
  return null
}
