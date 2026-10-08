import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getEvaluationOptions } from '../scripts/evaluation-options.js';
import { completion, decisionsCompletion, interaction } from './fixtures/llm.js';

beforeEach(() => {
  for (const key of Object.keys(process.env).filter(k => /^(LLM_|OPENAI_|OPENROUTER_|PROVIDERS$|CONCURRENCY$)/.test(k))) vi.stubEnv(key, undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe('evaluation selection', () => {
  it('uses environment defaults and CLI overrides', () => {
    vi.stubEnv('LLM_PROVIDER_MODE', 'openrouter'); vi.stubEnv('OPENROUTER_MODEL', 'vendor/default');
    expect(getEvaluationOptions([])).toMatchObject({ selected: ['jev', 'llm'], concurrency: 5, llm: { mode: 'openrouter', model: 'vendor/default' } });
    expect(getEvaluationOptions(['--llm-mode', 'direct', '--llm-model', 'direct-model'])).toMatchObject({ llm: { mode: 'direct', model: 'direct-model' } });
  });
  it.each([
    ['--llm-mode', 'bad'], ['--llm-model'], ['--llm-mode', '--llm-model', 'model'], ['--unknown'], ['--llm-model', ' ']
  ])('rejects invalid CLI arguments: %j', (...args) => expect(() => getEvaluationOptions(args)).toThrow());
  it('rejects invalid provider names and concurrency before evaluation', () => {
    vi.stubEnv('PROVIDERS', 'openrouter'); expect(() => getEvaluationOptions([])).toThrow('PROVIDERS');
    vi.stubEnv('PROVIDERS', 'llm'); vi.stubEnv('CONCURRENCY', 'NaN'); expect(() => getEvaluationOptions([])).toThrow('CONCURRENCY');
  });
  it('runs both modes against mocked fixtures and writes separate reports', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'jev-eval-'));
    try {
      await fs.mkdir(path.join(cwd, 'data'));
      await fs.writeFile(path.join(cwd, 'data/interactions.json'), JSON.stringify([interaction, { ...interaction, id: 'test-2' }]));
      const recordPath = path.join(cwd, 'requests.jsonl');
      const preload = path.join(cwd, 'mock-fetch.mjs');
      await fs.writeFile(preload, String.raw`
        import fs from 'node:fs/promises';
        globalThis.fetch = async (url, init) => {
          await fs.appendFile(${JSON.stringify(recordPath)}, JSON.stringify({ url, key: init.headers.Authorization, body: JSON.parse(init.body) }) + '\n');
          return new Response(JSON.parse(init.body).questions ? ${JSON.stringify(JSON.stringify(decisionsCompletion))} : ${JSON.stringify(JSON.stringify(completion))}, { status: 200 });
        };
      `);
      const endpoint = 'https://fixture.test/api/v1';
      const env = { ...process.env, PROVIDERS: 'llm', CONCURRENCY: '2', LLM_API_KEY: 'direct-fixture', OPENROUTER_API_KEY: 'router-fixture', LLM_BASE_URL: endpoint, OPENROUTER_BASE_URL: endpoint };
      const cases = [
        { mode: 'direct', model: 'fixture/direct', api: 'chat-completions' },
        { mode: 'openrouter', model: 'fixture/openrouter', api: 'chat-completions' },
        { mode: 'openrouter', model: 'cloudflare/clef', api: 'decisions' },
        { mode: 'openrouter', model: 'cloudflare/clef-flash', api: 'decisions' }
      ] as const;
      for (const { mode, model, api } of cases) {
        const { stdout } = await promisify(execFile)(process.execPath, ['--import', createRequire(import.meta.url).resolve('tsx'), '--import', preload, path.resolve('scripts/evaluate.ts'), '--llm-mode', mode, '--llm-model', model], { cwd, env });
        expect(stdout).toContain(`Evaluating llm-${mode} (${model})`);
        const report = JSON.parse(await fs.readFile(path.join(cwd, `results/llm-${mode}-summary.json`), 'utf8'));
        expect(report).toMatchObject({ provider: 'llm', llmMode: mode, model, llmApi: api, attempted: 2, successful: 2, failures: 0 });
        const rows = (await fs.readFile(path.join(cwd, `results/llm-${mode}-results.jsonl`), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
        expect(rows).toHaveLength(2);
        expect(rows[0].result).toMatchObject({ llmMode: mode, model, llmApi: api });
      }
      const requests = (await fs.readFile(recordPath, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
      expect(requests).toHaveLength(8);
      expect(requests.map(r => r.key)).toEqual(['Bearer direct-fixture', 'Bearer direct-fixture', ...Array(6).fill('Bearer router-fixture')]);
      expect(requests.slice(0, 4).every(r => r.url === endpoint + '/chat/completions')).toBe(true);
      expect(requests.slice(4).every(r => r.url === 'https://fixture.test/api/alpha/decisions' && r.body.questions)).toBe(true);
      expect(requests.every(r => !('temperature' in r.body) && !JSON.stringify(r.body).includes('groundTruth'))).toBe(true);
      expect(await fs.readdir(path.join(cwd, 'results'))).toHaveLength(4);
      const noKeyEnv = { ...env, OPENROUTER_API_KEY: '' };
      const { stdout } = await promisify(execFile)(process.execPath, ['--import', createRequire(import.meta.url).resolve('tsx'), '--import', preload, path.resolve('scripts/evaluate.ts'), '--llm-mode', 'openrouter'], { cwd, env: noKeyEnv });
      expect(stdout).toContain('Skipping openrouter LLM comparator: OPENROUTER_API_KEY is not set');
      expect((await fs.readFile(recordPath, 'utf8')).trim().split('\n')).toHaveLength(8);
    } finally {
      await fs.rm(cwd, { recursive: true, force: true });
    }
  }, 15000);
});
