import { describe, expect, it } from 'vitest';
import { accuracy, binaryF1, brierBinary, percentile } from '../src/server/metrics.js';

describe('metrics',()=>{
  it('calculates accuracy',()=> expect(accuracy([[1,1],[1,0],[0,0]])).toBeCloseTo(2/3));
  it('calculates binary F1',()=> expect(binaryF1([true,true,false],[true,false,true])).toBeCloseTo(0.5));
  it('calculates Brier score',()=> expect(brierBinary([true,false],[0.8,0.1])).toBeCloseTo(0.025));
  it('calculates percentiles',()=> expect(percentile([10,20,30,40],0.95)).toBe(40));
});
