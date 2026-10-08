import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runLlm } from '../src/server/providers/llm.js';
import { getLlmConfig, getPublicLlmConfig, parseLlmOptions } from '../src/server/providers/llm-config.js';
import { completion, interaction, output } from './fixtures/llm.js';

beforeEach(() => {
  for (const key of Object.keys(process.env).filter(k => /^(LLM_|OPENAI_|OPENROUTER_)/.test(k))) vi.stubEnv(key, undefined);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

function mockCompletion(body: unknown = completion, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('LLM mode configuration', () => {
  it('preserves the direct default and legacy settings', () => {
    vi.stubEnv('LLM_API_KEY', 'legacy-key'); vi.stubEnv('OPENAI_API_KEY', 'other-key');
    vi.stubEnv('LLM_BASE_URL', 'https://direct.example/v1///'); vi.stubEnv('LLM_MODEL', 'custom');
    expect(getLlmConfig()).toMatchObject({ mode: 'direct', key: 'legacy-key', model: 'custom', baseUrl: 'https://direct.example/v1' });
  });
  it('accepts OPENAI_API_KEY without requiring LLM_API_KEY', () => {
    vi.stubEnv('OPENAI_API_KEY', 'openai-key');
    expect(getLlmConfig()).toMatchObject({ mode: 'direct', key: 'openai-key', model: 'gpt-5-mini', baseUrl: 'https://api.openai.com/v1' });
  });
  it('selects OpenRouter via environment with isolated defaults and rates', () => {
    vi.stubEnv('LLM_PROVIDER_MODE', 'openrouter'); vi.stubEnv('LLM_API_KEY', 'direct-key');
    vi.stubEnv('LLM_INPUT_COST_PER_MILLION', '99'); vi.stubEnv('OPENROUTER_API_KEY', 'router-key');
    expect(getLlmConfig()).toMatchObject({ mode: 'openrouter', key: 'router-key', model: 'openai/gpt-5-mini', baseUrl: 'https://openrouter.ai/api/v1', inputRate: 0 });
  });
  it('exposes only readiness and model suggestions', () => {
    vi.stubEnv('LLM_API_KEY', 'private-direct-key'); vi.stubEnv('OPENROUTER_API_KEY', 'private-router-key');
    vi.stubEnv('OPENROUTER_MODEL', 'vendor/default'); vi.stubEnv('OPENROUTER_MODELS', ' vendor/other, vendor/default,,vendor/other ');
    expect(getPublicLlmConfig()).toEqual({ defaultMode: 'direct', direct: { configured: true, model: 'gpt-5-mini', models: ['gpt-5-mini'] }, openrouter: { configured: true, model: 'vendor/default', models: ['vendor/default', 'vendor/other'] } });
  });
  it.each(['invalid', '', ['direct'], { mode: 'direct' }])('rejects invalid modes: %j', mode => {
    expect(() => parseLlmOptions(mode, undefined)).toThrow('LLM mode');
  });
  it.each(['', '  ', ['model'], 'x'.repeat(201)])('rejects invalid model IDs: %j', model => {
    expect(() => parseLlmOptions('direct', model)).toThrow('LLM model');
  });
});

describe('LLM requests', () => {
  it.each(['direct', 'openrouter'] as const)('routes %s with the selected model and key without temperature or ground truth', async mode => {
    vi.stubEnv('LLM_API_KEY', 'direct-key'); vi.stubEnv('OPENROUTER_API_KEY', 'router-key');
    vi.stubEnv('LLM_INPUT_COST_PER_MILLION', '3'); vi.stubEnv('LLM_OUTPUT_COST_PER_MILLION', '4');
    vi.stubEnv('OPENROUTER_INPUT_COST_PER_MILLION', '1'); vi.stubEnv('OPENROUTER_OUTPUT_COST_PER_MILLION', '2');
    const fetchMock = mockCompletion();
    const result = await runLlm(interaction, { mode, model: 'vendor/selected' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(mode === 'direct' ? 'https://api.openai.com/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions');
    expect(init.headers.Authorization).toBe(`Bearer ${mode === 'direct' ? 'direct-key' : 'router-key'}`);
    const request = JSON.parse(init.body);
    expect(Object.keys(request).sort()).toEqual(['messages', 'model']);
    expect(request.model).toBe('vendor/selected');
    expect(JSON.parse(request.messages[1].content)).toEqual({ channel: interaction.channel, subject: interaction.subject, message: interaction.message, metadata: interaction.metadata });
    expect(result).toMatchObject({ provider: 'llm', llmMode: mode, model: 'vendor/selected', output, inputTokens: 100, outputTokens: 50, estimatedCostUsd: mode === 'direct' ? .0005 : .0002 });
    expect(JSON.stringify(result)).not.toContain('-key');
  });
  it('uses custom OpenRouter endpoint/model and handles fenced JSON without usage', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'router-key'); vi.stubEnv('OPENROUTER_BASE_URL', 'https://router.example/v1/');
    vi.stubEnv('OPENROUTER_MODEL', 'vendor/default');
    const mock = mockCompletion({ choices: [{ message: { content: '```json\n' + JSON.stringify(output) + '\n```' } }] });
    expect(await runLlm(interaction, { mode: 'openrouter' })).toMatchObject({ model: 'vendor/default', output, estimatedCostUsd: 0 });
    expect(mock.mock.calls[0][0]).toBe('https://router.example/v1/chat/completions');
  });
  it('does not fall back to a configured direct key when OpenRouter is missing', async () => {
    vi.stubEnv('LLM_API_KEY', 'direct-key');
    const mock = mockCompletion();
    await expect(runLlm(interaction, { mode: 'openrouter' })).rejects.toThrow('OPENROUTER_API_KEY is not set');
    expect(mock).not.toHaveBeenCalled();
  });
  it('does not use the OpenRouter key for direct calls', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'router-key');
    await expect(runLlm(interaction, { mode: 'direct' })).rejects.toThrow('LLM_API_KEY (or OPENAI_API_KEY) is not set');
  });
  it('reports upstream HTTP failures without leaking response bodies', async () => {
    vi.stubEnv('LLM_API_KEY', 'direct-key'); mockCompletion({ error: 'secret-from-upstream' }, 401);
    await expect(runLlm(interaction)).rejects.toThrow('HTTP 401');
    await expect(runLlm(interaction)).rejects.not.toThrow('secret-from-upstream');
  });
  it.each([
    { error: { message: 'provider error' } },
    { choices: [] },
    { choices: [{ message: { content: null } }] },
    { choices: [{ message: { content: 'not json' } }] },
    { choices: [{ message: { content: '{"route":"invalid"}' } }] }
  ])('rejects unsuccessful or invalid responses: %j', async body => {
    vi.stubEnv('LLM_API_KEY', 'direct-key'); mockCompletion(body);
    await expect(runLlm(interaction)).rejects.toThrow();
  });
});
