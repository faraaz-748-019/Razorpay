/**
 * AP2 (Agent Payment Protocol 2) Adapter
 * Emulates the Google AP2 cryptographic mandate-based atomic intent execution dialect.
 */
const express = require('express');
const router = express.Router();
const catalog = require('../core/catalog');
const mandates = require('../core/mandates');
const auditLedger = require('../core/auditLedger');
const circuitBreaker = require('../core/circuitBreaker');
const razorpayAdapter = require('../core/razorpayAdapter');

/**
 * 1. AP2 Mandate Verification & Intent Pre-Flight
 * POST /api/protocols/ap2/intent/preflight
 */
router.post('/intent/preflight', (req, res) => {
  const { mandate, items, intentDescription } = req.body;

  if (!mandate) {
    return res.status(400).json({ error: 'AP2 protocol requires a cryptographically signed mandate' });
  }

  // Calculate required amount
  const totalInPaisa = (items || []).reduce((sum, item) => {
    const prod = catalog.getProductById(item.productId || item.id);
    return sum + (prod ? prod.priceInPaisa * (item.quantity || 1) : 0);
  }, 0);

  const verification = mandates.verifyMandate(mandate, totalInPaisa);

  auditLedger.logEvent({
    agentId: mandate.agentId || 'ap2_agent',
    protocol: 'AP2',
    action: 'MANDATE_PREFLIGHT_VERIFY',
    verdict: verification.valid ? 'ALLOWED' : 'BLOCKED',
    explanation: `AP2 Pre-flight verification ${verification.valid ? 'PASSED' : 'FAILED'}: ${verification.reason}`,
    payload: { mandateId: mandate.mandateId, totalInPaisa, intentDescription }
  });

  res.json({
    protocol: 'AP2/2.0-GoogleSpec',
    preflightStatus: verification.valid ? 'VALIDATED' : 'REJECTED',
    authorizedCapInPaisa: mandate.spendingCapInPaisa,
    intentTotalInPaisa: totalInPaisa,
    intentTotalRupees: (totalInPaisa / 100).toFixed(2),
    reason: verification.reason
  });
});

/**
 * 2. Atomic Mandate Execution & Checkout
 * POST /api/protocols/ap2/mandate/execute
 */
router.post('/mandate/execute', async (req, res) => {
  const { mandate, items, paymentContext, riskOverride } = req.body;

  if (!mandate || !items || items.length === 0) {
    return res.status(400).json({ error: 'AP2 atomic execution requires signed mandate and target item list.' });
  }

  // Calculate cart details
  const resolvedItems = [];
  let totalInPaisa = 0;

  for (const item of items) {
    const prod = catalog.getProductById(item.productId || item.id);
    if (!prod) {
      return res.status(404).json({ error: `Product ${item.productId || item.id} not found in catalog` });
    }
    const qty = item.quantity || 1;
    resolvedItems.push({
      id: prod.id,
      name: prod.name,
      category: prod.category,
      priceInPaisa: prod.priceInPaisa,
      priceRupees: prod.priceRupees,
      quantity: qty
    });
    totalInPaisa += prod.priceInPaisa * qty;
  }

  // 1. Mandate Verification
  const verification = mandates.verifyMandate(mandate, totalInPaisa);
  if (!verification.valid && !riskOverride) {
    // Check Circuit Breaker
    const breakerCheck = circuitBreaker.checkRisk({
      agentId: mandate.agentId,
      protocol: 'AP2',
      action: 'ATOMIC_MANDATE_EXECUTION',
      amountInPaisa: totalInPaisa,
      mandate,
      riskOverride
    });

    if (breakerCheck.status === 'TRIPPED') {
      return res.status(423).json({
        status: 'CIRCUIT_TRIPPED',
        error: 'Mandate bounds exceeded. Transaction suspended for Human-In-The-Loop approval.',
        reviewId: breakerCheck.reviewId,
        reason: breakerCheck.reason
      });
    }

    auditLedger.logEvent({
      agentId: mandate.agentId,
      protocol: 'AP2',
      action: 'MANDATE_EXECUTION_BLOCKED',
      verdict: 'BLOCKED',
      explanation: `AP2 Execution Denied: ${verification.reason}`,
      payload: { mandate, items: resolvedItems, totalInPaisa }
    });

    return res.status(403).json({
      protocol: 'AP2/2.0-GoogleSpec',
      status: 'REJECTED',
      error: verification.reason
    });
  }

  try {
    // 2. Razorpay Order Creation
    const order = await razorpayAdapter.createOrder({
      amountInPaisa: totalInPaisa,
      receipt: `rcpt_ap2_${mandate.mandateId}`,
      notes: {
        protocol: 'AP2',
        agentId: mandate.agentId,
        mandateId: mandate.mandateId,
        signature: mandate.signature
      }
    });

    // 3. Settle / Capture via Razorpay Test Rails
    const captureResult = await razorpayAdapter.capturePayment({
      orderId: order.id,
      amountInPaisa: totalInPaisa,
      paymentMethod: 'ap2_signed_mandate_vault',
      agentId: mandate.agentId
    });

    mandates.deductMandateSpend(mandate.mandateId, totalInPaisa);

    auditLedger.logEvent({
      agentId: mandate.agentId,
      protocol: 'AP2',
      action: 'ATOMIC_PAYMENT_CAPTURED',
      verdict: 'ALLOWED',
      explanation: `AP2 Atomic Mandate verified & settled on Razorpay test rails: Order ${order.id}, Payment ${captureResult.payment.id} for ₹${(totalInPaisa / 100).toFixed(2)}. ${verification.reason}`,
      payload: {
        mandateId: mandate.mandateId,
        orderId: order.id,
        paymentId: captureResult.payment.id,
        items: resolvedItems
      }
    });

    res.json({
      protocol: 'AP2/2.0-GoogleSpec',
      status: 'EXECUTED_AND_SETTLED',
      mandateId: mandate.mandateId,
      orderId: order.id,
      paymentId: captureResult.payment.id,
      amountRupees: (totalInPaisa / 100).toFixed(2),
      razorpaySignature: captureResult.payment.razorpay_signature,
      settlementTimestamp: Date.now()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
