/**
 * x402 Micropayment Protocol Proof-of-Concept
 * Simulates machine-to-machine HTTP 402 Payment Required micropayments for premium agent catalog endpoints.
 */
const express = require('express');
const router = express.Router();
const auditLedger = require('../core/auditLedger');

const micropaymentTokens = new Set();

/**
 * Premium Agent Tool Query: Real-Time Supplier Inventory & Price Optimization API
 * Returns HTTP 402 if unauthenticated / unpaid, accepts X-402-Payment-Proof header.
 */
router.get('/insights/realtime-stock', (req, res) => {
  const paymentProof = req.headers['x-402-payment-proof'];
  const agentId = req.headers['x-agent-id'] || 'x402_agent';

  if (!paymentProof || !micropaymentTokens.has(paymentProof)) {
    auditLedger.logEvent({
      agentId,
      protocol: 'x402',
      action: 'MICROPAYMENT_CHALLENGE',
      verdict: 'BLOCKED',
      explanation: 'HTTP 402: Agent requested premium realtime supplier feed without micropayment voucher (Cost: ₹2.00).',
      payload: { requiredPaisa: 200 }
    });

    return res.status(402).json({
      error: 'Payment Required (x402 Micropayment)',
      requiredAmountPaisa: 200,
      requiredAmountRupees: 2.00,
      paymentEndpoint: '/api/protocols/x402/settle',
      challenge: 'x402_challenge_' + Math.random().toString(36).substring(2, 8)
    });
  }

  // If paid, consume voucher and return high-fidelity data
  micropaymentTokens.delete(paymentProof);

  auditLedger.logEvent({
    agentId,
    protocol: 'x402',
    action: 'PREMIUM_DATA_SERVED',
    verdict: 'ALLOWED',
    explanation: 'HTTP 402: Micropayment voucher verified. Delivered real-time inventory feed to agent.',
    payload: { paymentProof }
  });

  res.json({
    protocol: 'x402/1.0',
    status: 'AUTHENTICATED_AND_SETTLED',
    data: {
      warehouseLocation: 'BLR-01',
      dispatchLatency: '12 minutes',
      nextDayAirAvailable: true,
      bulkDiscountThreshold: 5
    }
  });
});

/**
 * Micro-settlement endpoint
 */
router.post('/settle', (req, res) => {
  const { agentId, challenge } = req.body;
  const voucher = 'm402_voucher_' + Math.random().toString(36).substring(2, 10);
  micropaymentTokens.add(voucher);

  auditLedger.logEvent({
    agentId: agentId || 'x402_agent',
    protocol: 'x402',
    action: 'MICROPAYMENT_VOUCHER_ISSUED',
    verdict: 'ALLOWED',
    explanation: `Issued ₹2.00 micropayment voucher '${voucher}' to agent for challenge ${challenge}.`,
    payload: { voucher }
  });

  res.json({
    status: 'SUCCESS',
    voucher,
    amountRupees: 2.00,
    validForMs: 60000
  });
});

module.exports = router;
