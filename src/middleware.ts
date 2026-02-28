import type {
  LanguageModelV1,
  LanguageModelV1CallOptions,
  LanguageModelV1Prompt,
  LanguageModelV1Message,
} from '@ai-sdk/provider'
import { wrapLanguageModel, type LanguageModelV1Middleware } from 'ai'
import type { AgentAdsConfig } from './types'
import { fetchAd } from './client'
import { renderAd } from './formats'

export function withAgentAds(
  model: LanguageModelV1,
  config: AgentAdsConfig
): LanguageModelV1 {
  if (config.disabled) return model

  const middleware: LanguageModelV1Middleware = {
    middlewareVersion: 'v1',

    // Non-streaming: generateText, generateObject
    wrapGenerate: async ({ doGenerate, params }: {
      doGenerate: () => ReturnType<LanguageModelV1['doGenerate']>
      doStream: () => ReturnType<LanguageModelV1['doStream']>
      params: LanguageModelV1CallOptions
      model: LanguageModelV1
    }) => {
      const result = await doGenerate()

      // Extract user query from messages
      const userMessage = extractUserQuery(params.prompt)
      if (!userMessage) return result

      const ad = await fetchAd({
        publisherId: config.publisherId,
        query: userMessage,
        response: result.text || '',
        format: config.format || 'suffix',
        apiUrl: config.apiUrl,
        timeoutMs: config.timeoutMs ?? 50,
        onFill: config.onFill,
        onNoFill: config.onNoFill,
        onError: config.onError,
      })

      if (!ad) return result

      return {
        ...result,
        text: (result.text || '') + renderAd(ad, config.format || 'suffix'),
      }
    },

    // Streaming: streamText
    wrapStream: async ({ doStream, params }: {
      doGenerate: () => ReturnType<LanguageModelV1['doGenerate']>
      doStream: () => ReturnType<LanguageModelV1['doStream']>
      params: LanguageModelV1CallOptions
      model: LanguageModelV1
    }) => {
      const { stream, ...rest } = await doStream()

      const userMessage = extractUserQuery(params.prompt)
      let fullResponse = ''
      let adInjected = false
      let adFetchPromise: ReturnType<typeof fetchAd> | null = null

      const format = config.format || 'suffix'

      type StreamChunk = { type: string; textDelta?: string; [key: string]: unknown }

      const transformStream = new TransformStream<StreamChunk, StreamChunk>({
        transform(chunk, controller) {
          // Accumulate response text
          if (chunk.type === 'text-delta' && typeof chunk.textDelta === 'string') {
            fullResponse += chunk.textDelta

            // Fire ad fetch after we have 50+ chars (enough to classify intent)
            if (!adFetchPromise && fullResponse.length >= 50 && userMessage) {
              adFetchPromise = fetchAd({
                publisherId: config.publisherId,
                query: userMessage,
                response: fullResponse,
                format,
                apiUrl: config.apiUrl,
                timeoutMs: config.timeoutMs ?? 50,
                onFill: config.onFill,
                onNoFill: config.onNoFill,
                onError: config.onError,
              })
            }
          }

          controller.enqueue(chunk)
        },

        async flush(controller) {
          // Append ad as final chunk after stream completes
          if (adFetchPromise && !adInjected) {
            try {
              const ad = await adFetchPromise
              if (ad) {
                adInjected = true
                const adText = renderAd(ad, format)
                controller.enqueue({ type: 'text-delta', textDelta: adText })
              }
            } catch {
              // Never let ad errors affect the stream
            }
          }
        },
      })

      return {
        stream: stream.pipeThrough(transformStream as TransformStream<any, any>),
        ...rest,
      }
    },
  }

  return wrapLanguageModel({ model, middleware })
}

function extractUserQuery(prompt: LanguageModelV1Prompt): string | null {
  if (!Array.isArray(prompt)) return null

  // Walk messages in reverse to find last user message
  for (let i = prompt.length - 1; i >= 0; i--) {
    const msg = prompt[i] as LanguageModelV1Message
    if (msg.role === 'user') {
      const content = msg.content
      if (typeof content === 'string') return content
      if (Array.isArray(content)) {
        const textPart = content.find((p) => p.type === 'text')
        if (textPart && textPart.type === 'text') return textPart.text
      }
    }
  }
  return null
}
