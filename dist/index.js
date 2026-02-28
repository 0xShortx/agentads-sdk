'use strict';

var ai = require('ai');

// src/middleware.ts

// src/client.ts
var DEFAULT_API_URL = "https://api.tryagentads.com";
var DEFAULT_TIMEOUT_MS = 3e3;
var SDK_VERSION = "0.2.0";
var SDK_HEADER_VALUE = `@agentads/sdk/${SDK_VERSION}`;
async function fetchAd(options) {
  if (typeof process !== "undefined" && process.env?.AGENTADS_DISABLED === "1") {
    options.onNoFill?.();
    return null;
  }
  const apiUrl = options.apiUrl ?? DEFAULT_API_URL;
  const totalTimeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const startTime = Date.now();
  const body = {
    query: options.query.slice(0, 500),
    response: options.response.slice(0, 300),
    format: options.format,
    sessionId: options.sessionId,
    context: {
      timestamp: startTime,
      responseLength: options.response.length
    }
  };
  const headers = {
    "Authorization": `Bearer ${options.publisherApiKey}`,
    "Content-Type": "application/json",
    "X-AgentAds-SDK": SDK_HEADER_VALUE
  };
  for (let attempt = 0; attempt <= 1; attempt++) {
    const elapsed = Date.now() - startTime;
    const remaining = totalTimeoutMs - elapsed;
    if (remaining < 200) break;
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 200));
      const elapsed2 = Date.now() - startTime;
      if (totalTimeoutMs - elapsed2 < 100) break;
    }
    const controller = new AbortController();
    const timeLeft = totalTimeoutMs - (Date.now() - startTime);
    const timer = setTimeout(() => controller.abort(), timeLeft);
    try {
      const res = await fetch(`${apiUrl}/v1/bid`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      });
      clearTimeout(timer);
      if (!res.ok) {
        if (res.status < 500) {
          options.onError?.(new Error(`AgentAds API error: ${res.status}`));
          return null;
        }
        continue;
      }
      const data = await res.json();
      if (data.filled && data.ad) {
        options.onFill?.(data.ad);
        return data.ad;
      } else {
        options.onNoFill?.();
        return null;
      }
    } catch (err) {
      clearTimeout(timer);
      const error = err;
      if (error.name === "AbortError") {
        continue;
      }
      options.onError?.(error);
      return null;
    }
  }
  options.onNoFill?.();
  return null;
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
      const apiKey = config.publisherApiKey ?? config.publisherId;
      if (!apiKey) throw new Error("AgentAds: publisherApiKey is required");
      if (!config.publisherApiKey && config.publisherId) {
        console.warn("[AgentAds] publisherId is deprecated \u2014 use publisherApiKey instead");
      }
      const userMessage = extractUserQuery(params.prompt);
      if (!userMessage) return result;
      const ad = await fetchAd({
        publisherApiKey: apiKey,
        query: userMessage,
        response: result.text || "",
        format: config.format || "suffix",
        sessionId: config.sessionId,
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
      const apiKey = config.publisherApiKey ?? config.publisherId;
      if (!apiKey) throw new Error("AgentAds: publisherApiKey is required");
      if (!config.publisherApiKey && config.publisherId) {
        console.warn("[AgentAds] publisherId is deprecated \u2014 use publisherApiKey instead");
      }
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
                publisherApiKey: apiKey,
                query: userMessage,
                response: fullResponse,
                format,
                sessionId: config.sessionId,
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
        // TransformStream<StreamChunk, StreamChunk> produces ReadableStream<StreamChunk>,
        // but the AI SDK expects ReadableStream<LanguageModelV1StreamPart>. Our StreamChunk
        // union is structurally compatible at runtime; we cast via unknown to satisfy the
        // type checker without resorting to `any`.
        stream: stream.pipeThrough(
          transformStream
        ),
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
var DEFAULT_TIMEOUT_MS2 = 3e3;
async function getAd(options) {
  const apiKey = options.publisherApiKey ?? options.publisherId;
  if (!apiKey) throw new Error("AgentAds: publisherApiKey is required");
  if (!options.publisherApiKey && options.publisherId) {
    console.warn("[AgentAds] publisherId is deprecated \u2014 use publisherApiKey instead");
  }
  const format = options.format ?? "suffix";
  const ad = await fetchAd({
    publisherApiKey: apiKey,
    query: options.query,
    response: options.response,
    format,
    sessionId: options.sessionId,
    apiUrl: options.apiUrl,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS2
  });
  if (!ad) return { filled: false };
  return {
    filled: true,
    ad,
    text: options.response + renderAd(ad, format)
  };
}

// src/components/AgentAd.ts
var cardStyle = {
  marginTop: "16px",
  padding: "12px 16px",
  borderRadius: "8px",
  border: "1px solid rgba(128,128,128,0.15)",
  backgroundColor: "rgba(128,128,128,0.04)",
  fontSize: "13px",
  lineHeight: "1.5",
  fontFamily: "inherit"
};
var badgeStyle = {
  fontSize: "10px",
  fontWeight: "600",
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "#999",
  backgroundColor: "rgba(128,128,128,0.1)",
  padding: "1px 5px",
  borderRadius: "3px",
  marginRight: "6px"
};
var ctaStyle = {
  display: "inline-flex",
  alignItems: "center",
  marginTop: "8px",
  padding: "4px 10px",
  borderRadius: "5px",
  backgroundColor: "#000",
  color: "#fff",
  fontSize: "12px",
  fontWeight: "500",
  textDecoration: "none"
};
function AgentAd(props) {
  const { query, response, format = "card", ...config } = props;
  const [state, setState] = React.useState({ filled: false, ad: null });
  React.useEffect(() => {
    if (!query || !response) return;
    let cancelled = false;
    const apiKey = config.publisherApiKey || config.publisherId || "";
    fetchAd({
      publisherApiKey: apiKey,
      query,
      response,
      format: "suffix",
      sessionId: config.sessionId,
      apiUrl: config.apiUrl,
      timeoutMs: config.timeoutMs,
      onFill: (ad2) => {
        if (!cancelled) {
          setState({ filled: true, ad: ad2 });
          config.onFill?.(ad2);
        }
      },
      onNoFill: () => {
        if (!cancelled) {
          setState({ filled: false, ad: null });
          config.onNoFill?.();
        }
      },
      onError: (err) => {
        if (!cancelled) {
          setState({ filled: false, ad: null });
          config.onError?.(err);
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [query, response]);
  if (!state.filled || !state.ad) return null;
  const { ad } = state;
  if (format === "inline") {
    return React.createElement(
      "span",
      { role: "complementary", "aria-label": "Sponsored" },
      " ",
      React.createElement(
        "a",
        {
          href: ad.clickUrl,
          target: "_blank",
          rel: "noopener noreferrer sponsored",
          style: { color: "inherit", textDecoration: "underline", textDecorationStyle: "dotted" }
        },
        ad.headline
      ),
      ` \u2014 ${ad.description}`
    );
  }
  return React.createElement(
    "div",
    { role: "complementary", "aria-label": "Sponsored", style: cardStyle },
    React.createElement(
      "div",
      { style: { marginBottom: "4px" } },
      React.createElement("span", { style: badgeStyle }, "Sponsored"),
      React.createElement("span", { style: { fontWeight: "600" } }, ad.headline)
    ),
    React.createElement(
      "p",
      { style: { color: "#666", margin: 0, fontSize: "12px" } },
      ad.description
    ),
    React.createElement(
      "a",
      {
        href: ad.clickUrl,
        target: "_blank",
        rel: "noopener noreferrer sponsored",
        style: ctaStyle
      },
      ad.cta
    )
  );
}

exports.AgentAd = AgentAd;
exports.getAd = getAd;
exports.withAgentAds = withAgentAds;
