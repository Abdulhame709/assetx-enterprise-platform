/**
 * EventBus — lightweight in-process domain event bus built on Node's EventEmitter.
 * Responsibilities: receive domain events, dispatch to subscribers.
 * Contains NO database, notification, or business logic.
 * Reference: ADR (Phase 11) · AAB §11C (event-driven, in-process MVP)
 */
import { EventEmitter } from 'events';
import { DomainEvent } from './event-types';

type Handler = (event: DomainEvent) => void;

export class EventBus {
  private readonly emitter = new EventEmitter();
  private readonly allHandlers = new Set<Handler>();

  /** Publish a domain event to all subscribers. */
  publish(event: DomainEvent): void {
    for (const h of this.allHandlers) {
      try { h(event); } catch { /* subscriber errors must not break the bus */ }
    }
    this.emitter.emit(event.event, event);
  }

  /** Subscribe to a specific event type. */
  subscribe(event: string, handler: Handler): void {
    this.emitter.on(event, handler);
  }

  /** Subscribe to all domain events. */
  subscribeAll(handler: Handler): void {
    this.allHandlers.add(handler);
  }
}
