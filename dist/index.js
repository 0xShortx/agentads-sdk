'use strict';

var ai = require('ai');

// src/middleware.ts

// src/client.ts
var DEFAULT_API_URL = "https://api.tryagentads.com";
var DEFAULT_TIMEOUT_MS = 50;
async function fetchAd(options) {
  const apiUrl = options.apiUrl || DEFAULT_API_URL;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${apiUrl}/v1/bid`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${options.publisherId}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        publisherId: options.publisherId,
        query: options.query.slice(0, 300),
        // cap at 300 chars
        response: options.response.slice(0, 300),
        format: options.format
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!response.ok) {
      options.onError?.(new Error(`AgentAds API error: ${response.status}`));
      return null;
    }
    const data = await response.json();
    if (data.filled && data.ad) {
      options.onFill?.(data.ad);
      return data.ad;
    } else {
      options.onNoFill?.();
      return null;
    }
  } catch (error) {
    clearTimeout(timeout);
    if (error.name !== "AbortError") {
      options.onError?.(error);
    }
    return null;
  }
}

// src/formats.ts
function renderAd(ad, format) {
  switch (format) {
    case "suffix":
      return `

---
*Ad \xB7 ${ad.headline} \u2014 ${ad.description} [${ad.cta}](${ad.clickUrl})*`;
    case "citation":
      return `

> **Sponsored:** ${ad.headline} \u2014 ${ad.description} [${ad.cta}](${ad.clickUrl})`;
    case "followup":
      return `

\u{1F4A1} *Sponsored suggestion: [${ad.headline}](${ad.clickUrl}) \u2014 ${ad.description}*`;
    default:
      return `

---
*Ad \xB7 ${ad.headline} [${ad.cta}](${ad.clickUrl})*`;
  }
}

// src/middleware.ts
function withAgentAds(model, config) {
  if (config.disabled) return model;
  const middleware = {
    middlewareVersion: "v1",
    // Non-streaming: generateText, generateObject
    wrapGenerate: async ({ doGenerate, params }) => {
      const result = await doGenerate();
      const userMessage = extractUserQuery(params.prompt);
      if (!userMessage) return result;
      const ad = await fetchAd({
        publisherId: config.publisherId,
        query: userMessage,
        response: result.text || "",
        format: config.format || "suffix",
        apiUrl: config.apiUrl,
        timeoutMs: config.timeoutMs ?? 50,
        onFill: config.onFill,
        onNoFill: config.onNoFill,
        onError: config.onError
      });
      if (!ad) return result;
      return {
        ...result,
        text: (result.text || "") + renderAd(ad, config.format || "suffix")
      };
    },
    // Streaming: streamText
    wrapStream: async ({ doStream, params }) => {
      const { stream, ...rest } = await doStream();
      const userMessage = extractUserQuery(params.prompt);
      let fullResponse = "";
      let adInjected = false;
      let adFetchPromise = null;
      const format = config.format || "suffix";
      const transformStream = new TransformStream({
        transform(chunk, controller) {
          if (chunk.type === "text-delta" && typeof chunk.textDelta === "string") {
            fullResponse += chunk.textDelta;
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
                onError: config.onError
              });
            }
          }
          controller.enqueue(chunk);
        },
        async flush(controller) {
          if (adFetchPromise && !adInjected) {
            try {
              const ad = await adFetchPromise;
              if (ad) {
                adInjected = true;
                const adText = renderAd(ad, format);
                controller.enqueue({ type: "text-delta", textDelta: adText });
              }
            } catch {
            }
          }
        }
      });
      return {
        stream: stream.pipeThrough(transformStream),
        ...rest
      };
    }
  };
  return ai.wrapLanguageModel({ model, middleware });
}
function extractUserQuery(prompt) {
  if (!Array.isArray(prompt)) return null;
  for (let i = prompt.length - 1; i >= 0; i--) {
    const msg = prompt[i];
    if (msg.role === "user") {
      const content = msg.content;
      if (typeof content === "string") return content;
      if (Array.isArray(content)) {
        const textPart = content.find((p) => p.type === "text");
        if (textPart && textPart.type === "text") return textPart.text;
      }
    }
  }
  return null;
}

// src/rest.ts
async function getAd(options) {
  const format = options.format || "suffix";
  const ad = await fetchAd({
    publisherId: options.publisherId,
    query: options.query,
    response: options.response,
    format,
    apiUrl: options.apiUrl,
    timeoutMs: options.timeoutMs ?? 50
  });
  if (!ad) return { filled: false };
  return {
    filled: true,
    ad,
    text: options.response + renderAd(ad, format)
  };
}

exports.getAd = getAd;
exports.withAgentAds = withAgentAds;
