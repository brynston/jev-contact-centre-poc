import type { ContactCentreInteraction, LlmOptions, ProviderResult } from '../../shared/types.js';
import { decisionOutputSchema } from '../../shared/schema.js';
import { getLlmConfig } from './llm-config.js';
import { buildDecisionsRequest, parseDecisionsResponse } from './decisions.js';

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

export async function runLlm(interaction: ContactCentreInteraction, options: LlmOptions = {}): Promise<ProviderResult> {
  const config = getLlmConfig(options);
  const { key, model } = config;
  if (!key) throw new Error(`${config.keySetting} is not set. Add it to .env to use the ${config.mode} comparator.`);

  const decisions = config.api === 'decisions';
  const started = performance.now();
  const res = await fetch(decisions ? config.decisionsUrl : `${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(decisions ? buildDecisionsRequest(interaction, model) : {
      model,
      messages: [
        { role: 'system', content: 'You are a contact-centre decision classifier. ' + schemaPrompt },
        { role: 'user', content: JSON.stringify({ channel: interaction.channel, subject: interaction.subject, message: interaction.message, metadata: interaction.metadata }) }
      ]
    })
  });
  const latencyMs = performance.now() - started;
  // Do not relay upstream response bodies, which may contain credentials or request details.
  if (!res.ok) throw new Error(`${config.mode} LLM provider returned HTTP ${res.status}. Check server-side credentials, credits and model access.`);
  const body: any = await res.json();
  if (body.error) throw new Error(`${config.mode} LLM provider returned an API error. Check model access and provider settings.`);
  const parsed = decisions ? parseDecisionsResponse(body) : parseChatResponse(body);
  const { output, inputTokens, outputTokens, reportedCost } = parsed;
  const estimated = ((inputTokens || 0) * config.inputRate + (outputTokens || 0) * config.outputRate) / 1_000_000;
  const estimatedCostUsd = config.mode === 'openrouter' && typeof reportedCost === 'number' && Number.isFinite(reportedCost) && reportedCost >= 0 ? reportedCost : estimated;

  return { provider: 'llm', llmMode: config.mode, llmApi: config.api, model, output, latencyMs, inputTokens, outputTokens, estimatedCostUsd };
}

function parseChatResponse(body: any) {
  const text = body.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) throw new Error('LLM provider returned no text content.');
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```$/,'').trim();
  const output = decisionOutputSchema.parse(JSON.parse(cleaned));
  const inputTokens = body.usage?.prompt_tokens;
  const outputTokens = body.usage?.completion_tokens;
  return { output, inputTokens, outputTokens, reportedCost: body.usage?.cost };
}
