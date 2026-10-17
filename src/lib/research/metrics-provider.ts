import "server-only";

/**
 * Optional external keyword-data provider (server-side only).
 *
 * No provider is bundled: PLR Champion never fabricates search volume, competition or CPC. To add verified metrics
 * later, implement this interface for a data service you subscribe to (its API key stays on the server), and return
 * it from `getKeywordMetricsProvider()`. The Keyword Finder then shows a "Fetch verified metrics" action and records
 * the provider name and date as each keyword's `metricsSource`.
 */
export interface KeywordMetricsResult {
  volume: number | null;
  competition: string | null;
  cpc: number | null;
}

export interface KeywordMetricsProvider {
  readonly id: string;
  readonly label: string;
  isConfigured(): boolean;
  lookup(keywords: string[], opts: { country?: string; language?: string }): Promise<Record<string, KeywordMetricsResult>>;
}

export function getKeywordMetricsProvider(): KeywordMetricsProvider | null {
  return null;
}
