import { z } from 'zod';
import { ROUTES, URGENCY, RISK, CUSTOMER_VALUE } from './types.js';

const routeProb = z.object(Object.fromEntries(ROUTES.map(k => [k,z.number().min(0).max(1)])) as any);
const urgencyProb = z.object(Object.fromEntries(URGENCY.map(k => [k,z.number().min(0).max(1)])) as any);
const riskProb = z.object(Object.fromEntries(RISK.map(k => [k,z.number().min(0).max(1)])) as any);
const valueProb = z.object(Object.fromEntries(CUSTOMER_VALUE.map(k => [k,z.number().min(0).max(1)])) as any);

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
