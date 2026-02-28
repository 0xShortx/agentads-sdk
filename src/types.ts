export type AdFormat = 'suffix' | 'citation' | 'followup'

export interface AgentAdsConfig {
  publisherApiKey: string           // the publisher API key
  /** @deprecated use publisherApiKey */
  publisherId?: string              // backward-compat alias
  format?: AdFormat
  apiUrl?: string
  timeoutMs?: number
  disabled?: boolean
  sessionId?: string
  onFill?: (ad: AdUnit) => void
  onNoFill?: () => void
  onError?: (error: Error) => void
}

export interface AdUnit {
  format: AdFormat
  headline: string
  description: string
  cta: string
  clickUrl: string
  label: 'Ad'
  conversionToken?: string          // NEW — for advertiser postback pixel
  conversionUrl?: string            // NEW — pre-built pixel URL (convenience)
}

export interface AgentAdsResult {
  filled: boolean
  ad?: AdUnit
  text?: string                     // response + rendered ad (only when filled)
}

// Internal types (not exported)
export interface BidRequest {
  query: string                     // keep raw query for classifier (server anonymizes)
  response: string
  format: AdFormat
  sessionId?: string
  context: {
    timestamp: number
    responseLength: number
  }
}

export interface BidResponse {
  filled: boolean
  requestId: string
  ad?: AdUnit
  debugInfo?: {
    category: string
    matchedKeywords: string[]
    winningBid: number
    auctionMs: number
  }
}
