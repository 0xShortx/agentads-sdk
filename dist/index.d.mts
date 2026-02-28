import { LanguageModelV1 } from '@ai-sdk/provider';

type AdFormat = 'suffix' | 'citation' | 'followup';
interface AgentAdsConfig {
    publisherApiKey: string;
    /** @deprecated use publisherApiKey */
    publisherId?: string;
    format?: AdFormat;
    apiUrl?: string;
    timeoutMs?: number;
    disabled?: boolean;
    sessionId?: string;
    onFill?: (ad: AdUnit) => void;
    onNoFill?: () => void;
    onError?: (error: Error) => void;
}
interface AdUnit {
    format: AdFormat;
    headline: string;
    description: string;
    cta: string;
    clickUrl: string;
    label: 'Ad';
    conversionToken?: string;
    conversionUrl?: string;
}
interface AgentAdsResult {
    filled: boolean;
    ad?: AdUnit;
    text?: string;
}

declare function withAgentAds(model: LanguageModelV1, config: AgentAdsConfig): LanguageModelV1;

/**
 * Simple function for non-Vercel-AI-SDK users.
 * Pass your user query and AI response, get back the enriched response.
 *
 * @example
 * const result = await getAd({
 *   publisherApiKey: 'pub_xxx',
 *   query: userMessage,
 *   response: aiResponse,
 * })
 * if (result.filled) {
 *   sendToUser(result.text) // AI response + ad appended
 * }
 */
declare function getAd(options: {
    publisherApiKey: string;
    /** @deprecated use publisherApiKey */
    publisherId?: string;
    query: string;
    response: string;
    format?: AgentAdsConfig['format'];
    sessionId?: string;
    apiUrl?: string;
    timeoutMs?: number;
}): Promise<AgentAdsResult>;

/**
 * AgentAd — drop-in React component for rendering contextual ads.
 *
 * Requires react as a peer dependency (>=17).
 *
 * Usage:
 *   import { AgentAd } from '@agentads/sdk'
 *   <AgentAd publisherApiKey="pub_..." query={query} response={response} />
 */
declare const React: any;

interface AgentAdProps extends Omit<AgentAdsConfig, 'format'> {
    /** The user's query / message */
    query: string;
    /** The AI's response text */
    response: string;
    /** 'card' (default) — full sponsored card | 'inline' — minimal inline link */
    format?: 'card' | 'inline';
}
/**
 * Drop-in React component that fetches and renders a contextual ad.
 * Renders nothing when no ad is available (zero layout shift).
 *
 * @example
 * <AgentAd publisherApiKey="pub_..." query={userMessage} response={aiResponse} />
 */
declare function AgentAd(props: AgentAdProps): null | ReturnType<typeof React.createElement>;

export { type AdFormat, type AdUnit, AgentAd, type AgentAdProps, type AgentAdsConfig, type AgentAdsResult, getAd, withAgentAds };
