// Errors containing these strings should never be retried
const NON_RETRYABLE = ['Unauthorized', 'Invalid API Key', 'Bad Request (400)', 'Context too large (413)', 'rate limit hit (429)'];

export async function withRetries(operation, retries = 3, delayMs = 1000) {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await operation();
    } catch (error) {
      const msg = error.message || '';
      // Don't retry errors that will never succeed
      if (NON_RETRYABLE.some(pattern => msg.includes(pattern))) {
        throw error;
      }
      attempt++;
      if (attempt >= retries) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, attempt - 1)));
    }
  }
}