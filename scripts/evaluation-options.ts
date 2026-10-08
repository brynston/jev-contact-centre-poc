import { getLlmConfig, parseLlmOptions } from '../src/server/providers/llm-config.js';

export function getEvaluationOptions(args = process.argv.slice(2)) {
  let mode: unknown = undefined;
  let model: unknown = undefined;
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag !== '--llm-mode' && flag !== '--llm-model') throw new Error(`Unknown evaluation option: ${flag}`);
    const value = args[++i];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
    if (flag === '--llm-mode') mode = value;
    else model = value;
  }
  const selected = (process.env.PROVIDERS || 'jev,llm').split(',').map(x => x.trim()).filter(Boolean);
  if (!selected.length || selected.some(x => x !== 'jev' && x !== 'llm')) {
    throw new Error('PROVIDERS must contain jev and/or llm.');
  }
  const concurrency = Number(process.env.CONCURRENCY || 5);
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error('CONCURRENCY must be a positive integer.');
  const llm = getLlmConfig(parseLlmOptions(mode, model));
  return { selected: [...new Set(selected)] as Array<'jev' | 'llm'>, concurrency, llm };
}
