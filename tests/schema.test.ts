import { describe, expect, it } from 'vitest';
import { decisionOutputSchema, approximatelySumsToOne } from '../src/shared/schema.js';

const valid = {
  route:'billing', routeProbabilities:{billing:.8,technical:.025,retention:.025,fraud_security:.025,account_access:.025,complaints:.025,refunds:.025,product_info:.025,general_service:.025},
  urgency:'medium', urgencyProbabilities:{low:.1,medium:.7,high:.15,critical:.05},
  churnRisk:'low', churnProbabilities:{low:.8,medium:.15,high:.05},
  fraudRisk:'low', fraudProbabilities:{low:.9,medium:.08,high:.02},
  humanEscalation:false, humanEscalationProbability:.2,
  customerValue:'medium', customerValueProbabilities:{low:.1,medium:.7,high:.15,vip:.05}
};

describe('decision schema',()=>{
  it('accepts a valid decision',()=> expect(decisionOutputSchema.parse(valid).route).toBe('billing'));
  it('rejects invalid enums',()=> expect(()=>decisionOutputSchema.parse({...valid,route:'made_up'})).toThrow());
  it('checks probability sums',()=> expect(approximatelySumsToOne(valid.urgencyProbabilities)).toBe(true));
});
