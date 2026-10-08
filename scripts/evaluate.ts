import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { ContactCentreInteraction, ProviderResult } from '../src/shared/types.js';
import { runJev } from '../src/server/providers/jev.js';
import { runLlm } from '../src/server/providers/llm.js';
import { summarise } from '../src/server/metrics.js';
import { getEvaluationOptions } from './evaluation-options.js';

const { selected, concurrency, llm } = getEvaluationOptions();
const interactions = JSON.parse(await fs.readFile(path.resolve('data/interactions.json'),'utf8')) as ContactCentreInteraction[];

async function mapLimit<T,R>(items:T[], limit:number, fn:(item:T,index:number)=>Promise<R>):Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  async function worker(){
    while(true){ const i=next++; if(i>=items.length) return; out[i]=await fn(items[i],i); }
  }
  await Promise.all(Array.from({length:Math.min(limit,items.length)},()=>worker()));
  return out;
}

for (const provider of selected) {
  if (provider==='jev' && !process.env.TYPESAFE_API_KEY) { console.log('Skipping Jev: TYPESAFE_API_KEY is not set.'); continue; }
  if (provider==='llm' && !llm.key) { console.log(`Skipping ${llm.mode} LLM comparator: ${llm.keySetting} is not set.`); continue; }

  const resultName = provider === 'llm' ? `llm-${llm.mode}` : 'jev';
  console.log(`Evaluating ${resultName}${provider === 'llm' ? ` (${llm.model})` : ''} on ${interactions.length} interactions (concurrency ${concurrency})...`);
  let failures = 0;
  const rows = await mapLimit(interactions,concurrency,async (interaction,i) => {
    try {
      const result = provider==='jev' ? await runJev(interaction) : await runLlm(interaction, { mode: llm.mode, model: llm.model });
      process.stdout.write(`\r${provider}: ${i+1}/${interactions.length}`);
      return { interaction, result, error:null as string|null };
    } catch (e:any) {
      failures++;
      return { interaction, result:null as ProviderResult|null, error:e?.message || String(e) };
    }
  });
  process.stdout.write('\n');
  const successful = rows.filter(r=>r.result).map(r=>r.result!) as ProviderResult[];
  const successfulInteractions = rows.filter(r=>r.result).map(r=>r.interaction);
  const summary = successful.length ? summarise(successfulInteractions,successful) : null;
  const report = { provider, ...(provider === 'llm' ? { llmMode: llm.mode, llmApi: llm.api, model: llm.model } : {}), attempted:interactions.length, successful:successful.length, failures, invalidOutputRate:failures/interactions.length, summary };
  await fs.mkdir('results',{recursive:true});
  await fs.writeFile(`results/${resultName}-results.jsonl`, rows.map(r=>JSON.stringify(r)).join('\n')+'\n');
  await fs.writeFile(`results/${resultName}-summary.json`, JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}
