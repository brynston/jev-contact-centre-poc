import type { ContactCentreInteraction, ProviderResult } from '../shared/types.js';

export function accuracy<T>(pairs: Array<[T,T]>): number {
  if (!pairs.length) return 0;
  return pairs.filter(([a,b]) => a === b).length / pairs.length;
}

export function binaryF1(truth: boolean[], pred: boolean[]): number {
  let tp=0, fp=0, fn=0;
  truth.forEach((t,i) => { if (t && pred[i]) tp++; else if (!t && pred[i]) fp++; else if (t && !pred[i]) fn++; });
  const precision = tp / Math.max(tp + fp, 1);
  const recall = tp / Math.max(tp + fn, 1);
  return (2 * precision * recall) / Math.max(precision + recall, 1e-12);
}

export function brierBinary(truth: boolean[], prob: number[]): number {
  if (!truth.length) return 0;
  return truth.reduce((s,t,i) => s + Math.pow(prob[i] - (t ? 1 : 0), 2), 0) / truth.length;
}

export function brierMulticlass<T extends string>(truth: T[], probs: Array<Record<T,number>>, labels: readonly T[]): number {
  if (!truth.length) return 0;
  let sum = 0;
  truth.forEach((actual,i) => labels.forEach(label => {
    const y = actual === label ? 1 : 0;
    sum += Math.pow((probs[i]?.[label] ?? 0) - y, 2);
  }));
  return sum / truth.length;
}

export function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const v = [...values].sort((a,b)=>a-b);
  const idx = Math.min(v.length-1, Math.max(0, Math.ceil(p * v.length)-1));
  return v[idx];
}

export function summarise(interactions: ContactCentreInteraction[], results: ProviderResult[]) {
  const routePairs = interactions.map((x,i)=>[x.groundTruth.route, results[i].output.route] as const);
  const urgencyPairs = interactions.map((x,i)=>[x.groundTruth.urgency, results[i].output.urgency] as const);
  const churnPairs = interactions.map((x,i)=>[x.groundTruth.churnRisk, results[i].output.churnRisk] as const);
  const fraudPairs = interactions.map((x,i)=>[x.groundTruth.fraudRisk, results[i].output.fraudRisk] as const);
  const valuePairs = interactions.map((x,i)=>[x.groundTruth.customerValue, results[i].output.customerValue] as const);
  const truthEsc = interactions.map(x=>x.groundTruth.humanEscalation);
  const predEsc = results.map(x=>x.output.humanEscalation);

  return {
    count: interactions.length,
    accuracy: {
      route: accuracy(routePairs as any),
      urgency: accuracy(urgencyPairs as any),
      churnRisk: accuracy(churnPairs as any),
      fraudRisk: accuracy(fraudPairs as any),
      customerValue: accuracy(valuePairs as any),
      humanEscalation: accuracy(truthEsc.map((t,i)=>[t,predEsc[i]]))
    },
    humanEscalationF1: binaryF1(truthEsc,predEsc),
    brier: {
      route: brierMulticlass(interactions.map(x=>x.groundTruth.route), results.map(x=>x.output.routeProbabilities), ['billing','technical','retention','fraud_security','account_access','complaints','refunds','product_info','general_service']),
      urgency: brierMulticlass(interactions.map(x=>x.groundTruth.urgency), results.map(x=>x.output.urgencyProbabilities), ['low','medium','high','critical']),
      churnRisk: brierMulticlass(interactions.map(x=>x.groundTruth.churnRisk), results.map(x=>x.output.churnProbabilities), ['low','medium','high']),
      fraudRisk: brierMulticlass(interactions.map(x=>x.groundTruth.fraudRisk), results.map(x=>x.output.fraudProbabilities), ['low','medium','high']),
      humanEscalation: brierBinary(truthEsc, results.map(x=>x.output.humanEscalationProbability))
    },
    latencyMs: {
      p50: percentile(results.map(r=>r.latencyMs),0.50),
      p95: percentile(results.map(r=>r.latencyMs),0.95)
    },
    tokens: {
      input: results.reduce((s,r)=>s+(r.inputTokens||0),0),
      output: results.reduce((s,r)=>s+(r.outputTokens||0),0)
    },
    estimatedCostUsd: results.reduce((s,r)=>s+(r.estimatedCostUsd||0),0)
  };
}
