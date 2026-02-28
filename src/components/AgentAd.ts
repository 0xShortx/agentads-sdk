/**
 * AgentAd — drop-in React component for rendering contextual ads.
 *
 * Requires react as a peer dependency (>=17).
 *
 * Usage:
 *   import { AgentAd } from '@agentads/sdk'
 *   <AgentAd publisherApiKey="pub_..." query={query} response={response} />
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const React: any

import { fetchAd } from '../client'
import type { AdUnit, AgentAdsConfig } from '../types'

export interface AgentAdProps extends Omit<AgentAdsConfig, 'format'> {
  /** The user's query / message */
  query: string
  /** The AI's response text */
  response: string
  /** 'card' (default) — full sponsored card | 'inline' — minimal inline link */
  format?: 'card' | 'inline'
}

interface AdState {
  filled: boolean
  ad: AdUnit | null
}

// Inline styles — zero external deps
const cardStyle: Record<string, string | number> = {
  marginTop: '16px',
  padding: '12px 16px',
  borderRadius: '8px',
  border: '1px solid rgba(128,128,128,0.15)',
  backgroundColor: 'rgba(128,128,128,0.04)',
  fontSize: '13px',
  lineHeight: '1.5',
  fontFamily: 'inherit',
}

const badgeStyle: Record<string, string | number> = {
  fontSize: '10px',
  fontWeight: '600',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  color: '#999',
  backgroundColor: 'rgba(128,128,128,0.1)',
  padding: '1px 5px',
  borderRadius: '3px',
  marginRight: '6px',
}

const ctaStyle: Record<string, string | number> = {
  display: 'inline-flex',
  alignItems: 'center',
  marginTop: '8px',
  padding: '4px 10px',
  borderRadius: '5px',
  backgroundColor: '#000',
  color: '#fff',
  fontSize: '12px',
  fontWeight: '500',
  textDecoration: 'none',
}

/**
 * Drop-in React component that fetches and renders a contextual ad.
 * Renders nothing when no ad is available (zero layout shift).
 *
 * @example
 * <AgentAd publisherApiKey="pub_..." query={userMessage} response={aiResponse} />
 */
export function AgentAd(props: AgentAdProps): null | ReturnType<typeof React.createElement> {
  const { query, response, format = 'card', ...config } = props

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [state, setState] = (React.useState as (init: AdState) => [AdState, (s: AdState) => void])({ filled: false, ad: null })

  React.useEffect(() => {
    if (!query || !response) return
    let cancelled = false

    const apiKey =
      config.publisherApiKey ||
      (config as AgentAdsConfig & { publisherId?: string }).publisherId ||
      ''

    fetchAd({
      publisherApiKey: apiKey,
      query,
      response,
      format: 'suffix',
      sessionId: config.sessionId,
      apiUrl: config.apiUrl,
      timeoutMs: config.timeoutMs,
      onFill: (ad: AdUnit) => {
        if (!cancelled) {
          setState({ filled: true, ad })
          config.onFill?.(ad)
        }
      },
      onNoFill: () => {
        if (!cancelled) {
          setState({ filled: false, ad: null })
          config.onNoFill?.()
        }
      },
      onError: (err: Error) => {
        if (!cancelled) {
          setState({ filled: false, ad: null })
          config.onError?.(err)
        }
      },
    })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, response])

  if (!state.filled || !state.ad) return null

  const { ad } = state

  if (format === 'inline') {
    return React.createElement(
      'span',
      { role: 'complementary', 'aria-label': 'Sponsored' },
      ' ',
      React.createElement(
        'a',
        {
          href: ad.clickUrl,
          target: '_blank',
          rel: 'noopener noreferrer sponsored',
          style: { color: 'inherit', textDecoration: 'underline', textDecorationStyle: 'dotted' },
        },
        ad.headline
      ),
      ` — ${ad.description}`
    )
  }

  return React.createElement(
    'div',
    { role: 'complementary', 'aria-label': 'Sponsored', style: cardStyle },
    React.createElement(
      'div',
      { style: { marginBottom: '4px' } },
      React.createElement('span', { style: badgeStyle }, 'Sponsored'),
      React.createElement('span', { style: { fontWeight: '600' } }, ad.headline)
    ),
    React.createElement(
      'p',
      { style: { color: '#666', margin: 0, fontSize: '12px' } },
      ad.description
    ),
    React.createElement(
      'a',
      {
        href: ad.clickUrl,
        target: '_blank',
        rel: 'noopener noreferrer sponsored',
        style: ctaStyle,
      },
      ad.cta
    )
  )
}
