import { EventEmitter } from 'events';

class EventBus extends EventEmitter {
  emit(event, ...args) {
    if (process.env.DEBUG === 'true') {
       // Debug logging hook
    }
    return super.emit(event, ...args);
  }
}

export const bus = new EventBus();

export const EVENTS = {
  SESSION_START: 'session:start',
  SESSION_END: 'session:end',
  TASK_START: 'task:start',
  TASK_FINISH: 'task:finish',
  TASK_FAIL: 'task:fail',
  STATE_CHANGE: 'state:change',
  TOOL_EXECUTE: 'tool:execute',
  TOOL_RESULT: 'tool:result',
  TOOL_ERROR: 'tool:error',
  EXECUTION_TIMEOUT: 'execution:timeout',
  REFLECTION_START: 'reflection:start',
  REFLECTION_RESULT: 'reflection:result',
  RETRY_TRIGGERED: 'retry:triggered',
  ROLLBACK_START: 'rollback:start',
  ROLLBACK_COMPLETE: 'rollback:complete',
  CHECKPOINT_CREATE: 'checkpoint:create',
  CONTEXT_COMPRESSED: 'context:compressed',
  MEMORY_UPDATE: 'memory:update',
  TELEMETRY_FLUSH: 'telemetry:flush',
  RECOVERY_START: 'recovery:start',
  RECOVERY_COMPLETE: 'recovery:complete',
  RECOVERY_ACTIVATED: 'recovery:activated',
  THINKING_START: 'thinking:start',
  THINKING_END: 'thinking:end',
  TOKEN_USAGE: 'telemetry:tokens',
  SYSTEM_ERROR: 'system:error'
};
