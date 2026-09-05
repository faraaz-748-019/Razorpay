/**
 * Hash-Chained Audit Ledger
 * Provides an append-only, tamper-evident cryptographic log of all agent interactions.
 */
const crypto = require('crypto');

class AuditLedger {
  constructor() {
    this.chain = [];
    this.listeners = new Set();
    this.createGenesisBlock();
  }

  createGenesisBlock() {
    const genesisBlock = {
      index: 0,
      timestamp: Date.now(),
      agentId: "SYSTEM_GENESIS",
      protocol: "SYSTEM",
      action: "GENESIS_INITIALIZATION",
      verdict: "ALLOWED",
      explanation: "Agent Commerce Gateway (ACG) Genesis Block initialized for Razorpay test rails.",
      payload: { system: "ACG 2026", status: "ONLINE" },
      previousHash: "0000000000000000000000000000000000000000000000000000000000000000",
      hash: ""
    };
    genesisBlock.hash = this.calculateHash(genesisBlock);
    this.chain.push(genesisBlock);
  }

  calculateHash(block) {
    const dataString = `${block.index}|${block.timestamp}|${block.agentId}|${block.protocol}|${block.action}|${block.verdict}|${JSON.stringify(block.payload)}|${block.previousHash}`;
    return crypto.createHash('sha256').update(dataString).digest('hex');
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  /**
   * Appends an immutable audit event to the chain
   */
  logEvent({ agentId, protocol, action, verdict, explanation, payload = {} }) {
    const latestBlock = this.getLatestBlock();
    const newBlock = {
      index: this.chain.length,
      timestamp: Date.now(),
      agentId: agentId || "UNKNOWN_AGENT",
      protocol: protocol || "DIRECT",
      action: action || "TRANSACTION",
      verdict: verdict || "ALLOWED", // 'ALLOWED' | 'BLOCKED' | 'CIRCUIT_TRIPPED' | 'MANUAL_OVERRIDE'
      explanation: explanation || "Action logged",
      payload,
      previousHash: latestBlock.hash,
      hash: ""
    };

    newBlock.hash = this.calculateHash(newBlock);
    this.chain.push(newBlock);

    // Broadcast to WebSocket / SSE listeners
    this.broadcast(newBlock);

    return newBlock;
  }

  /**
   * Verifies the cryptographic integrity of the entire chain
   * @returns {{ valid: boolean, brokenIndex: number|null, message: string }}
   */
  verifyChainIntegrity() {
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const previousBlock = this.chain[i - 1];

      // Verify current block's hash
      if (currentBlock.hash !== this.calculateHash(currentBlock)) {
        return {
          valid: false,
          brokenIndex: i,
          message: `Block #${i} data has been modified or corrupted!`
        };
      }

      // Verify link to previous hash
      if (currentBlock.previousHash !== previousBlock.hash) {
        return {
          valid: false,
          brokenIndex: i,
          message: `Block #${i} previousHash link broken! Expected ${previousBlock.hash.substring(0, 10)}... got ${currentBlock.previousHash.substring(0, 10)}...`
        };
      }
    }
    return {
      valid: true,
      brokenIndex: null,
      message: `Audit chain verified: ${this.chain.length} blocks perfectly linked with SHA-256 integrity.`
    };
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  broadcast(block) {
    for (const listener of this.listeners) {
      try {
        listener(block);
      } catch (err) {
        console.error("Error broadcasting to audit listener:", err);
      }
    }
  }

  getChain(limit = 100) {
    return this.chain.slice(-limit);
  }
}

module.exports = new AuditLedger();
