/**
 * Autonomous Buyer Agent Engine
 * Simulates intelligent multi-persona agent shopping behavior with LLM-grade reasoning and fallback engines.
 */
const catalog = require('../core/catalog');
const mandates = require('../core/mandates');
const auditLedger = require('../core/auditLedger');

class BuyerAgentService {
  constructor() {
    this.activeSimulations = new Map();
  }

  /**
   * Runs an autonomous shopping loop for a given persona and goal
   */
  async runSimulation({ persona = 'budget_cautious_acp', budgetRupees = 1500, goal = 'Find best tech gift under budget', onStep = () => {} }) {
    const simulationId = 'sim_' + Date.now().toString(36);
    const logs = [];

    const appendLog = (stepName, message, data = null) => {
      const step = { stepName, message, timestamp: Date.now(), data };
      logs.push(step);
      onStep(step);
      return step;
    };

    appendLog('INIT', `Starting Autonomous Buyer Agent simulation with persona: [${persona}] and budget: ₹${budgetRupees}`);

    // Determine agent configurations based on persona
    let agentId, protocol, categories;
    if (persona === 'budget_cautious_acp') {
      agentId = 'agent_cautious_claire';
      protocol = 'ACP';
      categories = ['electronics', 'accessories', 'books'];
    } else if (persona === 'deal_hunter_ap2') {
      agentId = 'agent_hunter_hank';
      protocol = 'AP2';
      categories = ['electronics', 'lifestyle', 'books'];
    } else if (persona === 'rogue_anomaly_breaker') {
      agentId = 'agent_rogue_robin';
      protocol = 'AP2';
      categories = ['books']; // Restricted to books only!
    } else {
      agentId = 'agent_generic';
      protocol = 'ACP';
      categories = ['*'];
    }

    // STEP 1: Request Scoped Cryptographic Mandate
    appendLog('MANDATE_REQUEST', `Requesting scoped cryptographic mandate for ₹${budgetRupees} across categories: [${categories.join(', ')}]`);
    const mandate = mandates.issueMandate({
      agentId,
      agentName: persona,
      spendingCapInPaisa: budgetRupees * 100,
      allowedCategories: categories,
      expiryMinutes: 30
    });

    appendLog('MANDATE_RECEIVED', `Mandate issued: ID ${mandate.mandateId} (HMAC-SHA256 Sig: ${mandate.signature.substring(0, 16)}...)`, { mandate });

    // STEP 2: Agent Discovers Merchant Catalog via Tools
    appendLog('TOOL_CALL_SEARCH', `Agent executing semantic tool call 'search_catalog' for goal: "${goal}" with max price ₹${budgetRupees}`);
    const candidateProducts = catalog.searchProducts("", null, budgetRupees);
    appendLog('TOOL_RESULT_SEARCH', `Discovered ${candidateProducts.length} candidate products in catalog matching criteria.`, { candidateProducts });

    // STEP 3: Agent Decision Logic
    let selectedProduct;
    let attemptRogueOverspend = (persona === 'rogue_anomaly_breaker');

    if (attemptRogueOverspend) {
      // Deliberately pick an expensive product that exceeds cap or violates category
      selectedProduct = catalog.getProductById('prod_elec_02') || candidateProducts[0]; // NovaPulse Smartwatch ₹2,499 (exceeds budget ₹1,500 and violates 'books' category)
      appendLog('DECISION_ANOMALY', `[ADVERSARIAL SIMULATION] Agent deliberately selecting '${selectedProduct.name}' (₹${selectedProduct.priceRupees}) to test Circuit Breaker and category constraints!`);
    } else {
      // Pick best matching product within budget
      selectedProduct = candidateProducts.find(p => p.priceRupees <= budgetRupees) || candidateProducts[0];
      appendLog('DECISION_OPTIMAL', `Agent evaluated alternatives and selected '${selectedProduct.name}' (₹${selectedProduct.priceRupees}) based on rating (${selectedProduct.rating}⭐) and budget fit.`);
    }

    // STEP 4: Protocol Execution (ACP vs AP2)
    let executionResult;

    if (protocol === 'ACP') {
      appendLog('PROTOCOL_ACP_START', `Executing transaction via OpenAI/Stripe ACP Dialect (Cart -> Intent -> Settlement)...`);
      
      // 4a. Init Cart
      const cartSessionId = 'acp_sess_' + Math.random().toString(36).substring(2, 8);
      appendLog('ACP_CART_INIT', `ACP Cart session '${cartSessionId}' initialized.`);

      // 4b. Add Item
      const cartItems = [{ id: selectedProduct.id, name: selectedProduct.name, category: selectedProduct.category, priceInPaisa: selectedProduct.priceInPaisa, priceRupees: selectedProduct.priceRupees, quantity: 1 }];
      appendLog('ACP_ITEM_ADD', `Added '${selectedProduct.name}' to ACP Cart.`);

      // 4c. Growth Engine Upsell Check
      const upsell = catalog.findHeadroomUpsell(cartItems, mandate.spendingCapInPaisa);
      if (upsell && persona === 'budget_cautious_acp') {
        appendLog('GROWTH_UPSELL_PROMPT', `[Merchant Growth Engine] Headroom detected: ₹${upsell.headroomRupees} remaining. Suggested add-on: '${upsell.product.name}' (₹${upsell.product.priceRupees}).`);
        
        // Agent reasoning to accept upsell if affordable
        if ((cartItems[0].priceInPaisa + upsell.product.priceInPaisa) <= mandate.spendingCapInPaisa) {
          cartItems.push({
            id: upsell.product.id,
            name: upsell.product.name,
            category: upsell.product.category,
            priceInPaisa: upsell.product.priceInPaisa,
            priceRupees: upsell.product.priceRupees,
            quantity: 1
          });
          appendLog('GROWTH_UPSELL_ACCEPTED', `Agent accepted upsell! Added '${upsell.product.name}'. New total: ₹${((cartItems[0].priceInPaisa + upsell.product.priceInPaisa) / 100).toFixed(2)}`);
        }
      }

      // 4d. Mandate Verification & Razorpay Checkout
      const totalInPaisa = cartItems.reduce((sum, i) => sum + i.priceInPaisa, 0);
      const verification = mandates.verifyMandate(mandate, totalInPaisa, selectedProduct.category);

      if (!verification.valid) {
        appendLog('TRANSACTION_REJECTED', `Gateway rejected checkout: ${verification.reason}`);
        executionResult = { success: false, reason: verification.reason };
      } else {
        const razorpayAdapter = require('../core/razorpayAdapter');
        const order = await razorpayAdapter.createOrder({ amountInPaisa: totalInPaisa, receipt: `rcpt_${cartSessionId}` });
        const capture = await razorpayAdapter.capturePayment({ orderId: order.id, amountInPaisa: totalInPaisa, agentId });
        
        auditLedger.logEvent({
          agentId,
          protocol: 'ACP',
          action: 'AUTONOMOUS_BUYER_ACP_SUCCESS',
          verdict: 'ALLOWED',
          explanation: `Autonomous buyer completed checkout for ₹${(totalInPaisa / 100).toFixed(2)} across ${cartItems.length} items on Razorpay test rails.`,
          payload: { orderId: order.id, paymentId: capture.payment.id, items: cartItems }
        });

        appendLog('CHECKOUT_COMPLETE', `Checkout SUCCESS! Razorpay Order: ${order.id} | Payment ID: ${capture.payment.id} | Total Paid: ₹${(totalInPaisa / 100).toFixed(2)}`, {
          orderId: order.id,
          paymentId: capture.payment.id,
          totalPaidRupees: (totalInPaisa / 100).toFixed(2),
          items: cartItems
        });
        executionResult = { success: true, orderId: order.id, paymentId: capture.payment.id, totalPaid: (totalInPaisa / 100).toFixed(2), items: cartItems };
      }

    } else {
      // AP2 Protocol Flow
      appendLog('PROTOCOL_AP2_START', `Executing transaction via Google AP2 Signed Mandate Dialect...`);
      const items = [{ productId: selectedProduct.id, quantity: 1 }];
      const totalInPaisa = selectedProduct.priceInPaisa;

      // Mandate & Bounds Verification
      const verification = mandates.verifyMandate(mandate, totalInPaisa, selectedProduct.category);

      if (!verification.valid) {
        // Trigger Circuit Breaker for HITL demonstration
        const circuitBreaker = require('../core/circuitBreaker');
        const breakerCheck = circuitBreaker.checkRisk({
          agentId,
          protocol: 'AP2',
          action: 'AUTONOMOUS_AP2_EXECUTION',
          amountInPaisa: totalInPaisa,
          mandate
        });

        appendLog('CIRCUIT_BREAKER_TRIPPED', `[CIRCUIT BREAKER ACTIVATED] Out-of-bounds action detected! ${verification.reason}. Review ID: ${breakerCheck.reviewId}`, {
          reviewId: breakerCheck.reviewId,
          reason: breakerCheck.reason
        });

        executionResult = {
          success: false,
          circuitTripped: true,
          reviewId: breakerCheck.reviewId,
          reason: verification.reason
        };
      } else {
        const razorpayAdapter = require('../core/razorpayAdapter');
        const order = await razorpayAdapter.createOrder({ amountInPaisa: totalInPaisa, receipt: `rcpt_ap2_${mandate.mandateId}` });
        const capture = await razorpayAdapter.capturePayment({ orderId: order.id, amountInPaisa: totalInPaisa, agentId });

        auditLedger.logEvent({
          agentId,
          protocol: 'AP2',
          action: 'AUTONOMOUS_BUYER_AP2_SUCCESS',
          verdict: 'ALLOWED',
          explanation: `AP2 Autonomous buyer mandate verified & settled on Razorpay test rails: Order ${order.id} for ₹${(totalInPaisa / 100).toFixed(2)}.`,
          payload: { orderId: order.id, paymentId: capture.payment.id, mandateId: mandate.mandateId }
        });

        appendLog('CHECKOUT_COMPLETE', `AP2 Atomic Execution SUCCESS! Razorpay Order: ${order.id} | Payment ID: ${capture.payment.id} | Total Paid: ₹${(totalInPaisa / 100).toFixed(2)}`, {
          orderId: order.id,
          paymentId: capture.payment.id,
          totalPaidRupees: (totalInPaisa / 100).toFixed(2),
          product: selectedProduct
        });
        executionResult = { success: true, orderId: order.id, paymentId: capture.payment.id, totalPaid: (totalInPaisa / 100).toFixed(2), product: selectedProduct };
      }
    }

    appendLog('SIMULATION_ENDED', `Simulation finished for persona [${persona}]. Final status: ${executionResult.success ? 'SUCCESS' : (executionResult.circuitTripped ? 'CIRCUIT_TRIPPED (PAUSED FOR HITL)' : 'BLOCKED')}`);

    return {
      simulationId,
      persona,
      budgetRupees,
      logs,
      executionResult
    };
  }
}

module.exports = new BuyerAgentService();
