export const STATES = {
  IDLE: 'IDLE',
  ANALYZING: 'ANALYZING',
  RETRIEVING_CONTEXT: 'RETRIEVING_CONTEXT',
  PLANNING: 'PLANNING',
  CHECKPOINTING: 'CHECKPOINTING',
  EXECUTING: 'EXECUTING',
  OBSERVING: 'OBSERVING',
  REFLECTING: 'REFLECTING',
  VERIFYING: 'VERIFYING',
  RETRYING: 'RETRYING',
  ROLLING_BACK: 'ROLLING_BACK',
  RECOVERING: 'RECOVERING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED'
};

export class StateMachine {
  constructor() {
    this.currentState = STATES.IDLE;
    this.history = [];
    this.validTransitions = {
      [STATES.IDLE]: [STATES.ANALYZING],
      [STATES.ANALYZING]: [STATES.RETRIEVING_CONTEXT, STATES.PLANNING, STATES.FAILED],
      [STATES.RETRIEVING_CONTEXT]: [STATES.PLANNING, STATES.FAILED],
      [STATES.PLANNING]: [STATES.CHECKPOINTING, STATES.COMPLETED, STATES.FAILED, STATES.RECOVERING],
      [STATES.CHECKPOINTING]: [STATES.EXECUTING, STATES.FAILED],
      [STATES.EXECUTING]: [STATES.OBSERVING, STATES.FAILED, STATES.RECOVERING],
      [STATES.OBSERVING]: [STATES.VERIFYING, STATES.REFLECTING, STATES.COMPLETED],
      [STATES.REFLECTING]: [STATES.RETRYING, STATES.ROLLING_BACK, STATES.FAILED],
      [STATES.VERIFYING]: [STATES.COMPLETED, STATES.ROLLING_BACK, STATES.REFLECTING, STATES.PLANNING],
      [STATES.RETRYING]: [STATES.PLANNING, STATES.EXECUTING, STATES.FAILED],
      [STATES.ROLLING_BACK]: [STATES.PLANNING, STATES.RECOVERING, STATES.FAILED],
      [STATES.RECOVERING]: [STATES.IDLE, STATES.PLANNING, STATES.FAILED],
      [STATES.COMPLETED]: [STATES.IDLE],
      [STATES.FAILED]: [STATES.IDLE, STATES.RECOVERING]
    };
  }

  transition(newState) {
    if (!STATES[newState]) throw new Error(`Unknown state: ${newState}`);
    const allowed = this.validTransitions[this.currentState];
    if (!allowed || !allowed.includes(newState)) {
      // Emit a warning but still allow the transition — hard-throwing here would crash the agent loop
      const msg = `[StateMachine] Non-standard transition: ${this.currentState} → ${newState}`;
      process.stderr.write(msg + '\n');
    }
    this.history.push({ from: this.currentState, to: newState, timestamp: Date.now() });
    this.currentState = newState;
    return this.currentState;
  }

  reset() {
    this.currentState = STATES.IDLE;
    this.history = [];
  }

  getState() { return this.currentState; }
}