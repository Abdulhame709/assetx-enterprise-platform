/**
 * Workflow domain entities — lightweight generic Workflow Execution Engine (Task L3).
 * Engine only: definition validation, step resolution, step execution, context
 * passing, execution result. NO business/asset/maintenance/approval/notification
 * logic, NO persistence, NO DSL/expression language, NO EventBus/DB coupling.
 * Deliberately decoupled from Lifecycle/Asset/Movement.
 * Reference: Task L3 — Epic L.
 */

export type WorkflowStepId = string;

/** A single step in a workflow. Next transitions are resolved at runtime via
 *  the consumer-provided StepHandler. A guard is an extension point only. */
export interface WorkflowStep {
  id: WorkflowStepId;
  name: string;
  /** allowed next step ids; empty/undefined = unrestricted (validated at runtime) */
  next?: WorkflowStepId[];
  /** optional static guard (extension point — no condition engine in L3) */
  guard?: WorkflowGuard;
  metadata?: Record<string, unknown>;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  version?: number;
  initialStep: WorkflowStepId;
  steps: WorkflowStep[];
  /** safety limit against infinite loops (default applied when omitted) */
  maxSteps?: number;
}

/** Runtime execution state — in-memory only (no persistence in L3). */
export interface WorkflowContext<V extends Record<string, unknown> = Record<string, unknown>> {
  definitionId: string;
  currentStepId: WorkflowStepId | null;
  variables: V;
  /** ordered history of executed step ids (runtime memory) */
  executedSteps: WorkflowStepId[];
  error?: string;
}

/** Decision a StepHandler returns to route the workflow. */
export interface WorkflowStepDecision {
  /** next step to run; omit to complete the workflow */
  nextStep?: WorkflowStepId;
}

/** Consumer-provided business logic. Branching is resolved HERE, not in the engine. */
export type WorkflowStepHandler<V extends Record<string, unknown> = Record<string, unknown>> = (
  context: WorkflowContext<V>,
) => Promise<WorkflowStepDecision> | WorkflowStepDecision;

/** Guard — extension point ONLY (evaluated by the engine; logic belongs to consumer). */
export interface WorkflowGuard<V extends Record<string, unknown> = Record<string, unknown>> {
  /** return true to allow the step to run */
  canRun(context: WorkflowContext<V>): boolean | Promise<boolean>;
}

export interface WorkflowResult {
  success: boolean;
  definitionId: string;
  finalStep: WorkflowStepId | null;
  /** ordered step history for the run (runtime memory) */
  completedSteps: WorkflowStepId[];
  context: WorkflowContext;
  error?: string;
}

export const WORKFLOW_ERRORS = {
  MISSING_INITIAL_STEP: 'WORKFLOW_MISSING_INITIAL_STEP',
  INVALID_STEP_REFERENCE: 'WORKFLOW_INVALID_STEP_REFERENCE',
  INVALID_TRANSITION: 'WORKFLOW_INVALID_TRANSITION',
  CYCLE_DETECTED: 'WORKFLOW_CYCLE_DETECTED',
  HANDLER_FAILED: 'WORKFLOW_HANDLER_FAILED',
  UNKNOWN_STEP: 'WORKFLOW_UNKNOWN_STEP',
} as const;
