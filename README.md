# Agent Commerce Gateway (ACG)
### Razorpay AI Buildathon 2026 — Track 01: AI Growth & Agentic Commerce

[![Node.js](https://img.shields.io/badge/Node.js-24.x-green.svg)](https://nodejs.org)
[![Protocols](https://img.shields.io/badge/Protocols-ACP%20|%20AP2%20|%20x402-blue.svg)](#protocol-adapter-layer)
[![Security](https://img.shields.io/badge/Security-HMAC--SHA256%20Mandates-purple.svg)](#cryptographic-mandate-authority)
[![Audit](https://img.shields.io/badge/Audit-SHA--256%20Hash--Chained-orange.svg)](#hash-chained-audit-ledger)
[![Settlement](https://img.shields.io/badge/Settlement-Razorpay%20Test%20Mode-00d2ff.svg)](#settlement-rails)

---

## 🎯 The Core Problem: 2026 Agent-Payment Fragmentation

By 2026, the agentic commerce landscape fragmented into non-interoperable agent payment standards:
- **OpenAI / Stripe ACP**: Cart session and order handoff flow.
- **Google AP2**: Cryptographically signed Intent/Cart/Payment mandates.
- **Coinbase x402**: HTTP 402 machine-to-machine micropayment protocols.

No merchant can integrate all emerging agent protocols individually. **Agent Commerce Gateway (ACG)** solves this at the merchant's edge by acting as a universal protocol adapter that accepts any agent dialect, verifies cryptographically signed spending mandates, logs actions to an immutable hash-chained audit ledger, and enforces circuit-breaker safety with Human-In-The-Loop (HITL) approval.

---

## 🏛️ Architecture & System Design

```
+---------------------------------------------------------------------------------+
|                        Autonomous AI Buyer Agent Layer                          |
|  - Cautious Claire (ACP Dialect)  - Hank Hunter (AP2 Mandate) - Rogue Robin (HITL) |
+----------------------------------------+----------------------------------------+
                                         |
                       [Tool Calls / Discovery / Payloads]
                                         v
+---------------------------------------------------------------------------------+
|                    Agent Commerce Gateway (Merchant Edge)                      |
|                                                                                 |
|  +---------------------+  +----------------------+  +------------------------+  |
|  |   ACP Adapter       |  |     AP2 Adapter      |  |     x402 Adapter       |  |
|  | (Cart / Intent API) |  | (Signed Mandate API) |  | (HTTP 402 Micropay)    |  |
|  +----------+----------+  +----------+-----------+  +-----------+------------+  |
|             \                        |                         /                |
|              +-----------------------+------------------------+                 |
|                                      |                                          |
|  +-----------------------------------+---------------------------------------+  |
|  |                     Gateway Core Security & Growth                       |  |
|  |  [Cryptographic Mandate Authority]    [Circuit Breaker / Anomaly Guard]   |  |
|  |  [Dynamic Headroom Upsell Engine]     [SHA-256 Hash-Chained Audit Ledger] |  |
|  +-----------------------------------+---------------------------------------+  |
+--------------------------------------|------------------------------------------+
                                       |
             +-------------------------+-------------------------+
             |                                                   |
             v                                                   v
+-----------------------------+             +------------------------------------+
|  Agent-Readable MCP Catalog |             |  Razorpay Test Mode Payment Rails  |
|  - Semantic Search Tools    |             |  - Order Generation & Signatures   |
|  - JSON Manifests           |             |  - Captures & Settlement           |
+-----------------------------+             +------------------------------------+
```

---

## ✨ Key Capabilities & Track 01 Highlights

| Feature | Description | Track 01 Alignment |
| :--- | :--- | :--- |
| **Dual-Protocol Adapter** | Serves both OpenAI/Stripe ACP and Google AP2 dialects against the same merchant backend. | Solves real-world protocol fragmentation. |
| **Signed Spending Mandates** | Scoped authorization tokens (spending cap, category whitelist, expiry) signed with cryptographic signatures. | **Bounded & Gated**: Zero-trust money actions. |
| **Hash-Chained Audit Ledger** | SHA-256 block-linked tamper-evident ledger with natural language explainability. | **Visible Audit Trail**: Every action explainable. |
| **Circuit Breaker & HITL** | Detects velocity spikes & cap overruns, pausing actions for human approval. | **One Failure Handled Gracefully**: Safe recovery. |
| **Growth & Upsell Engine** | Inspects mandate budget headroom to offer high-margin complementary add-ons. | **Merchant Growth**: Directly maximizes cart size. |
| **Autonomous AI Buyer** | Multi-persona autonomous agent that shops, negotiates, and checks out live. | **End-to-End Demo**: Fully visible real-time execution. |

---

## 🚀 Quickstart Guide

### Prerequisites
- Node.js 18+ (tested on Node.js 24)
- npm

### 1. Installation
```bash
git clone https://github.com/faraaz-748-019/Razorpay.git
cd Razorpay
npm install
```

### 2. Environment Setup (Optional)
To use live Razorpay test credentials, copy the example template:
```bash
cp .env.example .env
```
And populate your Razorpay test mode keys:
```env
PORT=3000
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_test_secret
```
*(If omitted, ACG runs with high-fidelity embedded Razorpay test mode rails out of the box).*

### 3. Run Automated Test Suite
```bash
npm test
```

### 4. Start Gateway & Live Command Center
```bash
npm start
```
- **Landing Page**: [http://localhost:3000](http://localhost:3000)
- **Live Operations Console**: [http://localhost:3000/console](http://localhost:3000/console)

---

## 🎬 How to Demo in Under 5 Minutes

1. **Test ACP Flow (Cautious Claire)**:
   - Select *Claire (Cautious Budget-Shopper)*.
   - Click **Launch Autonomous Agent Checkout**.
   - Watch the agent request a signed mandate, search products, accept a headroom upsell from the Growth Engine, and settle on Razorpay.
2. **Test AP2 Flow (Hank Hunter)**:
   - Select *Hank (Deal-Hunter)*.
   - Click **Launch Autonomous Agent Checkout**.
   - Watch the atomic Google AP2 signed mandate verification and instant settlement.
3. **Trigger Circuit Breaker & Human-In-The-Loop**:
   - Click **Simulate Cap Breach Anomaly** (or select *Robin Adversarial*).
   - Watch the gateway intercept the cap breach, pause execution, and trip the Circuit Breaker.
   - Switch to the **Circuit Breaker & HITL** tab, review the plain-language risk report, and click **Approve Override** or **Deny**.
4. **Audit Trail Verification**:
   - Go to the **Audit Chain Ledger** tab and click **Verify SHA-256 Hashes** to prove cryptographic block integrity.

---

## 📁 Repository Structure

```
Razorpay/
├── .env.example              # Environment variables template
├── .gitignore                # Git exclusions (node_modules, logs, secrets)
├── package.json              # Project dependencies and test scripts
├── ARCHITECTURE.md           # Deep architectural analysis of ACG & Track 01 alignment
├── public/
│   ├── landing.html          # High-Impact Hero Landing Page for Judges & Merchants
│   ├── index.html            # Glassmorphic Operations & Simulation Dashboard
│   ├── css/styles.css        # Modern design system & animated glow effects
│   └── js/app.js             # Real-time WebSocket client & controller
├── src/
│   ├── server.js             # Express & WebSocket Gateway Server
│   ├── core/
│   │   ├── mandates.js       # Cryptographic Mandate Authority & Signing
│   │   ├── auditLedger.js    # SHA-256 Hash-Chained Audit Ledger
│   │   ├── circuitBreaker.js # Anomaly Detector & HITL Review Gateway
│   │   ├── catalog.js        # Merchant Catalog & Growth Upsell Engine
│   │   └── razorpayAdapter.js# Razorpay Test Mode Payment Rails
│   ├── adapters/
│   │   ├── acpAdapter.js     # OpenAI/Stripe ACP Protocol Handler
│   │   ├── ap2Adapter.js     # Google AP2 Protocol Handler
│   │   └── x402Adapter.js    # Coinbase x402 Micropayment Handler
│   └── agents/
│       └── buyerAgent.js     # Autonomous Buyer Agent Runtime
└── test/
    └── test-suite.js         # End-to-end integration & unit test suite
```

---

## 📜 License
MIT © 2026 Agent Commerce Gateway Team
