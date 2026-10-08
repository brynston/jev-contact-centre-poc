import type { LlmMode, LlmOptions, PublicLlmConfig } from '../../shared/types.js';

export class LlmSelectionError extends Error {}

export function parseLlmOptions(mode: unknown, model: unknown): LlmOptions {
  if (mode !== undefined && mode !== 'direct' && mode !== 'openrouter') {
    throw new LlmSelectionError('LLM mode must be direct or openrouter.');
  }
  if (model !== undefined && (typeof model !== 'string' || !model.trim() || model.length > 200)) {
    throw new LlmSelectionError('LLM model must be a non-empty model ID of at most 200 characters.');
  }
  return { mode: mode as LlmMode | undefined, model: typeof model === 'string' ? model.trim() : undefined };
}

export function getLlmConfig(options: LlmOptions = {}) {
  const selection = parseLlmOptions(options.mode ?? (process.env.LLM_PROVIDER_MODE || 'direct'), options.model);
  const mode = selection.mode!;
  const openrouter = mode === 'openrouter';
  const prefix = openrouter ? 'OPENROUTER' : 'LLM';
  const defaultModel = process.env[`${prefix}_MODEL`]?.trim() || (openrouter ? 'openai/gpt-5-mini' : 'gpt-5-mini');
  const models = [...new Set([defaultModel, ...(process.env[`${prefix}_MODELS`] || '').split(',').map(x => x.trim()).filter(Boolean)])];
  const model = selection.model ?? defaultModel;
  const decisionModels = new Set(['cloudflare/clef', 'cloudflare/clef-flash', ...(process.env.OPENROUTER_DECISION_MODELS || '').split(',').map(x => x.trim()).filter(Boolean)]);
  const api: 'decisions' | 'chat-completions' = openrouter && decisionModels.has(model.split(':')[0]) ? 'decisions' : 'chat-completions';
  const baseUrl = (process.env[`${prefix}_BASE_URL`]?.trim() || (openrouter ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1')).replace(/\/+$/, '');
  return {
    mode,
    key: (openrouter ? process.env.OPENROUTER_API_KEY : process.env.LLM_API_KEY || process.env.OPENAI_API_KEY)?.trim(),
    keySetting: openrouter ? 'OPENROUTER_API_KEY' : 'LLM_API_KEY (or OPENAI_API_KEY)',
    baseUrl,
    decisionsUrl: process.env.OPENROUTER_DECISIONS_URL?.trim() || `${baseUrl.replace(/\/v1$/, '')}/alpha/decisions`,
    api,
    model,
    models,
    inputRate: Number(process.env[`${prefix}_INPUT_COST_PER_MILLION`] || 0),
    outputRate: Number(process.env[`${prefix}_OUTPUT_COST_PER_MILLION`] || 0)
  };
}

// Explicitly project public fields: keys and server-controlled URLs never reach the browser.
export function getPublicLlmConfig(): PublicLlmConfig {
  const defaultMode = getLlmConfig().mode;
  const publicMode = (mode: LlmMode) => {
    const config = getLlmConfig({ mode });
    return { configured: !!config.key, model: config.model, models: config.models };
  };
  return { defaultMode, direct: publicMode('direct'), openrouter: publicMode('openrouter') };
}
