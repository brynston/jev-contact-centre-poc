export const ROUTES = ['billing','technical','retention','fraud_security','account_access','complaints','refunds','product_info','general_service'] as const;
export const URGENCY = ['low','medium','high','critical'] as const;
export const RISK = ['low','medium','high'] as const;
export const CUSTOMER_VALUE = ['low','medium','high','vip'] as const;

export type Route = typeof ROUTES[number];
export type Urgency = typeof URGENCY[number];
export type Risk = typeof RISK[number];
export type CustomerValue = typeof CUSTOMER_VALUE[number];

export interface ContactCentreInteraction {
  id: string;
  channel: 'chat' | 'email' | 'call_transcript';
  subject: string;
  message: string;
  metadata: {
    customerTenureMonths: number;
    plan: 'basic' | 'plus' | 'premium' | 'business';
    monthlySpendAud: number;
    priorContacts30d: number;
    accountAgeDays: number;
    region: 'AU' | 'NZ' | 'SG';
  };
  groundTruth: {
    route: Route;
    urgency: Urgency;
    churnRisk: Risk;
    fraudRisk: Risk;
    humanEscalation: boolean;
    customerValue: CustomerValue;
  };
}

export interface DecisionOutput {
  route: Route;
  routeProbabilities: Record<Route, number>;
  urgency: Urgency;
  urgencyProbabilities: Record<Urgency, number>;
  churnRisk: Risk;
  churnProbabilities: Record<Risk, number>;
  fraudRisk: Risk;
  fraudProbabilities: Record<Risk, number>;
  humanEscalation: boolean;
  humanEscalationProbability: number;
  customerValue: CustomerValue;
  customerValueProbabilities: Record<CustomerValue, number>;
}

export type LlmMode = 'direct' | 'openrouter';
export interface LlmOptions {
  mode?: LlmMode;
  model?: string;
}
export interface PublicLlmConfig {
  defaultMode: LlmMode;
  direct: { configured: boolean; model: string; models: string[] };
  openrouter: { configured: boolean; model: string; models: string[] };
}
export interface ApiHealth {
  ok: boolean;
  jevConfigured: boolean;
  llmConfigured: boolean;
  llm: PublicLlmConfig;
}

export interface ProviderResult {
  provider: 'jev' | 'llm';
  llmMode?: LlmMode;
  llmApi?: 'chat-completions' | 'decisions';
  model: string;
  output: DecisionOutput;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
  raw?: unknown;
}

export interface EvaluationRow {
  interaction: ContactCentreInteraction;
  results: ProviderResult[];
}
