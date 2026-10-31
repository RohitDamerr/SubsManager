// Tiny in-process event bus.  Modules emit after a commit; listeners run async.
// Listeners must never throw synchronously — wrap with try/catch internally.

import { EventEmitter } from 'events';

export class EventBus {
  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(50);
  }

  on(event, listener) {
    this.emitter.on(event, async (...args) => {
      try {
        await listener(...args);
      } catch (err) {
        console.error(`[EventBus] listener error on "${event}":`, err);
      }
    });
  }

  emit(event, ...args) {
    this.emitter.emit(event, ...args);
  }
}
