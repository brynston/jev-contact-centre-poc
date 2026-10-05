import type { ContactCentreInteraction, ProviderResult } from '../../shared/types.js';
import { decisionOutputSchema } from '../../shared/schema.js';

const schemaPrompt = `Return ONLY valid JSON with exactly this shape:
{
  "route": "billing|technical|retention|fraud_security|account_access|complaints|refunds|product_info|general_service",
  "routeProbabilities": {"billing":0,"technical":0,"retention":0,"fraud_security":0,"account_access":0,"complaints":0,"refunds":0,"product_info":0,"general_service":0},
  "urgency": "low|medium|high|critical",
  "urgencyProbabilities": {"low":0,"medium":0,"high":0,"critical":0},
  "churnRisk": "low|medium|high",
  "churnProbabilities": {"low":0,"medium":0,"high":0},
  "fraudRisk": "low|medium|high",
  "fraudProbabilities": {"low":0,"medium":0,"high":0},
  "humanEscalation": true,
  "humanEscalationProbability": 0.0,
  "customerValue": "low|medium|high|vip",
  "customerValueProbabilities": {"low":0,"medium":0,"high":0,"vip":0}
}
All probability maps must sum to approximately 1. Use only the supplied interaction and metadata.`;

export async function runLlm(interaction: ContactCentreInteraction): Promise<ProviderResult> {
  const key = process.env.LLM_API_KEY;
  if (!key) throw new Error('LLM_API_KEY is not set. Comparator is optional; add it to .env to use it.');
  const base = (process.env.LLM_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = process.env.LLM_MODEL || 'gpt-5-mini';

  const started = performance.now();
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        { role: 'system', content: 'You are a contact-centre decision classifier. ' + schemaPrompt },
        { role: 'user', content: JSON.stringify(interaction) }
      ]
    })
  });
  const latencyMs = performance.now() - started;
  if (!res.ok) throw new Error(`LLM provider returned ${res.status}: ${await res.text()}`);
  const body: any = await res.json();
  const text = body.choices?.[0]?.message?.content ?? '';
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```$/,'').trim();
  const output = decisionOutputSchema.parse(JSON.parse(cleaned));
  const inputTokens = body.usage?.prompt_tokens;
  const outputTokens = body.usage?.completion_tokens;
  const inRate = Number(process.env.LLM_INPUT_COST_PER_MILLION || 0);
  const outRate = Number(process.env.LLM_OUTPUT_COST_PER_MILLION || 0);
  const estimatedCostUsd = ((inputTokens || 0) * inRate + (outputTokens || 0) * outRate) / 1_000_000;

  return { provider: 'llm', model, output, latencyMs, inputTokens, outputTokens, estimatedCostUsd, raw: body };
}
