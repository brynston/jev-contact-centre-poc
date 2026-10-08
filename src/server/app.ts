import express, { type RequestHandler } from 'express';
import cors from 'cors';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ContactCentreInteraction } from '../shared/types.js';
import { runJev } from './providers/jev.js';
import { runLlm } from './providers/llm.js';
import { getPublicLlmConfig, LlmSelectionError, parseLlmOptions } from './providers/llm-config.js';

export const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const healthHandler: RequestHandler = (_req,res)=> {
  try {
    const llm = getPublicLlmConfig();
    res.json({ ok:true, jevConfigured: !!process.env.TYPESAFE_API_KEY, llmConfigured: llm[llm.defaultMode].configured, llm });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Invalid server configuration.' });
  }
};
app.get('/api/health', healthHandler);
app.get('/api/interactions', async (_req,res)=> {
  const text = await fs.readFile(path.join(root,'data/interactions.json'),'utf8');
  res.type('json').send(text);
});
export const runProviderHandler: RequestHandler = async (req,res)=> {
  try {
    if (req.params.provider !== 'jev' && req.params.provider !== 'llm') {
      res.status(404).json({ error: 'Unknown provider. Use jev or llm.' });
      return;
    }
    const interaction = req.body as ContactCentreInteraction;
    const result = req.params.provider === 'jev'
      ? await runJev(interaction)
      : await runLlm(interaction, parseLlmOptions(req.query.mode, req.query.model));
    res.json(result);
  } catch (err:any) {
    res.status(err instanceof LlmSelectionError ? 400 : 500).json({ error: err?.message || String(err) });
  }
};
app.post('/api/run/:provider', runProviderHandler);
