// src/utils/rateLimiter.js

export class RateLimiter {
  constructor() {
    this.userCooldowns = new Map();
    this.lastGlobalRequest = 0;
    // --- Add these properties for quota management ---
    this.quotaExhausted = false;
    this.quotaResetTime = 0;
  }

  checkUserCooldown(userId, cooldownTime) {
    const now = Date.now();
    const userLastRequest = this.userCooldowns.get(userId) || 0;

    if (now - userLastRequest < cooldownTime) {
      // Return remaining seconds
      return Math.ceil((cooldownTime - (now - userLastRequest)) / 1000);
    }

    return 0;
  }

  checkGlobalCooldown(globalCooldown) {
    const now = Date.now();
    if (now - this.lastGlobalRequest < globalCooldown) {
      // Return remaining seconds
      return Math.ceil(
        (globalCooldown - (now - this.lastGlobalRequest)) / 1000
      );
    }
    return 0;
  }

  updateCooldowns(userId) {
    const now = Date.now();
    this.userCooldowns.set(userId, now);
    this.lastGlobalRequest = now;
  }

  // ===============================================
  // <<< ADD THIS MISSING CODE BLOCK >>>
  // ===============================================

  /**
   * Checks if the API quota is currently marked as exhausted.
   * @returns {boolean} True if the quota is exhausted and the reset time has not passed.
   */
  isQuotaExhausted() {
    // Return true only if the flag is set AND the current time is before the reset time
    return this.quotaExhausted && Date.now() < this.quotaResetTime;
  }

  /**
   * Sets the quota status to exhausted and calculates when it should reset.
   * @param {number} [retryDelay=60000] - The delay in milliseconds until the quota might be reset.
   */
  setQuotaExhausted(retryDelay = 60000) {
    this.quotaExhausted = true;
    this.quotaResetTime = Date.now() + retryDelay;
    console.warn(
      `API quota exhausted. Bot will use offline responses for the next ${
        retryDelay / 1000
      } seconds.`
    );
  }
}
