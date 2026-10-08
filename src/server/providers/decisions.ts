import { z } from 'zod';
import { decisionOutputSchema, approximatelySumsToOne } from '../../shared/schema.js';
import { jevQuestions } from '../../shared/questions.js';
import type { ContactCentreInteraction } from '../../shared/types.js';

const s = decisionOutputSchema.shape;
function choiceAnswer<T extends z.ZodTypeAny, P extends z.ZodTypeAny>(choice: T, probabilities: P) {
  return z.object({
    type: z.literal('choice'), choice,
    probabilities: probabilities.refine(map => approximatelySumsToOne(map), 'Probabilities must sum to approximately 1.')
  });
}
const responseSchema = z.object({
  answers: z.object({
    route: choiceAnswer(s.route, s.routeProbabilities),
    urgency: choiceAnswer(s.urgency, s.urgencyProbabilities),
    churnRisk: choiceAnswer(s.churnRisk, s.churnProbabilities),
    fraudRisk: choiceAnswer(s.fraudRisk, s.fraudProbabilities),
    humanEscalation: z.object({ type: z.literal('noul'), noul: s.humanEscalationProbability }),
    customerValue: choiceAnswer(s.customerValue, s.customerValueProbabilities)
  }),
  usage: z.object({
    input_tokens: z.number().int().nonnegative().optional(),
    output_tokens: z.number().int().nonnegative().optional(),
    cost: z.number().nonnegative().optional()
  }).optional()
});

export function buildDecisionsRequest(interaction: ContactCentreInteraction, model: string) {
  return {
    model,
    state: {
      interaction: { channel: interaction.channel, subject: interaction.subject, message: interaction.message },
      customer: interaction.metadata
    },
    questions: jevQuestions
  };
}

export function parseDecisionsResponse(body: unknown) {
  const { answers: a, usage } = responseSchema.parse(body);
  const output = decisionOutputSchema.parse({
    route: a.route.choice, routeProbabilities: a.route.probabilities,
    urgency: a.urgency.choice, urgencyProbabilities: a.urgency.probabilities,
    churnRisk: a.churnRisk.choice, churnProbabilities: a.churnRisk.probabilities,
    fraudRisk: a.fraudRisk.choice, fraudProbabilities: a.fraudRisk.probabilities,
    humanEscalation: a.humanEscalation.noul >= 0.5,
    humanEscalationProbability: a.humanEscalation.noul,
    customerValue: a.customerValue.choice, customerValueProbabilities: a.customerValue.probabilities
  });
  return { output, inputTokens: usage?.input_tokens, outputTokens: usage?.output_tokens ?? 0, reportedCost: usage?.cost };
}
