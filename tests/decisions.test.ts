import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runLlm } from '../src/server/providers/llm.js';
import { getLlmConfig, getPublicLlmConfig } from '../src/server/providers/llm-config.js';
import { buildDecisionsRequest, parseDecisionsResponse } from '../src/server/providers/decisions.js';
import { jevQuestions } from '../src/shared/questions.js';
import { completion, decisionsCompletion, interaction, output } from './fixtures/llm.js';

beforeEach(() => {
  for (const key of Object.keys(process.env).filter(k => /^(LLM_|OPENAI_|OPENROUTER_)/.test(k))) vi.stubEnv(key, undefined);
  vi.stubEnv('OPENROUTER_API_KEY', 'router-fixture');
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

function mockResponse(body: unknown = decisionsCompletion, status = 200) {
  const mock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', mock);
  return mock;
}

describe('OpenRouter Decisions configuration and dropdown models', () => {
  it.each(['cloudflare/clef', 'cloudflare/clef-flash', 'cloudflare/clef:nitro'])('automatically routes %s to Decisions', model => {
    expect(getLlmConfig({ mode: 'openrouter', model })).toMatchObject({ api: 'decisions', decisionsUrl: 'https://openrouter.ai/api/alpha/decisions' });
    expect(getLlmConfig({ mode: 'direct', model }).api).toBe('chat-completions');
  });
  it('extends the Decisions model list without changing chat models or built-in Clef routing', () => {
    vi.stubEnv('OPENROUTER_DECISION_MODELS', ' vendor/decider, , vendor/second ');
    expect(getLlmConfig({ mode: 'openrouter', model: 'vendor/decider' }).api).toBe('decisions');
    expect(getLlmConfig({ mode: 'openrouter', model: 'cloudflare/clef' }).api).toBe('decisions');
    expect(getLlmConfig({ mode: 'openrouter', model: 'openai/gpt-5-mini' }).api).toBe('chat-completions');
  });
  it('derives the Decisions endpoint from a custom proxy and supports a full URL override', () => {
    vi.stubEnv('OPENROUTER_BASE_URL', 'https://proxy.example/api/v1///');
    expect(getLlmConfig({ mode: 'openrouter' }).decisionsUrl).toBe('https://proxy.example/api/alpha/decisions');
    vi.stubEnv('OPENROUTER_DECISIONS_URL', ' https://proxy.example/custom-decisions ');
    expect(getLlmConfig({ mode: 'openrouter' }).decisionsUrl).toBe('https://proxy.example/custom-decisions');
    expect(JSON.stringify(getPublicLlmConfig())).not.toContain('proxy.example');
  });
  it('returns every configured dropdown model once, includes its default and separates direct models', () => {
    vi.stubEnv('OPENROUTER_MODEL', 'cloudflare/clef-flash');
    vi.stubEnv('OPENROUTER_MODELS', 'cloudflare/clef, openai/gpt-5-mini,cloudflare/clef-flash,cloudflare/clef,,');
    vi.stubEnv('LLM_MODEL', 'direct/default'); vi.stubEnv('LLM_MODELS', 'direct/other');
    expect(getPublicLlmConfig().openrouter.models).toEqual(['cloudflare/clef-flash', 'cloudflare/clef', 'openai/gpt-5-mini']);
    expect(getPublicLlmConfig().direct.models).toEqual(['direct/default', 'direct/other']);
  });
  it('includes a default even when the configured list is empty', () => {
    vi.stubEnv('OPENROUTER_MODEL', 'cloudflare/clef'); vi.stubEnv('OPENROUTER_MODELS', ', ,');
    expect(getPublicLlmConfig().openrouter.models).toEqual(['cloudflare/clef']);
  });
});

describe('typed Decisions requests and results', () => {
  it('reuses all six Jev questions and identical customer state without evaluation labels', () => {
    const request = buildDecisionsRequest(interaction, 'cloudflare/clef');
    expect(request.questions).toEqual(jevQuestions);
    expect(Object.keys(request.questions)).toHaveLength(6);
    expect(request.state).toEqual({ interaction: { channel: interaction.channel, subject: interaction.subject, message: interaction.message }, customer: interaction.metadata });
    expect(JSON.stringify(request)).not.toContain('groundTruth');
  });
  it.each(['cloudflare/clef', 'cloudflare/clef-flash'])('runs %s with typed questions, zero generated tokens and provider-reported cost', async model => {
    vi.stubEnv('OPENROUTER_INPUT_COST_PER_MILLION', '99');
    const mock = mockResponse();
    const result = await runLlm(interaction, { mode: 'openrouter', model });
    expect(result).toMatchObject({ provider: 'llm', llmMode: 'openrouter', llmApi: 'decisions', model, output, inputTokens: 100, outputTokens: 0, estimatedCostUsd: .0000042 });
    const [url, init] = mock.mock.calls[0];
    expect(url).toBe('https://openrouter.ai/api/alpha/decisions');
    expect(init.headers.Authorization).toBe('Bearer router-fixture');
    expect(JSON.parse(init.body)).toEqual(buildDecisionsRequest(interaction, model));
    expect(JSON.parse(init.body)).not.toHaveProperty('messages');
    expect(JSON.parse(init.body)).not.toHaveProperty('temperature');
  });
  it('preserves normal OpenRouter chat models alongside Decisions models and uses reported cost', async () => {
    mockResponse({ ...completion, usage: { ...completion.usage, cost: .123 } });
    expect(await runLlm(interaction, { mode: 'openrouter', model: 'openai/gpt-5-mini' })).toMatchObject({ output, llmApi: 'chat-completions', estimatedCostUsd: .123 });
  });
  it('uses configured fallback rates when Decisions cost is absent', async () => {
    vi.stubEnv('OPENROUTER_INPUT_COST_PER_MILLION', '2');
    mockResponse({ ...decisionsCompletion, usage: { input_tokens: 100 } });
    expect(await runLlm(interaction, { mode: 'openrouter', model: 'cloudflare/clef' })).toMatchObject({ estimatedCostUsd: .0002, outputTokens: 0 });
  });
  it.each([0.49, 0.5, 1])('uses the same 0.5 human escalation threshold as Jev: %s', noul => {
    const result = parseDecisionsResponse({ ...decisionsCompletion, answers: { ...decisionsCompletion.answers, humanEscalation: { type: 'noul', noul } } });
    expect(result.output.humanEscalation).toBe(noul >= .5);
    expect(result.output.humanEscalationProbability).toBe(noul);
  });
  it.each([
    {},
    { ...decisionsCompletion, answers: { ...decisionsCompletion.answers, route: undefined } },
    { ...decisionsCompletion, answers: { ...decisionsCompletion.answers, route: { ...decisionsCompletion.answers.route, choice: 'invalid' } } },
    { ...decisionsCompletion, answers: { ...decisionsCompletion.answers, route: { ...decisionsCompletion.answers.route, probabilities: { billing: 1 } } } },
    { ...decisionsCompletion, answers: { ...decisionsCompletion.answers, urgency: { ...decisionsCompletion.answers.urgency, probabilities: { low: 0, medium: 0, high: 0, critical: 0 } } } },
    { ...decisionsCompletion, answers: { ...decisionsCompletion.answers, humanEscalation: { type: 'noul', noul: 1.1 } } },
    { ...decisionsCompletion, answers: { ...decisionsCompletion.answers, humanEscalation: { type: 'choice', noul: .5 } } }
  ])('rejects incomplete or invalid typed answers: %j', body => {
    expect(() => parseDecisionsResponse(body)).toThrow();
  });
  it('reports Decisions API errors without leaking upstream response details', async () => {
    mockResponse({ error: 'private-upstream-details' }, 403);
    await expect(runLlm(interaction, { mode: 'openrouter', model: 'cloudflare/clef' })).rejects.toThrow('HTTP 403');
    await expect(runLlm(interaction, { mode: 'openrouter', model: 'cloudflare/clef' })).rejects.not.toThrow('private-upstream-details');
  });
});
