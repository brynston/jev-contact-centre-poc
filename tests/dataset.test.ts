import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ROUTES, URGENCY, RISK, CUSTOMER_VALUE } from '../src/shared/types.js';

const recordSchema = z.object({
  id: z.string().regex(/^CC-\d{3,4}$/),
  channel: z.enum(['chat', 'email', 'call_transcript']),
  subject: z.string().min(1), message: z.string().min(1),
  metadata: z.object({
    customerTenureMonths: z.number().int().nonnegative(),
    plan: z.enum(['basic', 'plus', 'premium', 'business']),
    monthlySpendAud: z.number().nonnegative(),
    priorContacts30d: z.number().int().nonnegative(),
    accountAgeDays: z.number().int().nonnegative(),
    region: z.enum(['AU', 'NZ', 'SG']),
  }).strict(),
  groundTruth: z.object({
    route: z.enum(ROUTES), urgency: z.enum(URGENCY),
    churnRisk: z.enum(RISK), fraudRisk: z.enum(RISK),
    humanEscalation: z.boolean(), customerValue: z.enum(CUSTOMER_VALUE),
  }).strict(),
}).strict();

const records = JSON.parse(fs.readFileSync('data/interactions.json', 'utf8'));

describe('synthetic dataset', () => {
  it('contains 1,000 complete, valid records with unique sequential IDs and distinct messages', () => {
    const parsed = z.array(recordSchema).length(1000).parse(records);
    expect(new Set(parsed.map(x => x.message)).size).toBe(1000);
    expect(parsed.map(x => x.id)).toEqual(Array.from({ length: 1000 }, (_, i) => `CC-${String(i + 1).padStart(3, '0')}`));
  });

  it('keeps JSON and JSONL exports identical', () => {
    const lines = fs.readFileSync('data/interactions.jsonl', 'utf8').trim().split('\n').map(line => JSON.parse(line));
    expect(lines).toEqual(records);
  });

  it('covers every team and channel, with substantial longer cases beyond the original baseline', () => {
    const parsed = z.array(recordSchema).parse(records);
    expect(new Set(parsed.map(x => x.groundTruth.route))).toEqual(new Set(ROUTES));
    expect(new Set(parsed.map(x => x.channel))).toEqual(new Set(['chat', 'email', 'call_transcript']));
    const added = parsed.slice(100);
    for (const route of ROUTES) expect(added.filter(x => x.groundTruth.route === route)).toHaveLength(100);
    expect(added.every(x => x.message.split(/\s+/).length >= 150)).toBe(true);
    expect(added.some(x => x.message.split(/\s+/).length >= 300)).toBe(true);
    expect(new Set(added.map(x => x.metadata.plan))).toEqual(new Set(['basic', 'plus', 'premium', 'business']));
    expect(new Set(added.map(x => x.groundTruth.customerValue))).toEqual(new Set(CUSTOMER_VALUE));
  });
});
