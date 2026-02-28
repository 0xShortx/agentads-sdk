# @agentads/sdk

[![npm version](https://img.shields.io/npm/v/@agentads/sdk.svg)](https://www.npmjs.com/package/@agentads/sdk)
[![license](https://img.shields.io/npm/l/@agentads/sdk.svg)](./LICENSE)

**Monetize your AI app — add revenue to AI responses in 5 lines.**

AgentAds is an ad network built for AI applications. Publishers wrap their AI model once and earn revenue every time a relevant ad is matched to a user query. Ads are non-intrusive, clearly labeled, and rendered in Markdown.

Visit [tryagentads.com](https://tryagentads.com) to get your publisher ID.

---

## Installation

```bash
npm install @agentads/sdk
# or
pnpm add @agentads/sdk
# or
bun add @agentads/sdk
```

---

## Quick Start — Vercel AI SDK

Wrap your model once. Every `generateText` and `streamText` call is automatically monetized.

```typescript
import { openai } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { withAgentAds } from '@agentads/sdk'

const model = withAgentAds(openai('gpt-4o'), {
  publisherId: 'pub_your_id_here',
})

const { text } = await generateText({
  model,
  prompt: 'What is the best CRM for small businesses?',
})

// text now includes your AI response + a relevant ad (if filled)
console.log(text)
```

Works with `streamText` too — the ad is appended as the final chunk, after your stream completes:

```typescript
import { streamText } from 'ai'

const result = streamText({
  model,
  prompt: 'Recommend a project management tool',
})

for await (const chunk of result.textStream) {
  process.stdout.write(chunk)
}
```

---

## Quick Start — REST API (no framework)

For apps not using the Vercel AI SDK, use the standalone `getAd` function:

```typescript
import { getAd } from '@agentads/sdk'

// Call your AI model however you want
const aiResponse = await myModel.complete(userMessage)

// Enrich with an ad
const result = await getAd({
  publisherId: 'pub_your_id_here',
  query: userMessage,
  response: aiResponse,
})

if (result.filled) {
  sendToUser(result.text)  // original response + ad appended
} else {
  sendToUser(aiResponse)   // no ad matched, pass through unchanged
}
```

---

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `publisherId` | `string` | **required** | Your AgentAds publisher ID |
| `format` | `'suffix' \| 'citation' \| 'followup'` | `'suffix'` | How the ad is rendered in the response |
| `timeoutMs` | `number` | `50` | Max ms to wait for an ad — never blocks the user |
| `disabled` | `boolean` | `false` | Set `true` to disable ads (e.g. for paid subscribers) |
| `apiUrl` | `string` | `https://api.tryagentads.com` | Override the API endpoint |
| `onFill` | `(ad: AdUnit) => void` | - | Called when an ad is served |
| `onNoFill` | `() => void` | - | Called when no ad matched |
| `onError` | `(error: Error) => void` | - | Called on network or API errors |

### Example with callbacks

```typescript
const model = withAgentAds(openai('gpt-4o'), {
  publisherId: 'pub_your_id_here',
  format: 'citation',
  timeoutMs: 80,
  disabled: user.isPro,           // no ads for paying users
  onFill: (ad) => analytics.track('ad_filled', { headline: ad.headline }),
  onNoFill: () => analytics.track('ad_no_fill'),
  onError: (err) => console.error('[AgentAds]', err.message),
})
```

---

## Ad Formats

Three formats are supported, all rendered in Markdown and clearly labeled as ads.

### `suffix` (default)

Appended below the response, separated by a horizontal rule.

```
Your AI response content here...

---
*Ad · Acme CRM — The CRM built for growing teams. [Try free](https://example.com)*
```

### `citation`

Rendered as a blockquote, fits naturally after citations or references.

```
Your AI response content here...

> **Sponsored:** Acme CRM — The CRM built for growing teams. [Try free](https://example.com)
```

### `followup`

Framed as a suggestion, works well for recommendation-style queries.

```
Your AI response content here...

💡 *Sponsored suggestion: [Acme CRM](https://example.com) — The CRM built for growing teams.*
```

---

## How It Works

1. **Wrap once.** Call `withAgentAds(model, config)` when you initialize your model.
2. **Zero latency impact.** The auction runs with a 50ms timeout. If no ad returns in time, your response goes out unchanged — users never wait.
3. **Intent-matched ads.** The SDK sends the user query and the first 300 chars of the AI response to the AgentAds auction. Only contextually relevant ads are served.
4. **No PII sent.** Only the query text and response snippet are transmitted — no user IDs, IP addresses, or session data by default.
5. **Non-blocking streams.** For streaming responses, the ad fetch is fired early (after 50 chars of response), then appended as the final stream chunk after the model finishes.

---

## TypeScript Types

All types are exported:

```typescript
import type { AgentAdsConfig, AdUnit, AdFormat, AgentAdsResult } from '@agentads/sdk'
```

---

## License

MIT — see [LICENSE](./LICENSE)

---

Made by [AgentAds](https://tryagentads.com) — the ad network for the AI era.
