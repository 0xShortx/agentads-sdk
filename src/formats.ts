import type { AdUnit, AdFormat } from './types'

export function renderAd(ad: AdUnit, format: AdFormat): string {
  switch (format) {
    case 'suffix':
      return `\n\n---\n*Ad · ${ad.headline} — ${ad.description} [${ad.cta}](${ad.clickUrl})*`

    case 'citation':
      return `\n\n> **Sponsored:** ${ad.headline} — ${ad.description} [${ad.cta}](${ad.clickUrl})`

    case 'followup':
      return `\n\n💡 *Sponsored suggestion: [${ad.headline}](${ad.clickUrl}) — ${ad.description}*`

    default:
      return `\n\n---\n*Ad · ${ad.headline} [${ad.cta}](${ad.clickUrl})*`
  }
}
