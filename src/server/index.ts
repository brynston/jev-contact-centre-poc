import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ContactCentreInteraction } from '../shared/types.js';
import { runJev } from './providers/jev.js';
import { runLlm } from './providers/llm.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

app.get('/api/health', (_req,res)=>res.json({ ok:true, jevConfigured: !!process.env.TYPESAFE_API_KEY, llmConfigured: !!process.env.LLM_API_KEY }));
app.get('/api/interactions', async (_req,res)=> {
  const text = await fs.readFile(path.join(root,'data/interactions.json'),'utf8');
  res.type('json').send(text);
});
app.post('/api/run/:provider', async (req,res)=> {
  try {
    const interaction = req.body as ContactCentreInteraction;
    const result = req.params.provider === 'jev' ? await runJev(interaction) : await runLlm(interaction);
    res.json(result);
  } catch (err:any) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

const port = Number(process.env.PORT || 8787);
app.listen(port, ()=>console.log(`Jev POC API listening on http://localhost:${port}`));
