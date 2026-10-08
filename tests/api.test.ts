import type { Request, Response, RequestHandler } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { healthHandler, runProviderHandler } from '../src/server/app.js';
import { runJev } from '../src/server/providers/jev.js';
import { runLlm } from '../src/server/providers/llm.js';
import { completion, interaction, output } from './fixtures/llm.js';

vi.mock('../src/server/providers/jev.js', () => ({ runJev: vi.fn() }));
vi.mock('../src/server/providers/llm.js', () => ({ runLlm: vi.fn() }));

// Call the real Express handlers without opening sockets or contacting live providers.
async function request(handler: RequestHandler, provider = 'llm', query: Record<string, unknown> = {}) {
  let body: any;
  const response = {
    statusCode: 200,
    status(code: number) { this.statusCode = code; return this; },
    json(value: unknown) { body = value; return this; }
  };
  await handler({ params: { provider }, query, body: interaction } as unknown as Request, response as unknown as Response, vi.fn());
  return { status: response.statusCode, body };
}
const post = (route: string) => {
  const url = new URL(route, 'http://fixture.test');
  const query: Record<string, unknown> = {};
  for (const key of new Set(url.searchParams.keys())) {
    const values = url.searchParams.getAll(key);
    query[key] = values.length > 1 ? values : values[0];
  }
  return request(runProviderHandler, url.pathname.split('/').at(-1), query);
};

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of Object.keys(process.env).filter(k => /^(LLM_|OPENAI_|OPENROUTER_)/.test(k))) vi.stubEnv(key, undefined);
  vi.mocked(runLlm).mockResolvedValue({ provider: 'llm', llmMode: 'openrouter', model: 'vendor/model', latencyMs: 1, output });
  vi.mocked(runJev).mockResolvedValue({ provider: 'jev', model: 'jev-latest', latencyMs: 1, output, raw: completion });
});
afterEach(() => vi.unstubAllEnvs());

describe('API provider selection', () => {
  it('provides independent readiness and models without server secrets or URLs', async () => {
    vi.stubEnv('LLM_PROVIDER_MODE', 'openrouter'); vi.stubEnv('OPENROUTER_API_KEY', 'private-key');
    vi.stubEnv('OPENROUTER_BASE_URL', 'https://private-url.example');
    const { body } = await request(healthHandler);
    expect(body).toMatchObject({ ok: true, llmConfigured: true, llm: { defaultMode: 'openrouter', direct: { configured: false }, openrouter: { configured: true } } });
    expect(JSON.stringify(body)).not.toMatch(/private-key|private-url/);
  });
  it('routes mode/model overrides to the comparator and preserves the interaction body', async () => {
    const res = await post('/api/run/llm?mode=openrouter&model=vendor%2Fmodel');
    expect(res.status).toBe(200);
    expect(runLlm).toHaveBeenCalledWith(interaction, { mode: 'openrouter', model: 'vendor/model' });
    expect(runJev).not.toHaveBeenCalled();
  });
  it('retains legacy POST /api/run/llm calls', async () => {
    expect((await post('/api/run/llm')).status).toBe(200);
    expect(runLlm).toHaveBeenCalledWith(interaction, { mode: undefined, model: undefined });
  });
  it('preserves Jev routing independently of comparator parameters', async () => {
    const res = await post('/api/run/jev?mode=invalid');
    expect(res.status).toBe(200); expect(res.body.provider).toBe('jev');
    expect(runJev).toHaveBeenCalledWith(interaction); expect(runLlm).not.toHaveBeenCalled();
  });
  it.each(['mode=invalid', 'mode=direct&mode=openrouter', 'model=', 'model=x&model=y'])('rejects malformed selection: %s', async query => {
    expect((await post(`/api/run/llm?${query}`)).status).toBe(400);
    expect(runLlm).not.toHaveBeenCalled();
  });
  it('rejects unknown providers instead of making a comparator call', async () => {
    expect((await post('/api/run/unknown')).status).toBe(404);
    expect(runLlm).not.toHaveBeenCalled(); expect(runJev).not.toHaveBeenCalled();
  });
});
