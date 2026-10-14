import z from '@deepseek-ai/schemastery';
import { credentialRef } from '@deepseek-ai/dsh-credentials';
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment';
import { CodexLocalSearchProvider } from './provider.js';

export { CodexLocalSearchProvider, responsesEndpoint, buildSearchRequest } from './provider.js';
export { extractResponsesSources, extractResponsesText } from './extract.js';
export { createResponsesSseParser, consumeResponsesSseResponse } from './responses-sse.js';
export const name = 'web-search-codex';
export const inject = ['web'];
export const CODEX_LOCAL_PROVIDER_ID = 'codex-local';
export const Config = z.object({
  apiKeyEnv: z.string().role('credential-ref').default('CODEX_SEARCH_API_KEY').volatile(),
  baseURL: z.string().volatile(),
  model: z.string().volatile(),
  searchContextSize: z.union(['low', 'medium', 'high']).default('medium').volatile(),
  stream: z.boolean().default(true).volatile(),
  maxOutputTokens: z.number().step(1).min(1).default(4096).volatile(),
  reasoningEffort: z.union(['none', 'low', 'medium', 'high']).default('low').volatile(),
  timeoutMs: z.number().step(1).min(1000).max(600000).default(90000).volatile(),
});

/** Every operation reads current volatile fields; credentials stay outside the patch. */
export function apply(ctx, config) {
  ctx.web.registerSearchProvider(new CodexLocalSearchProvider(() => {
    const ref = credentialRef(config.apiKeyEnv.get());
    return {
      apiKeyEnv: ref,
      resolveApiKey: async () => {
        const credentials = ctx.get('credentials');
        if (credentials !== undefined) return (await credentials.resolve(ref))?.value;
        return launchEnvironmentOf(ctx).get(ref)?.value;
      },
      baseURL: config.baseURL.get() ?? '',
      model: config.model.get() ?? '',
      searchContextSize: config.searchContextSize.get(),
      stream: config.stream.get(),
      maxOutputTokens: config.maxOutputTokens.get(),
      reasoningEffort: config.reasoningEffort.get(),
      timeoutMs: config.timeoutMs.get(),
    };
  }));
}
