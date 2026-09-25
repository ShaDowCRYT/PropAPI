export const config = {
  rateLimit: {
    windowMs: 60 * 1000,
    max: 100,
  },
  jobs: {
    concurrency: 3,
    baseBackoffMs: 2000,
    maxAttempts: 5,
    stuckTimeoutMs: 60 * 1000,
    pollIntervalMs: 1000,
  },
};
