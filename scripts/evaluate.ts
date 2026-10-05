import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { ContactCentreInteraction, ProviderResult } from '../src/shared/types.js';
import { runJev } from '../src/server/providers/jev.js';
import { runLlm } from '../src/server/providers/llm.js';
import { summarise } from '../src/server/metrics.js';

const interactions = JSON.parse(await fs.readFile(path.resolve('data/interactions.json'),'utf8')) as ContactCentreInteraction[];
const selected = (process.env.PROVIDERS || 'jev,llm').split(',').map(x=>x.trim()).filter(Boolean) as Array<'jev'|'llm'>;
const concurrency = Math.max(1, Number(process.env.CONCURRENCY || 5));

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
  if (provider==='llm' && !process.env.LLM_API_KEY) { console.log('Skipping LLM comparator: LLM_API_KEY is not set.'); continue; }

  console.log(`Evaluating ${provider} on ${interactions.length} interactions (concurrency ${concurrency})...`);
  let failures = 0;
  const rows = await mapLimit(interactions,concurrency,async (interaction,i) => {
    try {
      const result = provider==='jev' ? await runJev(interaction) : await runLlm(interaction);
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
  const report = { provider, attempted:interactions.length, successful:successful.length, failures, invalidOutputRate:failures/interactions.length, summary };
  await fs.mkdir('results',{recursive:true});
  await fs.writeFile(`results/${provider}-results.jsonl`, rows.map(r=>JSON.stringify(r)).join('\n')+'\n');
  await fs.writeFile(`results/${provider}-summary.json`, JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}
