/**
 * ACP (Agentic Commerce Protocol) Adapter
 * Emulates the OpenAI / Stripe ACP session-based cart, intent, and checkout handoff flow.
 */
const express = require('express');
const router = express.Router();
const catalog = require('../core/catalog');
const mandates = require('../core/mandates');
const auditLedger = require('../core/auditLedger');
const circuitBreaker = require('../core/circuitBreaker');
const razorpayAdapter = require('../core/razorpayAdapter');

// In-memory ACP cart sessions
const acpSessions = new Map();

/**
 * 1. Initialize or get cart session
 * POST /api/protocols/acp/cart
 */
router.post('/cart', (req, res) => {
  const { agentId, mandate } = req.body;
  const sessionId = 'acp_sess_' + Math.random().toString(36).substring(2, 9);

  const session = {
    sessionId,
    agentId: agentId || 'acp_buyer_agent',
    mandate: mandate || null,
    items: [],
    subtotalInPaisa: 0,
    status: 'ACTIVE',
    createdAt: Date.now()
  };

  acpSessions.set(sessionId, session);

  auditLedger.logEvent({
    agentId: session.agentId,
    protocol: 'ACP',
    action: 'CART_SESSION_INIT',
    verdict: 'ALLOWED',
    explanation: `ACP Cart session created for agent ${session.agentId}.`,
    payload: { sessionId }
  });

  res.json({
    protocol: 'ACP/1.0',
    sessionId,
    status: 'ACTIVE',
    items: [],
    subtotalInPaisa: 0
  });
});

/**
 * 2. Add item to ACP cart
 * POST /api/protocols/acp/cart/:sessionId/items
 */
router.post('/cart/:sessionId/items', (req, res) => {
  const { sessionId } = req.params;
  const { productId, quantity = 1 } = req.body;

  const session = acpSessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'ACP Session not found' });
  }

  const product = catalog.getProductById(productId);
  if (!product) {
    return res.status(404).json({ error: `Product ${productId} not found in merchant catalog` });
  }

  session.items.push({
    id: product.id,
    name: product.name,
    category: product.category,
    priceInPaisa: product.priceInPaisa,
    priceRupees: product.priceRupees,
    quantity
  });

  session.subtotalInPaisa = session.items.reduce((sum, i) => sum + (i.priceInPaisa * i.quantity), 0);
  acpSessions.set(sessionId, session);

  // Check for upsell headroom
  let upsellOpportunity = null;
  if (session.mandate) {
    upsellOpportunity = catalog.findHeadroomUpsell(session.items, session.mandate.spendingCapInPaisa);
  }

  auditLedger.logEvent({
    agentId: session.agentId,
    protocol: 'ACP',
    action: 'CART_ITEM_ADD',
    verdict: 'ALLOWED',
    explanation: `Added '${product.name}' (₹${product.priceRupees}) to ACP cart. Total now ₹${(session.subtotalInPaisa / 100).toFixed(2)}.`,
    payload: { sessionId, productId, subtotalInPaisa: session.subtotalInPaisa, upsellOpportunity }
  });

  res.json({
    protocol: 'ACP/1.0',
    sessionId,
    items: session.items,
    subtotalInPaisa: session.subtotalInPaisa,
    subtotalRupees: (session.subtotalInPaisa / 100).toFixed(2),
    upsellSuggestion: upsellOpportunity
  });
});

/**
 * 3. ACP Checkout & Payment Execution
 * POST /api/protocols/acp/checkout
 */
router.post('/checkout', async (req, res) => {
  const { sessionId, mandate, overrideReviewId } = req.body;

  const session = acpSessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'ACP Session not found or expired' });
  }

  const activeMandate = mandate || session.mandate;
  if (!activeMandate) {
    auditLedger.logEvent({
      agentId: session.agentId,
      protocol: 'ACP',
      action: 'CHECKOUT_REJECTED',
      verdict: 'BLOCKED',
      explanation: 'Blocked: ACP checkout requires a cryptographically signed spending mandate.',
      payload: { sessionId }
    });
    return res.status(403).json({ error: 'Mandate required for autonomous agent checkout.' });
  }

  // 1. Verify Cryptographic Mandate
  const mandateVerification = mandates.verifyMandate(activeMandate, session.subtotalInPaisa);
  if (!mandateVerification.valid) {
    // Check Circuit Breaker for anomaly
    const breakerCheck = circuitBreaker.checkRisk({
      agentId: session.agentId,
      protocol: 'ACP',
      action: 'CHECKOUT_EXECUTION',
      amountInPaisa: session.subtotalInPaisa,
      mandate: activeMandate
    });

    if (breakerCheck.status === 'TRIPPED') {
      return res.status(423).json({
        status: 'CIRCUIT_TRIPPED',
        error: 'Transaction suspended by Circuit Breaker anomaly check.',
        reviewId: breakerCheck.reviewId,
        reason: breakerCheck.reason
      });
    }

    auditLedger.logEvent({
      agentId: session.agentId,
      protocol: 'ACP',
      action: 'MANDATE_VERIFICATION_FAILED',
      verdict: 'BLOCKED',
      explanation: `Blocked: ${mandateVerification.reason}`,
      payload: { sessionId, mandate: activeMandate }
    });

    return res.status(400).json({ error: mandateVerification.reason });
  }

  try {
    // 2. Create Razorpay Test Order
    const order = await razorpayAdapter.createOrder({
      amountInPaisa: session.subtotalInPaisa,
      receipt: `rcpt_acp_${sessionId}`,
      notes: {
        protocol: 'ACP',
        agentId: session.agentId,
        mandateId: activeMandate.mandateId
      }
    });

    // 3. Settle / Capture via Razorpay Test Rails
    const captureResult = await razorpayAdapter.capturePayment({
      orderId: order.id,
      amountInPaisa: session.subtotalInPaisa,
      paymentMethod: 'acp_signed_mandate_vault',
      agentId: session.agentId
    });

    mandates.deductMandateSpend(activeMandate.mandateId, session.subtotalInPaisa);
    session.status = 'COMPLETED';

    auditLedger.logEvent({
      agentId: session.agentId,
      protocol: 'ACP',
      action: 'CHECKOUT_SUCCESSFUL',
      verdict: 'ALLOWED',
      explanation: `ACP Checkout approved & settled on Razorpay test rails: Order ${order.id}, Payment ${captureResult.payment.id} for ₹${(session.subtotalInPaisa / 100).toFixed(2)}. ${mandateVerification.reason}`,
      payload: {
        sessionId,
        orderId: order.id,
        paymentId: captureResult.payment.id,
        mandateId: activeMandate.mandateId,
        items: session.items
      }
    });

    res.json({
      protocol: 'ACP/1.0',
      success: true,
      status: 'PAID',
      orderId: order.id,
      paymentId: captureResult.payment.id,
      amountRupees: (session.subtotalInPaisa / 100).toFixed(2),
      razorpaySignature: captureResult.payment.razorpay_signature,
      receipt: order.receipt
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
