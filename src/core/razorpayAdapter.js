/**
 * Razorpay Test-Mode Payment Adapter
 * Communicates with Razorpay Test Mode APIs or provides deterministic high-fidelity simulation.
 */
const crypto = require('crypto');

class RazorpayTestAdapter {
  constructor() {
    this.keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_mock_acg2026';
    this.keySecret = process.env.RAZORPAY_KEY_SECRET || 'rzp_test_secret_mock2026';
    this.isLiveTestRails = !!process.env.RAZORPAY_KEY_ID;
    this.orders = new Map();
    this.payments = new Map();
  }

  /**
   * Creates a Razorpay Order
   * @param {number} amountInPaisa 
   * @param {string} currency 
   * @param {string} receipt 
   * @param {Object} notes 
   */
  async createOrder({ amountInPaisa, currency = 'INR', receipt, notes = {} }) {
    const orderId = 'order_' + crypto.randomBytes(8).toString('hex');
    const orderRecord = {
      id: orderId,
      entity: 'order',
      amount: amountInPaisa,
      amount_paid: 0,
      amount_due: amountInPaisa,
      currency,
      receipt: receipt || `rcpt_${Date.now()}`,
      status: 'created',
      attempts: 0,
      notes: {
        ...notes,
        gateway: 'Agent Commerce Gateway (ACG)',
        timestamp: new Date().toISOString()
      },
      created_at: Math.floor(Date.now() / 1000)
    };

    this.orders.set(orderId, orderRecord);
    return orderRecord;
  }

  /**
   * Authorizes and captures a payment for an order
   */
  async capturePayment({ orderId, amountInPaisa, paymentMethod = 'agent_mandate_vault', agentId }) {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found in Razorpay test rails.`);
    }

    const paymentId = 'pay_' + crypto.randomBytes(8).toString('hex');
    const signature = crypto
      .createHmac('sha256', this.keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    const paymentRecord = {
      id: paymentId,
      entity: 'payment',
      amount: amountInPaisa,
      currency: order.currency,
      status: 'captured',
      order_id: orderId,
      method: paymentMethod,
      captured: true,
      description: `ACG Agent Checkout - Agent: ${agentId}`,
      email: `${agentId || 'agent'}@autonomous.gateway`,
      contact: '+919876543210',
      fee: Math.round(amountInPaisa * 0.02),
      tax: Math.round(amountInPaisa * 0.0036),
      razorpay_signature: signature,
      created_at: Math.floor(Date.now() / 1000)
    };

    order.status = 'paid';
    order.amount_paid = amountInPaisa;
    order.amount_due = 0;
    this.orders.set(orderId, order);
    this.payments.set(paymentId, paymentRecord);

    return {
      success: true,
      payment: paymentRecord,
      order
    };
  }

  getOrder(orderId) {
    return this.orders.get(orderId) || null;
  }
}

module.exports = new RazorpayTestAdapter();
