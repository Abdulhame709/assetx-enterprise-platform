/**
 * BusinessRulesEngineService — generic, stateless Rule Evaluation engine (Task L4).
 * Flow:
 *   Rules → Validate → Sort by Priority (DESC, then definition order)
 *     → Evaluate Conditions → Execute Provided Actions → Return unified Result.
 * It does NOT persist rules/results, does NOT modify domain entities, and does
 * NOT call business services. No loops: actions never re-trigger the engine.
 * Failure policy: if a condition or action fails, that rule is recorded with
 * { success:false, error } and evaluation CONTINUES with the remaining rules.
 * Reference: Task L4 — Epic L.
 */
import { Injectable } from '@nestjs/common';
import { RuleEnginePort } from '../core/ports/rule-engine.port';
import {
  BusinessRule,
  RuleContext,
  RuleEngineResult,
  RuleResult,
  RULE_ERRORS,
} from '../core/entities/rule.entity';

@Injectable()
export class BusinessRulesEngineService<T = Record<string, unknown>> implements RuleEnginePort<T> {
  validate(rules: BusinessRule<T>[]): void {
    const seen = new Set<string>();
    for (const rule of rules) {
      if (!rule || !rule.id) throw new Error(RULE_ERRORS.MISSING_CONDITION);
      if (seen.has(rule.id)) throw new Error(RULE_ERRORS.DUPLICATE_RULE_ID);
      seen.add(rule.id);
      if (!rule.condition) throw new Error(RULE_ERRORS.MISSING_CONDITION);
    }
  }

  async evaluate(rules: BusinessRule<T>[], context: RuleContext<T>): Promise<RuleEngineResult> {
    this.validate(rules);

    // Priority DESC, then stable definition order (V8 sort is stable).
    const sorted = [...rules].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    const results: RuleResult[] = [];
    for (const rule of sorted) {
      const base = { ruleId: rule.id, ruleName: rule.name, priority: rule.priority ?? 0 };
      const disabled = rule.enabled === false;

      if (disabled) {
        results.push({ ...base, success: true, evaluated: false, matched: false, applied: false, actionsRun: 0 });
        continue;
      }

      // 1 · evaluate condition
      let matched = false;
      try {
        matched = await rule.condition.matches(context);
      } catch (err) {
        results.push({ ...base, success: false, evaluated: true, matched: false, applied: false, actionsRun: 0, error: `${RULE_ERRORS.CONDITION_FAILED}: ${(err as Error).message}` });
        continue; // policy: continue evaluating remaining rules
      }

      if (!matched) {
        results.push({ ...base, success: true, evaluated: true, matched: false, applied: false, actionsRun: 0 });
        continue;
      }

      context.matchedRuleIds.push(rule.id);

      // 2 · execute provided actions
      let actionsRun = 0;
      try {
        for (const action of rule.actions) {
          await action.execute(context);
          actionsRun++;
        }
      } catch (err) {
        results.push({ ...base, success: false, evaluated: true, matched: true, applied: false, actionsRun, error: `${RULE_ERRORS.ACTION_FAILED}: ${(err as Error).message}` });
        continue;
      }

      results.push({ ...base, success: true, evaluated: true, matched: true, applied: true, actionsRun: rule.actions.length });
    }

    return {
      total: rules.length,
      evaluated: results.filter((r) => r.evaluated).length,
      matched: results.filter((r) => r.matched).length,
      applied: results.filter((r) => r.applied).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  }
}
