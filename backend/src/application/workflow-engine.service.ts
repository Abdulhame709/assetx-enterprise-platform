/**
 * WorkflowEngineService — lightweight generic Workflow Execution Engine (Task L3).
 * Responsibilities ONLY:
 *   Definition Validation → Step Resolution → Step Execution → Context Passing → Result.
 * It holds NO business rules, NO asset/maintenance/approval/notification logic, and
 * performs NO persistence (context/history are runtime memory only). Branching is
 * decided by the consumer-provided StepHandler. Guards are an extension point only.
 * Reference: Task L3 — Epic L.
 */
import { Injectable } from '@nestjs/common';
import { WorkflowPort } from '../core/ports/workflow.port';
import {
  WorkflowContext,
  WorkflowDefinition,
  WorkflowResult,
  WorkflowStep,
  WorkflowStepHandler,
  WorkflowStepId,
  WORKFLOW_ERRORS,
} from '../core/entities/workflow.entity';

const DEFAULT_MAX_STEPS = 100;

@Injectable()
export class WorkflowEngineService implements WorkflowPort {
  validate(def: WorkflowDefinition): void {
    if (!def || !Array.isArray(def.steps) || def.steps.length === 0) {
      throw new Error(WORKFLOW_ERRORS.MISSING_INITIAL_STEP);
    }
    if (!def.initialStep) throw new Error(WORKFLOW_ERRORS.MISSING_INITIAL_STEP);

    const ids = new Set<WorkflowStepId>(def.steps.map((s) => s.id));
    if (!ids.has(def.initialStep)) throw new Error(WORKFLOW_ERRORS.MISSING_INITIAL_STEP);

    for (const step of def.steps) {
      for (const next of step.next ?? []) {
        if (!ids.has(next)) throw new Error(WORKFLOW_ERRORS.INVALID_STEP_REFERENCE);
      }
    }
  }

  createContext(def: WorkflowDefinition, variables: Record<string, unknown> = {}): WorkflowContext {
    return {
      definitionId: def.id,
      currentStepId: null,
      variables: { ...variables },
      executedSteps: [],
    };
  }

  getNextSteps(def: WorkflowDefinition, stepId: WorkflowStepId): WorkflowStepId[] {
    const step = this.findStep(def, stepId);
    return step ? step.next ?? [] : [];
  }

  async execute(
    def: WorkflowDefinition,
    handler: WorkflowStepHandler,
    options: { variables?: Record<string, unknown> } = {},
  ): Promise<WorkflowResult> {
    this.validate(def);
    const context = this.createContext(def, options.variables);
    const maxSteps = def.maxSteps ?? DEFAULT_MAX_STEPS;
    const visited = new Set<WorkflowStepId>();

    let stepId: WorkflowStepId | null = def.initialStep;
    let executed = 0;

    while (stepId) {
      const step = this.findStep(def, stepId);
      if (!step) return this.fail(def.id, context, WORKFLOW_ERRORS.UNKNOWN_STEP);

      // Cycle protection: revisit of a step.
      if (visited.has(stepId)) return this.fail(def.id, context, WORKFLOW_ERRORS.CYCLE_DETECTED);
      visited.add(stepId);

      // maxSteps protection.
      if (executed >= maxSteps) return this.fail(def.id, context, WORKFLOW_ERRORS.CYCLE_DETECTED);

      // Set the current step on the context BEFORE the handler/guard so the
      // consumer-provided logic knows which step it is executing.
      context.currentStepId = stepId;

      // Guard (extension point only): if the step's guard blocks, the workflow
      // completes here without executing the step.
      if (step.guard && !(await step.guard.canRun(context))) {
        return this.ok(def.id, stepId, context);
      }

      // Execute the consumer-provided step logic.
      let decision;
      try {
        decision = await handler(context);
      } catch (err) {
        context.error = (err as Error).message;
        return this.fail(def.id, context, WORKFLOW_ERRORS.HANDLER_FAILED, (err as Error).message);
      }

      context.executedSteps.push(stepId);
      executed++;

      const next = decision?.nextStep;
      if (!next) {
        return this.ok(def.id, stepId, context); // workflow complete
      }

      // Transition validity: the chosen next must be allowed by the step and exist.
      if (step.next && step.next.length > 0 && !step.next.includes(next)) {
        return this.fail(def.id, context, WORKFLOW_ERRORS.INVALID_TRANSITION);
      }
      if (!this.findStep(def, next)) {
        return this.fail(def.id, context, WORKFLOW_ERRORS.INVALID_STEP_REFERENCE);
      }

      stepId = next;
    }

    return this.ok(def.id, null, context);
  }

  private findStep(def: WorkflowDefinition, stepId: WorkflowStepId): WorkflowStep | undefined {
    return def.steps.find((s) => s.id === stepId);
  }

  private ok(definitionId: string, finalStep: WorkflowStepId | null, context: WorkflowContext): WorkflowResult {
    return {
      success: true,
      definitionId,
      finalStep,
      completedSteps: [...context.executedSteps],
      context,
    };
  }

  private fail(
    definitionId: string,
    context: WorkflowContext,
    error: string,
    detail?: string,
  ): WorkflowResult {
    context.error = error;
    return {
      success: false,
      definitionId,
      finalStep: context.currentStepId,
      completedSteps: [...context.executedSteps],
      context,
      error: detail ? `${error}: ${detail}` : error,
    };
  }
}
