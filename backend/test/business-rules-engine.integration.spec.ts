/**
 * Tests — generic Business Rules Engine (Task L4).
 * Engine only: validate → sort by priority → evaluate conditions → execute
 * consumer-provided actions → unified result. No expression language, no
 * persistence, no business services. Failure of a condition/action does not
 * crash the engine (records { ruleId, success:false, error } and continues).
 * Reference: Task L4 — Epic L.
 */
import { createHarness, Harness } from './support/db.harness';
import {
  BusinessRule,
  RuleContext,
  RULE_ERRORS,
} from '../src/core/entities/rule.entity';

describe('Business Rules Engine — generic evaluation (Task L4)', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness();
  });

  const mkRule = (partial: Partial<BusinessRule> & { id: string; condition: BusinessRule['condition'] }): BusinessRule => ({
    name: partial.id,
    priority: 0,
    actions: [],
    ...partial,
  });

  const ctx = (variables: Record<string, unknown> = {}): RuleContext => ({ variables, matchedRuleIds: [] });

  // ---- Validation ----
  describe('validate', () => {
    it('accepts a valid rule set', () => {
      const rules = [mkRule({ id: 'a', condition: { matches: () => true } })];
      expect(() => h.rules.validate(rules)).not.toThrow();
    });

    it('rejects duplicate rule ids', () => {
      const rules = [
        mkRule({ id: 'a', condition: { matches: () => true } }),
        mkRule({ id: 'a', condition: { matches: () => true } }),
      ];
      expect(() => h.rules.validate(rules)).toThrow(RULE_ERRORS.DUPLICATE_RULE_ID);
    });

    it('rejects a missing condition', () => {
      const rules = [mkRule({ id: 'a', condition: undefined as never })];
      expect(() => h.rules.validate(rules)).toThrow(RULE_ERRORS.MISSING_CONDITION);
    });
  });

  // ---- Evaluation ----
  describe('evaluate', () => {
    it('matching condition executes actions', async () => {
      const log: string[] = [];
      const rule = mkRule({
        id: 'm', priority: 10,
        condition: { matches: (c) => (c.variables as { go: boolean }).go },
        actions: [{ execute: (c) => { (c.variables as { hit: number }).hit++; log.push('ran'); } }],
      });
      const res = await h.rules.evaluate([rule], ctx({ go: true, hit: 0 }));
      expect(res.applied).toBe(1);
      expect(res.results[0]).toMatchObject({ ruleId: 'm', success: true, matched: true, applied: true, actionsRun: 1 });
      expect(log).toEqual(['ran']);
      expect((res.results[0].success)).toBe(true);
    });

    it('non-matching condition skips actions', async () => {
      let ran = false;
      const rule = mkRule({
        id: 'nm', priority: 5,
        condition: { matches: () => false },
        actions: [{ execute: () => { ran = true; } }],
      });
      const res = await h.rules.evaluate([rule], ctx({}));
      expect(res.results[0]).toMatchObject({ ruleId: 'nm', matched: false, applied: false, success: true });
      expect(ran).toBe(false);
    });

    it('disabled rule is ignored', async () => {
      let ran = false;
      const rule = mkRule({
        id: 'd', priority: 1, enabled: false,
        condition: { matches: () => true },
        actions: [{ execute: () => { ran = true; } }],
      });
      const res = await h.rules.evaluate([rule], ctx({}));
      expect(res.evaluated).toBe(0);
      expect(ran).toBe(false);
    });

    it('priority DESC ordering (higher priority evaluated first)', async () => {
      const order: string[] = [];
      const mk = (id: string, priority: number) => mkRule({
        id, priority,
        condition: { matches: () => { order.push(id); return true; } },
      });
      await h.rules.evaluate([mk('low', 10), mk('high', 100), mk('mid', 50)], ctx({}));
      expect(order).toEqual(['high', 'mid', 'low']);
    });

    it('ties break by definition order', async () => {
      const order: string[] = [];
      const mk = (id: string) => mkRule({
        id, priority: 10,
        condition: { matches: () => { order.push(id); return true; } },
      });
      await h.rules.evaluate([mk('first'), mk('second'), mk('third')], ctx({}));
      expect(order).toEqual(['first', 'second', 'third']);
    });

    it('executes multiple actions on the same rule', async () => {
      let n = 0;
      const rule = mkRule({
        id: 'multi', priority: 5,
        condition: { matches: () => true },
        actions: [
          { execute: () => { n++; } },
          { execute: () => { n++; } },
          { execute: () => { n++; } },
        ],
      });
      const res = await h.rules.evaluate([rule], ctx({}));
      expect(res.results[0].actionsRun).toBe(3);
      expect(n).toBe(3);
    });

    it('action failure is recorded and engine continues with other rules', async () => {
      const fail = mkRule({
        id: 'fail', priority: 100,
        condition: { matches: () => true },
        actions: [{ execute: () => { throw new Error('boom'); } }],
      });
      const ok = mkRule({
        id: 'ok', priority: 1,
        condition: { matches: () => true },
        actions: [{ execute: (c) => { (c.variables as { ran: number }).ran++; } }],
      });
      const res = await h.rules.evaluate([fail, ok], ctx({ ran: 0 }));
      const failed = res.results.find((r) => r.ruleId === 'fail');
      expect(failed).toMatchObject({ success: false, applied: false });
      expect(failed?.error).toContain(RULE_ERRORS.ACTION_FAILED);
      expect(res.results.find((r) => r.ruleId === 'ok')?.success).toBe(true);
      expect(res.failed).toBe(1);
    });

    it('condition failure is recorded and engine continues', async () => {
      const bad = mkRule({
        id: 'badc', priority: 100,
        condition: { matches: () => { throw new Error('cond boom'); } },
      });
      const ok = mkRule({
        id: 'okc', priority: 1,
        condition: { matches: () => true },
        actions: [{ execute: (c) => { (c.variables as { ran: number }).ran++; } }],
      });
      const res = await h.rules.evaluate([bad, ok], ctx({ ran: 0 }));
      expect(res.results.find((r) => r.ruleId === 'badc')?.error).toContain(RULE_ERRORS.CONDITION_FAILED);
      expect(res.results.find((r) => r.ruleId === 'okc')?.success).toBe(true);
      expect(res.failed).toBe(1);
    });

    it('aggregated result correctness', async () => {
      const rules = [
        mkRule({ id: 'r1', priority: 100, condition: { matches: () => true }, actions: [] }),
        mkRule({ id: 'r2', priority: 90, condition: { matches: () => true }, actions: [] }),
        mkRule({ id: 'r3', priority: 80, condition: { matches: () => false } }),
        mkRule({ id: 'r4', priority: 70, enabled: false, condition: { matches: () => true } }),
      ];
      const res = await h.rules.evaluate(rules, ctx({}));
      expect(res.total).toBe(4);
      expect(res.evaluated).toBe(3);
      expect(res.matched).toBe(2);
      expect(res.applied).toBe(2);
      expect(res.failed).toBe(0);
    });
  });

  // ---- Integration: real consumer conditions/actions ----
  describe('integration — real consumer conditions/actions', () => {
    it('evaluates a real consumer rule set and validates RuleEngineResult', async () => {
      const decisions: string[] = [];
      const rules: BusinessRule[] = [
        mkRule({
          id: 'high_value', priority: 100,
          condition: { matches: (c) => (c.variables as { value: number }).value > 10000 },
          actions: [{ execute: (c) => { decisions.push('flag_high_value'); (c.variables as { flags: string[] }).flags.push('HIGH_VALUE'); } }],
        }),
        mkRule({
          id: 'no_custodian', priority: 90,
          condition: { matches: (c) => (c.variables as { custodian: string | null }).custodian === null },
          actions: [{ execute: (c) => { decisions.push('flag_no_custodian'); (c.variables as { flags: string[] }).flags.push('NO_CUSTODIAN'); } }],
        }),
      ];

      const c = ctx({ value: 50000, custodian: null, flags: [] });
      const res = await h.rules.evaluate(rules, c);

      expect(res.results.length).toBe(2);
      expect(res.results.every((r) => r.success)).toBe(true);
      expect(decisions).toEqual(['flag_high_value', 'flag_no_custodian']);
      expect((c.variables as { flags: string[] }).flags).toEqual(['HIGH_VALUE', 'NO_CUSTODIAN']);
      expect(c.matchedRuleIds).toEqual(['high_value', 'no_custodian']);
    });
  });
});
