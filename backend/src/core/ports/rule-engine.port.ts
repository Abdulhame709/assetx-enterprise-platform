/**
 * RuleEnginePort — contract for the generic Business Rules Engine (Task L4).
 * Interface ONLY: validate() + evaluate(). No EventBus, no Database, no
 * security, no tenant logic. Consumers supply Conditions/Actions.
 * Reference: Task L4 — Epic L.
 */
import { BusinessRule, RuleContext, RuleEngineResult } from '../entities/rule.entity';

export interface RuleEnginePort<T = Record<string, unknown>> {
  /** Validate a rule set; throws on invalid (duplicate ids, missing condition). */
  validate(rules: BusinessRule<T>[]): void;

  /** Evaluate rules against a context; returns a unified result. */
  evaluate(rules: BusinessRule<T>[], context: RuleContext<T>): Promise<RuleEngineResult>;
}
