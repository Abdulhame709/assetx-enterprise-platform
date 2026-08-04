/**
 * WorkflowPort — contract for the generic Workflow Execution Engine (Task L3).
 * Interface only: no EventBus, no Database, no tenant logic, no security checks.
 * Consumers provide business logic via WorkflowStepHandler / WorkflowGuard.
 * Reference: Task L3 — Epic L.
 */
import {
  WorkflowContext,
  WorkflowDefinition,
  WorkflowResult,
  WorkflowStepHandler,
  WorkflowStepId,
} from '../entities/workflow.entity';

export interface WorkflowPort {
  /** Validate a definition; throws on invalid (missing initial, bad references). */
  validate(def: WorkflowDefinition): void;

  /** Build a fresh runtime context (in-memory). */
  createContext(def: WorkflowDefinition, variables?: Record<string, unknown>): WorkflowContext;

  /** Allowed next step ids for a given step (empty when unrestricted). */
  getNextSteps(def: WorkflowDefinition, stepId: WorkflowStepId): WorkflowStepId[];

  /** Execute the workflow from its initial step using the consumer handler. */
  execute(
    def: WorkflowDefinition,
    handler: WorkflowStepHandler,
    options?: { variables?: Record<string, unknown> },
  ): Promise<WorkflowResult>;
}
