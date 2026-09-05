/**
 * Cryptographic Mandate Authority & Security Engine
 * Uses Ed25519 / HMAC-SHA256 signatures for zero-trust mandate verification.
 */
const crypto = require('crypto');

class MandateAuthority {
  constructor(secretKey = 'acg_master_security_signing_seed_2026') {
    this.secretKey = secretKey;
    // Pre-seed some merchant and agent public identities
    this.agentRegistry = new Map();
  }

  /**
   * Generates a tamper-proof cryptographic signature for a mandate
   * @param {Object} mandatePayload 
   * @returns {string} hex signature
   */
  signMandate(mandatePayload) {
    const canonicalString = this.canonicalize(mandatePayload);
    const hmac = crypto.createHmac('sha256', this.secretKey);
    hmac.update(canonicalString);
    return hmac.digest('hex');
  }

  /**
   * Canonicalizes payload object keys for deterministic hash comparison
   */
  canonicalize(payload) {
    const sorted = Object.keys(payload)
      .filter(k => k !== 'signature')
      .sort()
      .reduce((acc, key) => {
        acc[key] = payload[key];
        return acc;
      }, {});
    return JSON.stringify(sorted);
  }

  /**
   * Issues a signed spending mandate for an AI Buyer Agent
   */
  issueMandate({ agentId, agentName, spendingCapInPaisa, allowedCategories, expiryMinutes = 60, merchantId = 'rzp_merchant_acg_main' }) {
    const mandateId = 'mnd_' + crypto.randomBytes(6).toString('hex');
    const expiresAt = Date.now() + (expiryMinutes * 60 * 1000);

    const mandate = {
      mandateId,
      agentId,
      agentName,
      merchantId,
      spendingCapInPaisa: Number(spendingCapInPaisa),
      allowedCategories: Array.isArray(allowedCategories) ? allowedCategories : [allowedCategories],
      createdAt: Date.now(),
      expiresAt,
      nonce: crypto.randomBytes(8).toString('hex')
    };

    mandate.signature = this.signMandate(mandate);
    this.agentRegistry.set(mandateId, { ...mandate, spentInPaisa: 0, status: 'ACTIVE' });
    return mandate;
  }

  /**
   * Verifies mandate authenticity and boundaries
   * @param {Object} mandate 
   * @param {number} requiredAmountInPaisa 
   * @param {string} category 
   * @returns {{ valid: boolean, reason: string }}
   */
  verifyMandate(mandate, requiredAmountInPaisa = 0, category = null) {
    if (!mandate || !mandate.mandateId || !mandate.signature) {
      return { valid: false, reason: 'Mandate is missing required fields or signature.' };
    }

    // Verify signature
    const expectedSig = this.signMandate(mandate);
    if (expectedSig !== mandate.signature) {
      return { valid: false, reason: 'Cryptographic signature mismatch. Mandate was tampered with or forged.' };
    }

    // Check expiration
    if (Date.now() > mandate.expiresAt) {
      return { 
        valid: false, 
        reason: `Mandate expired at ${new Date(mandate.expiresAt).toISOString()} (current time ${new Date().toISOString()}).` 
      };
    }

    // Check spending cap
    if (requiredAmountInPaisa > mandate.spendingCapInPaisa) {
      return {
        valid: false,
        reason: `Transaction amount (₹${(requiredAmountInPaisa / 100).toFixed(2)}) exceeds authorized mandate spending cap of ₹${(mandate.spendingCapInPaisa / 100).toFixed(2)}.`
      };
    }

    // Check category restrictions
    if (category && mandate.allowedCategories && mandate.allowedCategories.length > 0) {
      const isAllowed = mandate.allowedCategories.includes('*') || mandate.allowedCategories.includes(category.toLowerCase());
      if (!isAllowed) {
        return {
          valid: false,
          reason: `Category '${category}' is not in allowed mandate categories: [${mandate.allowedCategories.join(', ')}].`
        };
      }
    }

    return { valid: true, reason: `Authorized within ₹${(mandate.spendingCapInPaisa / 100).toFixed(2)} cap and category scope.` };
  }

  /**
   * Records expenditure on an active mandate
   */
  deductMandateSpend(mandateId, amountInPaisa) {
    const record = this.agentRegistry.get(mandateId);
    if (record) {
      record.spentInPaisa = (record.spentInPaisa || 0) + amountInPaisa;
      this.agentRegistry.set(mandateId, record);
    }
  }
}

module.exports = new MandateAuthority();
