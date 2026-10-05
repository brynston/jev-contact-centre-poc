import { TypeSafeClient } from '@typesafe-ai/sdk';
import { jevQuestions } from '../../shared/questions.js';
import type { ContactCentreInteraction, ProviderResult } from '../../shared/types.js';

const ROUTE_KEYS = ['billing','technical','retention','fraud_security','account_access','complaints','refunds','product_info','general_service'] as const;
const URGENCY_KEYS = ['low','medium','high','critical'] as const;
const RISK_KEYS = ['low','medium','high'] as const;
const VALUE_KEYS = ['low','medium','high','vip'] as const;

function toRecord<const T extends readonly string[]>(keys: T, values: Record<string, number>): Record<T[number], number> {
  return Object.fromEntries(keys.map(k => [k, Number(values[k] ?? 0)])) as Record<T[number], number>;
}

export async function runJev(interaction: ContactCentreInteraction): Promise<ProviderResult> {
  if (!process.env.TYPESAFE_API_KEY) throw new Error('TYPESAFE_API_KEY is not set. Add it to .env before running Jev.');

  const client = new TypeSafeClient({
    apiKey: process.env.TYPESAFE_API_KEY,
    defaultModel: process.env.TYPESAFE_MODEL || 'jev-latest',
    logLevel: 'off'
  });

  const state = {
    interaction: {
      channel: interaction.channel,
      subject: interaction.subject,
      message: interaction.message
    },
    customer: interaction.metadata
  };

  const started = performance.now();
  const response = await client.systemOne({ state, questions: jevQuestions });
  const latencyMs = performance.now() - started;
  const a = response.answers;

  const estimatedCostUsd = response.usage.input_tokens * Number(process.env.TYPESAFE_INPUT_COST_PER_MILLION || 0.042) / 1_000_000;

  return {
    provider: 'jev',
    model: response.model,
    latencyMs,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    estimatedCostUsd,
    output: {
      route: a.route.choice,
      routeProbabilities: toRecord(ROUTE_KEYS, a.route.probabilities),
      urgency: a.urgency.choice,
      urgencyProbabilities: toRecord(URGENCY_KEYS, a.urgency.probabilities),
      churnRisk: a.churnRisk.choice,
      churnProbabilities: toRecord(RISK_KEYS, a.churnRisk.probabilities),
      fraudRisk: a.fraudRisk.choice,
      fraudProbabilities: toRecord(RISK_KEYS, a.fraudRisk.probabilities),
      humanEscalation: a.humanEscalation.noul >= 0.5,
      humanEscalationProbability: a.humanEscalation.noul,
      customerValue: a.customerValue.choice,
      customerValueProbabilities: toRecord(VALUE_KEYS, a.customerValue.probabilities)
    },
    raw: response
  };
}
