/**
 * Tests — generic Workflow Execution Engine (Task L3).
 * Engine only: definition validation, step resolution, execution, context
 * passing, result. No business logic, no persistence, no DSL. Branching via the
 * consumer-provided StepHandler; guards as extension points; cycle + maxSteps
 * protection. Reference: Task L3 — Epic L.
 */
import { createHarness, Harness } from './support/db.harness';
import {
  WorkflowDefinition,
  WorkflowStepHandler,
  WORKFLOW_ERRORS,
} from '../src/core/entities/workflow.entity';

describe('Workflow Engine — generic execution (Task L3)', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness();
  });

  const simpleDef = (overrides: Partial<WorkflowDefinition> = {}): WorkflowDefinition => ({
    id: 'wf-simple',
    name: 'Simple',
    initialStep: 'start',
    steps: [
      { id: 'start', name: 'Start', next: ['middle'] },
      { id: 'middle', name: 'Middle', next: ['end'] },
      { id: 'end', name: 'End' },
    ],
    ...overrides,
  });

  const linearHandler: WorkflowStepHandler = async (ctx) => {
    ctx.variables.steps = [...(ctx.variables.steps as string[] ?? []), ctx.currentStepId as string];
    if (ctx.currentStepId === 'middle') return { nextStep: 'end' };
    if (ctx.currentStepId === 'start') return { nextStep: 'middle' };
    return {}; // end → complete
  };

  // ---- Validation ----
  describe('validate', () => {
    it('accepts a valid definition', () => {
      expect(() => h.workflow.validate(simpleDef())).not.toThrow();
    });

    it('rejects a missing initial step', () => {
      expect(() => h.workflow.validate(simpleDef({ initialStep: '' as never }))).toThrow(WORKFLOW_ERRORS.MISSING_INITIAL_STEP);
      expect(() => h.workflow.validate(simpleDef({ initialStep: 'missing' }))).toThrow(WORKFLOW_ERRORS.MISSING_INITIAL_STEP);
    });

    it('rejects an invalid step reference in next', () => {
      const bad = simpleDef();
      bad.steps[0] = { id: 'start', name: 'Start', next: ['nope'] };
      expect(() => h.workflow.validate(bad)).toThrow(WORKFLOW_ERRORS.INVALID_STEP_REFERENCE);
    });
  });

  // ---- Execution ----
  describe('execute', () => {
    it('executes a valid linear workflow and records step history', async () => {
      const res = await h.workflow.execute(simpleDef(), linearHandler, { variables: {} });
      expect(res.success).toBe(true);
      expect(res.finalStep).toBe('end');
      expect(res.completedSteps).toEqual(['start', 'middle', 'end']);
      expect(res.context.variables.steps).toEqual(['start', 'middle', 'end']);
      expect(res.context.executedSteps).toEqual(['start', 'middle', 'end']);
    });

    it('branching via handler result', async () => {
      const def: WorkflowDefinition = {
        id: 'wf-branch', name: 'Branch', initialStep: 'gate',
        steps: [
          { id: 'gate', name: 'Gate', next: ['approve', 'reject'] },
          { id: 'approve', name: 'Approve' },
          { id: 'reject', name: 'Reject' },
        ],
      };
      const handler: WorkflowStepHandler = async (ctx) => {
        if (ctx.currentStepId === 'gate') return { nextStep: ctx.variables.decision === 'yes' ? 'approve' : 'reject' };
        return {};
      };
      const yes = await h.workflow.execute(def, handler, { variables: { decision: 'yes' } });
      expect(yes.completedSteps).toEqual(['gate', 'approve']);
      const no = await h.workflow.execute(def, handler, { variables: { decision: 'no' } });
      expect(no.completedSteps).toEqual(['gate', 'reject']);
    });

    it('rejects an invalid next transition (not in step.next)', async () => {
      const def = simpleDef();
      const handler: WorkflowStepHandler = async (ctx) => {
        if (ctx.currentStepId === 'start') return { nextStep: 'end' }; // skip middle
        return {};
      };
      const res = await h.workflow.execute(def, handler);
      expect(res.success).toBe(false);
      expect(res.error).toContain(WORKFLOW_ERRORS.INVALID_TRANSITION);
    });

    it('handles handler failure', async () => {
      const handler: WorkflowStepHandler = async () => { throw new Error('boom'); };
      const res = await h.workflow.execute(simpleDef(), handler);
      expect(res.success).toBe(false);
      expect(res.error).toContain(WORKFLOW_ERRORS.HANDLER_FAILED);
      expect(res.error).toContain('boom');
    });

    it('detects a cycle', async () => {
      const def = simpleDef();
      def.steps[1] = { id: 'middle', name: 'Middle', next: ['start'] }; // real cycle
      const handler: WorkflowStepHandler = async (ctx) => {
        if (ctx.currentStepId === 'start') return { nextStep: 'middle' };
        if (ctx.currentStepId === 'middle') return { nextStep: 'start' };
        return {};
      };
      const res = await h.workflow.execute(def, handler);
      expect(res.success).toBe(false);
      expect(res.error).toContain(WORKFLOW_ERRORS.CYCLE_DETECTED);
    });

    it('maxSteps protection stops runaway workflows', async () => {
      const def: WorkflowDefinition = {
        id: 'wf-loop', name: 'Loop', initialStep: 'a', maxSteps: 5,
        steps: [{ id: 'a', name: 'A', next: ['a'] }],
      };
      const res = await h.workflow.execute(def, async (ctx) => ({ nextStep: 'a' }));
      expect(res.success).toBe(false);
      expect(res.error).toContain(WORKFLOW_ERRORS.CYCLE_DETECTED);
      expect(res.completedSteps.length).toBeLessThanOrEqual(5);
    });

    it('guard (extension point) can block a step', async () => {
      const def: WorkflowDefinition = {
        id: 'wf-guard', name: 'Guard', initialStep: 'start',
        steps: [
          { id: 'start', name: 'Start', next: ['blocked'], guard: { canRun: async () => false } },
          { id: 'blocked', name: 'Blocked' },
        ],
      };
      const res = await h.workflow.execute(def, async () => ({ nextStep: 'blocked' }));
      expect(res.success).toBe(true);
      expect(res.completedSteps).toEqual([]); // step not executed
    });
  });

  describe('helpers', () => {
    it('getNextSteps returns allowed next ids', () => {
      expect(h.workflow.getNextSteps(simpleDef(), 'start')).toEqual(['middle']);
      expect(h.workflow.getNextSteps(simpleDef(), 'end')).toEqual([]);
    });
    it('createContext seeds variables and empty history', () => {
      const ctx = h.workflow.createContext(simpleDef(), { a: 1 });
      expect(ctx.variables).toEqual({ a: 1 });
      expect(ctx.executedSteps).toEqual([]);
      expect(ctx.currentStepId).toBeNull();
    });
  });
});
