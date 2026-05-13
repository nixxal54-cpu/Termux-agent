export class RecoverySystem {
  constructor(memory) {
    this.memory = memory;
  }

  handleCrash(error, context) {
    return {
      recovered: true,
      message: `Recovered from ${context} crash: ${error.message}. Please refine your approach.`,
      suggestion: "Try executing a simpler command or using the patch tool instead of writing a whole file."
    };
  }
}
