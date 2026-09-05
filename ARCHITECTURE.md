# Architectural Deep-Dive: Agent Commerce Gateway (ACG)

## 1. The Protocol Fragmentation Crisis of 2026

The emergence of autonomous AI agents transformed e-commerce from human click-streams into machine-directed transactions. However, this transformation fractured the ecosystem into non-interoperable agent payment standards:

1. **OpenAI / Stripe ACP (Agentic Commerce Protocol)**:
   - Centered around session-based carts, line-item construction, and checkout handoff tokens.
   - Requires stateful roundtrips between agent and merchant cart endpoints.
2. **Google AP2 (Agent Payment Protocol 2.0)**:
   - Centered around cryptographically signed **mandates** and atomic intent execution.
   - Agents submit self-contained signed authorization objects directly to payment endpoints.
3. **Coinbase x402 / Machine Micropayments**:
   - HTTP 402 Payment Required status codes for granular, pay-per-call machine queries and data feeds.

Merchants cannot afford the maintenance overhead or security liability of integrating six different SDKs. **Agent Commerce Gateway (ACG)** solves this at the merchant's edge.

---

## 2. Gateway Core Pillars

### A. Dual-Protocol Adapter Layer
The ACG edge server intercepts requests from diverse agent runtimes and translates them into a unified internal checkout representation before dispatching to Razorpay test-mode rails:
- **`acpAdapter.js`**: Handles session instantiation (`/api/protocols/acp/cart`), item addition, and cart checkout handoffs.
- **`ap2Adapter.js`**: Handles pre-flight cryptographic verification (`/api/protocols/ap2/intent/preflight`) and atomic mandate executions (`/api/protocols/ap2/mandate/execute`).
- **`x402Adapter.js`**: Provides HTTP 402 challenges and micro-voucher settlements for premium catalog data.

### B. Cryptographic Mandate Authority (Zero-Trust Security)
Every financial action must be **bounded, scoped, and signed**:
- **Spending Cap**: Absolute maximum in paisa (e.g. `spendingCapInPaisa: 150000`).
- **Category Whitelist**: Restricts spending to allowed domains (e.g. `['electronics', 'accessories']`).
- **Time-To-Live (TTL)**: Unix timestamp expiry after which the mandate is void.
- **HMAC-SHA256 / Ed25519 Signature**: Deterministic signature verified before touching Razorpay rails.

### C. Hash-Chained Audit Ledger
Financial auditability requires that no record can be retroactively modified or deleted:
- Each audit block contains:
  $$\text{Hash}_n = \text{SHA256}(\text{Index} \parallel \text{Timestamp} \parallel \text{AgentId} \parallel \text{Protocol} \parallel \text{Action} \parallel \text{Verdict} \parallel \text{Payload} \parallel \text{Hash}_{n-1})$$
- Plain-language explainability accompanies every verdict (e.g. *"APPROVED: Cart total ₹1,299 within ₹1,500 mandate limit"* or *"BLOCKED: Item ₹2,499 exceeds mandate cap"*).
- The `/api/audit/verify` endpoint allows merchants and regulators to cryptographically verify ledger integrity on demand.

### D. Circuit Breaker & Human-In-The-Loop (HITL)
To fulfill the requirement that **every failure is handled gracefully**:
- High velocity anomalies (>8 calls/min) or mandate boundary violations trigger an instantaneous transition to `PENDING_HUMAN_APPROVAL`.
- The agent execution loop pauses without crashing.
- A human operator can review the plain-language justification and click **Approve Override** or **Deny & Terminate** via the dashboard or REST API.

### E. Growth Engine: Mandate Headroom Upsell Hook
To drive merchant revenue growth (Track 01):
- The gateway calculates unspent mandate capacity:
  $$\text{Headroom} = \text{MandateCap} - \text{CartSubtotal}$$
- Recommends paired, high-margin items fitting strictly within the remaining budget.
- Agents evaluate recommendations in real time, increasing merchant average order value (AOV) without exceeding user-approved constraints.

---

## 3. Threat Model & Mitigations

| Threat | Attack Vector | ACG Mitigation |
| :--- | :--- | :--- |
| **Mandate Forgery / Tampering** | Agent modifies spending cap from ₹1,000 to ₹10,000 in transit. | Cryptographic signature validation fails; transaction blocked. |
| **Runaway Agent Loop** | Malfunctioning agent hammers purchase endpoint repeatedly. | Circuit breaker velocity detector trips at >8 req/min; execution suspended. |
| **Category Bypass** | Agent authorized for 'books' attempts to purchase 'electronics'. | Whitelist validator rejects item; logged to audit chain. |
| **Post-Facto Log Alteration** | Rogue insider alters transaction record in DB. | SHA-256 hash-chain verification detects broken link immediately. |
