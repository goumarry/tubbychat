// Seau à jetons : capacité = rafale tolérée, recharge = débit soutenu autorisé.
class TokenBucket {
  constructor(capacity, refillPerSecond) {
    this.capacity = capacity;
    this.refill = refillPerSecond;
    this.tokens = capacity;
    this.last = Date.now();
  }

  take() {
    const now = Date.now();
    this.tokens = Math.min(this.capacity, this.tokens + ((now - this.last) / 1000) * this.refill);
    this.last = now;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}

module.exports = { TokenBucket };
