import { LanguageModelV1 } from '@ai-sdk/provider';

type AdFormat = 'suffix' | 'citation' | 'followup';
interface AgentAdsConfig {
    publisherId: string;
    format?: AdFormat;
    apiUrl?: string;
    timeoutMs?: number;
    disabled?: boolean;
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
}
type AgentAdsResult = {
    filled: true;
    ad: AdUnit;
    text: string;
} | {
    filled: false;
};

declare function withAgentAds(model: LanguageModelV1, config: AgentAdsConfig): LanguageModelV1;

/**
 * Simple function for non-Vercel-AI-SDK users.
 * Pass your user query and AI response, get back the enriched response.
 *
 * @example
 * const result = await getAd({
 *   publisherId: 'pub_xxx',
 *   query: userMessage,
 *   response: aiResponse,
 * })
 * if (result.filled) {
 *   sendToUser(result.text) // AI response + ad appended
 * }
 */
declare function getAd(options: {
    publisherId: string;
    query: string;
    response: string;
    format?: AgentAdsConfig['format'];
    apiUrl?: string;
    timeoutMs?: number;
}): Promise<AgentAdsResult>;

export { type AdFormat, type AdUnit, type AgentAdsConfig, type AgentAdsResult, getAd, withAgentAds };
