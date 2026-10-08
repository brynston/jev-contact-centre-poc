import type { ContactCentreInteraction, DecisionOutput } from '../../src/shared/types.js';

export const interaction: ContactCentreInteraction = {
  id: 'test-1', channel: 'chat', subject: 'Invoice question', message: 'Why was I charged twice?',
  metadata: { customerTenureMonths: 12, plan: 'plus', monthlySpendAud: 50, priorContacts30d: 1, accountAgeDays: 365, region: 'AU' },
  groundTruth: { route: 'billing', urgency: 'medium', churnRisk: 'low', fraudRisk: 'low', humanEscalation: false, customerValue: 'medium' }
};
export const output: DecisionOutput = {
  route: 'billing', routeProbabilities: { billing: .8, technical: .025, retention: .025, fraud_security: .025, account_access: .025, complaints: .025, refunds: .025, product_info: .025, general_service: .025 },
  urgency: 'medium', urgencyProbabilities: { low: .1, medium: .7, high: .15, critical: .05 },
  churnRisk: 'low', churnProbabilities: { low: .8, medium: .15, high: .05 },
  fraudRisk: 'low', fraudProbabilities: { low: .9, medium: .08, high: .02 },
  humanEscalation: false, humanEscalationProbability: .2,
  customerValue: 'medium', customerValueProbabilities: { low: .1, medium: .7, high: .15, vip: .05 }
};
export const completion = {
  choices: [{ message: { content: JSON.stringify(output) } }],
  usage: { prompt_tokens: 100, completion_tokens: 50 }
};

export const decisionsCompletion = {
  model: 'cloudflare/clef-flash',
  answers: {
    route: { type: 'choice', choice: output.route, probabilities: output.routeProbabilities },
    urgency: { type: 'choice', choice: output.urgency, probabilities: output.urgencyProbabilities },
    churnRisk: { type: 'choice', choice: output.churnRisk, probabilities: output.churnProbabilities },
    fraudRisk: { type: 'choice', choice: output.fraudRisk, probabilities: output.fraudProbabilities },
    humanEscalation: { type: 'noul', noul: output.humanEscalationProbability },
    customerValue: { type: 'choice', choice: output.customerValue, probabilities: output.customerValueProbabilities }
  },
  usage: { input_tokens: 100, output_tokens: 0, cost: .0000042 }
};
