/**
 * Business Rules entities — generic, stateless Rule Evaluation engine (Task L4).
 * Engine ONLY: rules → validate → sort by priority → evaluate conditions →
 * execute provided actions → return unified result. It does NOT persist rules
 * or results, does NOT modify domain entities, and does NOT call business
 * services. Conditions/Actions are simple consumer-provided interfaces (no
 * expression language / dynamic scripting). Decoupled from Lifecycle/Workflow/
 * Asset/Movement.
 * Reference: Task L4 — Epic L.
 */

export type RuleId = string;
export type RulePriority = number;

/** Consumer-provided condition — extension point only (no expression parser). */
export interface RuleCondition<T = Record<string, unknown>> {
  matches(ctx: RuleContext<T>): boolean | Promise<boolean>;
}

/** Consumer-provided action — extension point only. */
export interface RuleAction<T = Record<string, unknown>> {
  execute(ctx: RuleContext<T>): void | Promise<void>;
}

export interface BusinessRule<T = Record<string, unknown>> {
  id: RuleId;
  name: string;
  description?: string;
  /** higher = evaluated first; ties broken by definition order */
  priority: RulePriority;
  condition: RuleCondition<T>;
  actions: RuleAction<T>[];
  enabled?: boolean; // default true
}

/** Runtime evaluation context — in-memory only (no persistence in L4). */
export interface RuleContext<T = Record<string, unknown>> {
  variables: T;
  /** ids of rules that matched during evaluation */
  matchedRuleIds: RuleId[];
  error?: string;
}

/** Per-rule outcome (includes required failure shape { ruleId, success, error }). */
export interface RuleResult {
  ruleId: RuleId;
  ruleName: string;
  priority: RulePriority;
  success: boolean;
  /** whether the condition was actually evaluated (false for disabled rules) */
  evaluated: boolean;
  /** whether the condition matched */
  matched: boolean;
  /** whether actions were executed to completion */
  applied: boolean;
  /** number of actions that ran successfully before any failure */
  actionsRun: number;
  error?: string;
}

/** Engine-level aggregate. */
export interface RuleEngineResult {
  total: number;
  evaluated: number;
  matched: number;
  applied: number;
  failed: number;
  results: RuleResult[];
}

export const RULE_ERRORS = {
  DUPLICATE_RULE_ID: 'RULE_DUPLICATE_ID',
  MISSING_CONDITION: 'RULE_MISSING_CONDITION',
  CONDITION_FAILED: 'RULE_CONDITION_FAILED',
  ACTION_FAILED: 'RULE_ACTION_FAILED',
} as const;
