import { describe, expect, it } from 'vitest';
import { extractJson } from '../src/lib/ai/extract-json';
import { fitWithin } from '../src/lib/images/preprocess';

describe('extractJson', () => {
  it('parses a bare object', () => {
    expect(extractJson('{"passed": true}')).toEqual({ passed: true });
  });

  it('strips code fences and chatter', () => {
    const text = 'Sure! Here you go:\n```json\n{"passed": false, "observations": ["moss"]}\n```\nHope that helps.';
    expect(extractJson(text)).toEqual({ passed: false, observations: ['moss'] });
  });

  it('handles nested objects and braces inside strings', () => {
    const text = '{"reason": "a {curly} weed", "creature": {"name": "Mossbit"}}';
    expect(extractJson(text)).toEqual({ reason: 'a {curly} weed', creature: { name: 'Mossbit' } });
  });

  it('skips a broken object and finds a later valid one', () => {
    expect(extractJson('{oops} then {"ok": 1}')).toEqual({ ok: 1 });
  });

  it('returns null for truncated output', () => {
    expect(extractJson('{"passed": true, "reason": "cut off')).toBeNull();
    expect(extractJson('no json here')).toBeNull();
  });
});

describe('fitWithin', () => {
  it('scales the long side down to the max', () => {
    expect(fitWithin(4032, 3024, 1280)).toEqual({ width: 1280, height: 960 });
    expect(fitWithin(3024, 4032, 1280)).toEqual({ width: 960, height: 1280 });
  });

  it('never upscales', () => {
    expect(fitWithin(800, 600, 1280)).toEqual({ width: 800, height: 600 });
  });
});
