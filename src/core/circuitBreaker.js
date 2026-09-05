/**
 * Circuit Breaker & Human-In-The-Loop (HITL) Anomaly Protection
 * Detects runaway spending, high retry velocity, and bounds breaches.
 */
const auditLedger = require('./auditLedger');

class CircuitBreaker {
  constructor() {
    this.pendingReviews = new Map(); // id -> review details
    this.agentRateLimitMap = new Map(); // agentId -> timestamps[]
    this.maxVelocityPerMinute = 8;
    this.listeners = new Set();
  }

  /**
   * Evaluates incoming action before execution
   * @returns {{ status: 'OK'|'TRIPPED', reviewId?: string, reason?: string }}
   */
  checkRisk({ agentId, protocol, action, amountInPaisa, mandate, riskOverride = false }) {
    if (riskOverride) {
      return { status: 'OK' };
    }

    const now = Date.now();

    // 1. Velocity check
    const timestamps = this.agentRateLimitMap.get(agentId) || [];
    const recentTimestamps = timestamps.filter(t => now - t < 60000);
    recentTimestamps.push(now);
    this.agentRateLimitMap.set(agentId, recentTimestamps);

    if (recentTimestamps.length > this.maxVelocityPerMinute) {
      const reason = `Velocity anomaly: Agent ${agentId} triggered ${recentTimestamps.length} actions in under 60 seconds (Limit: ${this.maxVelocityPerMinute}).`;
      const review = this.createReviewRequest({
        agentId,
        protocol,
        action,
        amountInPaisa,
        mandate,
        reason,
        type: 'VELOCITY_ANOMALY'
      });
      return { status: 'TRIPPED', reviewId: review.id, reason };
    }

    // 2. High-value sudden jump or deliberate test anomaly check
    if (mandate && amountInPaisa > mandate.spendingCapInPaisa) {
      const excess = ((amountInPaisa - mandate.spendingCapInPaisa) / 100).toFixed(2);
      const reason = `Spending cap breach: Cart amount ₹${(amountInPaisa / 100).toFixed(2)} exceeds authorized mandate limit of ₹${(mandate.spendingCapInPaisa / 100).toFixed(2)} by ₹${excess}.`;
      
      const review = this.createReviewRequest({
        agentId,
        protocol,
        action,
        amountInPaisa,
        mandate,
        reason,
        type: 'CAP_BREACH'
      });
      return { status: 'TRIPPED', reviewId: review.id, reason };
    }

    return { status: 'OK' };
  }

  createReviewRequest({ agentId, protocol, action, amountInPaisa, mandate, reason, type }) {
    const id = 'rev_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const review = {
      id,
      agentId,
      protocol,
      action,
      amountInPaisa,
      amountRupees: (amountInPaisa / 100).toFixed(2),
      mandate,
      reason,
      type,
      timestamp: Date.now(),
      status: 'PENDING_HUMAN_APPROVAL'
    };

    this.pendingReviews.set(id, review);

    // Log to audit chain as CIRCUIT_TRIPPED
    auditLedger.logEvent({
      agentId,
      protocol,
      action: `CIRCUIT_BREAKER_TRIPPED:${action}`,
      verdict: 'CIRCUIT_TRIPPED',
      explanation: `Circuit breaker intercepted action: ${reason}. Awaiting human-in-the-loop authorization.`,
      payload: { reviewId: id, details: review }
    });

    this.notifyListeners({ type: 'REVIEW_REQUESTED', review });
    return review;
  }

  /**
   * Human operator approves or rejects pending paused action
   */
  resolveReview(reviewId, decision, humanOperator = 'Merchant Admin') {
    const review = this.pendingReviews.get(reviewId);
    if (!review) {
      return { success: false, error: 'Review request not found or already resolved.' };
    }

    review.status = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    review.resolvedAt = Date.now();
    review.resolvedBy = humanOperator;
    this.pendingReviews.delete(reviewId);

    auditLedger.logEvent({
      agentId: review.agentId,
      protocol: review.protocol,
      action: `HUMAN_REVIEW_DECISION:${review.action}`,
      verdict: decision === 'APPROVE' ? 'MANUAL_OVERRIDE' : 'BLOCKED',
      explanation: `Human operator (${humanOperator}) ${decision === 'APPROVE' ? 'approved override for' : 'denied'} paused transaction. Reason: ${review.reason}`,
      payload: { reviewId, decision, originalReview: review }
    });

    this.notifyListeners({ type: 'REVIEW_RESOLVED', reviewId, decision, review });
    return { success: true, review };
  }

  getPendingReviews() {
    return Array.from(this.pendingReviews.values());
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notifyListeners(data) {
    for (const listener of this.listeners) {
      try {
        listener(data);
      } catch (err) {
        console.error("Error notifying circuit breaker listener:", err);
      }
    }
  }
}

module.exports = new CircuitBreaker();
