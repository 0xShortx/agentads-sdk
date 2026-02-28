export type AdFormat = 'suffix' | 'citation' | 'followup'

export interface AgentAdsConfig {
  publisherId: string
  format?: AdFormat
  apiUrl?: string               // default: https://api.tryagentads.com
  timeoutMs?: number            // default: 50ms — never blocks user
  disabled?: boolean            // disable ads (e.g. for paid users)
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
}

export interface BidRequest {
  publisherId: string
  query: string
  response: string
  format: AdFormat
  sessionId?: string
}

export interface BidResponse {
  filled: boolean
  requestId: string
  ad?: AdUnit
}

export type AgentAdsResult =
  | { filled: true; ad: AdUnit; text: string }
  | { filled: false }
