import { z } from 'zod';
import { ROUTES, URGENCY, RISK, CUSTOMER_VALUE } from './types.js';

function probabilityMap<const T extends readonly string[]>(keys: T) {
  const shape = Object.fromEntries(keys.map(k => [k, z.number().min(0).max(1)])) as {
    [K in T[number]]: z.ZodNumber;
  };
  return z.object(shape);
}

const routeProb = probabilityMap(ROUTES);
const urgencyProb = probabilityMap(URGENCY);
const riskProb = probabilityMap(RISK);
const valueProb = probabilityMap(CUSTOMER_VALUE);

export const decisionOutputSchema = z.object({
  route: z.enum(ROUTES),
  routeProbabilities: routeProb,
  urgency: z.enum(URGENCY),
  urgencyProbabilities: urgencyProb,
  churnRisk: z.enum(RISK),
  churnProbabilities: riskProb,
  fraudRisk: z.enum(RISK),
  fraudProbabilities: riskProb,
  humanEscalation: z.boolean(),
  humanEscalationProbability: z.number().min(0).max(1),
  customerValue: z.enum(CUSTOMER_VALUE),
  customerValueProbabilities: valueProb
});

export function approximatelySumsToOne(map: Record<string,number>, tolerance=0.03) {
  return Math.abs(Object.values(map).reduce((a,b)=>a+b,0)-1) <= tolerance;
}
