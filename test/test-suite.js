/**
 * Comprehensive Automated Test Suite for Agent Commerce Gateway (ACG)
 */
const assert = require('assert');
const mandates = require('../src/core/mandates');
const auditLedger = require('../src/core/auditLedger');
const circuitBreaker = require('../src/core/circuitBreaker');
const catalog = require('../src/core/catalog');
const razorpayAdapter = require('../src/core/razorpayAdapter');
const buyerAgent = require('../src/agents/buyerAgent');

async function runAllTests() {
  console.log('\n🧪 Starting ACG Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}`);
      failed++;
    }
  }

  async function asyncTest(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}`);
      failed++;
    }
  }

  // 1. Mandate Issuance & Cryptographic Tamper Resistance
  test('Mandate Authority: Issue and verify legitimate mandate', () => {
    const mandate = mandates.issueMandate({
      agentId: 'agent_test_01',
      spendingCapInPaisa: 150000,
      allowedCategories: ['electronics', 'books']
    });

    assert.ok(mandate.signature, 'Mandate must have cryptographic signature');
    assert.strictEqual(mandate.spendingCapInPaisa, 150000);

    const verification = mandates.verifyMandate(mandate, 120000, 'electronics');
    assert.strictEqual(verification.valid, true, 'Legitimate mandate should verify');
  });

  test('Mandate Authority: Reject tampered signature or overspend', () => {
    const mandate = mandates.issueMandate({
      agentId: 'agent_test_02',
      spendingCapInPaisa: 100000, // ₹1,000
      allowedCategories: ['books']
    });

    // Overspend
    const overspendVerification = mandates.verifyMandate(mandate, 200000, 'books');
    assert.strictEqual(overspendVerification.valid, false, 'Should reject overspend');

    // Category breach
    const categoryVerification = mandates.verifyMandate(mandate, 50000, 'electronics');
    assert.strictEqual(categoryVerification.valid, false, 'Should reject invalid category');

    // Tampered payload
    const tampered = { ...mandate, spendingCapInPaisa: 999999 };
    const tamperVerification = mandates.verifyMandate(tampered, 50000, 'books');
    assert.strictEqual(tamperVerification.valid, false, 'Should reject tampered signature');
  });

  // 2. Hash-Chained Audit Ledger
  test('Audit Ledger: Append blocks and verify SHA-256 cryptographic chain', () => {
    const initialBlockCount = auditLedger.getChain().length;
    
    auditLedger.logEvent({
      agentId: 'test_agent_audit',
      protocol: 'ACP',
      action: 'TEST_EVENT_01',
      verdict: 'ALLOWED',
      explanation: 'Test event 1'
    });

    auditLedger.logEvent({
      agentId: 'test_agent_audit',
      protocol: 'AP2',
      action: 'TEST_EVENT_02',
      verdict: 'ALLOWED',
      explanation: 'Test event 2'
    });

    assert.strictEqual(auditLedger.getChain().length, initialBlockCount + 2);

    const integrity = auditLedger.verifyChainIntegrity();
    assert.strictEqual(integrity.valid, true, 'Audit chain integrity must be valid');
  });

  // 3. Circuit Breaker & Human-In-The-Loop
  test('Circuit Breaker: Intercept out-of-bounds action and handle human resolution', () => {
    const mandate = mandates.issueMandate({
      agentId: 'breaker_test_agent',
      spendingCapInPaisa: 50000, // ₹500
      allowedCategories: ['books']
    });

    const check = circuitBreaker.checkRisk({
      agentId: 'breaker_test_agent',
      protocol: 'AP2',
      action: 'CHECKOUT',
      amountInPaisa: 150000, // ₹1,500 > ₹500
      mandate
    });

    assert.strictEqual(check.status, 'TRIPPED', 'Circuit breaker must trip on cap breach');
    assert.ok(check.reviewId, 'Review ID must be generated');

    // Human operator resolves
    const resolveResult = circuitBreaker.resolveReview(check.reviewId, 'APPROVE', 'Test Judge');
    assert.strictEqual(resolveResult.success, true);
    assert.strictEqual(resolveResult.review.status, 'APPROVED');
  });

  // 4. Growth Engine Upsell Hook
  test('Growth Engine: Calculate mandate headroom and suggest upsell item', () => {
    const cart = [{ id: 'prod_book_01', name: 'AI Book', category: 'books', priceInPaisa: 89900, priceRupees: 899, quantity: 1 }];
    const mandateCapInPaisa = 150000; // ₹1,500 (headroom: ₹601)

    const upsell = catalog.findHeadroomUpsell(cart, mandateCapInPaisa);
    assert.ok(upsell, 'Should find upsell candidate');
    assert.ok(upsell.product.priceInPaisa <= (150000 - 89900), 'Upsell must fit in headroom');
  });

  // 5. Razorpay Test Rails Settlement
  await asyncTest('Razorpay Test Adapter: Create order and capture payment signature', async () => {
    const order = await razorpayAdapter.createOrder({ amountInPaisa: 129900, receipt: 'rcpt_test_unit' });
    assert.ok(order.id.startsWith('order_'));
    assert.strictEqual(order.amount, 129900);

    const capture = await razorpayAdapter.capturePayment({ orderId: order.id, amountInPaisa: 129900, agentId: 'test_agent' });
    assert.strictEqual(capture.success, true);
    assert.ok(capture.payment.razorpay_signature, 'Payment must include Razorpay HMAC signature');
  });

  // 6. Autonomous Buyer Simulation: ACP Dialect
  await asyncTest('Autonomous Buyer Agent: Execute ACP flow end-to-end', async () => {
    const sim = await buyerAgent.runSimulation({
      persona: 'budget_cautious_acp',
      budgetRupees: 1500,
      goal: 'Buy audio accessories under budget'
    });

    assert.strictEqual(sim.executionResult.success, true, 'ACP simulation should succeed');
    assert.ok(sim.executionResult.orderId, 'Should yield Razorpay Order ID');
  });

  // 7. Autonomous Buyer Simulation: Rogue Anomaly Breaker
  await asyncTest('Autonomous Buyer Agent: Rogue persona triggers Circuit Breaker', async () => {
    const sim = await buyerAgent.runSimulation({
      persona: 'rogue_anomaly_breaker',
      budgetRupees: 1000,
      goal: 'Try overspending'
    });

    assert.strictEqual(sim.executionResult.circuitTripped, true, 'Rogue persona must trip circuit breaker');
    assert.ok(sim.executionResult.reviewId, 'Must generate review ID for human approval');
  });

  console.log(`\n🏁 Test Run Finished: ${passed} passed, ${failed} failed.\n`);
  if (failed > 0) process.exit(1);
}

runAllTests();
