# 5-Minute Pitch Video Script: Agent Commerce Gateway (ACG)
**Track:** Razorpay AI Buildathon 2026 — Track 01 (AI Growth & Agentic Commerce)

---

## Video Timeline & Stage Directions

### [0:00 - 0:45] The Problem: The Great Agent Protocol Fragmentation
**Screen:** Show slide / dashboard showing the multiple protocol tags: *OpenAI/Stripe ACP, Google AP2, Coinbase x402*.  
**Voiceover:**
> "By 2026, AI shopping agents are everywhere — but the agent payment space has fractured into non-interoperable protocols. OpenAI and Stripe use ACP session carts. Google uses AP2 cryptographic mandates. Coinbase uses x402 micropayments. 
> No merchant can realistically integrate all six. That fragmentation — not just 'can an agent buy something' — is the real unsolved bottleneck. 
> Welcome to **Agent Commerce Gateway (ACG)**: a merchant-side layer on Razorpay test-mode APIs that accepts any agent protocol dialect, verifies signed spending mandates, protects against rogue agent loops with a circuit breaker, and drives revenue growth through dynamic mandate upsells."

---

### [0:45 - 1:45] Demo 1: Autonomous ACP Flow + Growth Engine Upsell
**Screen:** Switch to the ACG Live Dashboard. Select **Claire (Cautious Budget-Shopper)**. Set budget to ₹1,500. Click **Launch Autonomous Agent Checkout**.  
**Voiceover:**
> "Let's watch an autonomous buyer agent shop in real time. Claire is using the OpenAI/Stripe ACP dialect.
> First, she obtains a scoped, cryptographically signed mandate for ₹1,500. 
> Next, she calls our MCP-compliant catalog tool, discovers our Aura ANC Earbuds for ₹1,299, and initializes an ACP cart.
> Now look at the merchant Growth Engine: the gateway spots ₹201 in mandate headroom and presents a complementary cable. Claire's reasoning engine accepts the upsell, bringing the cart to ₹1,498 — growing merchant revenue while staying strictly within budget!
> The gateway verifies the mandate and settles the transaction on Razorpay test rails with a verified order ID and cryptographic signature."

---

### [1:45 - 2:45] Demo 2: Google AP2 Atomic Mandate Execution
**Screen:** Select **Hank (Deal-Hunter)**. Goal: "Acquire top hardcover engineering book". Click **Launch Autonomous Agent Checkout**.  
**Voiceover:**
> "Now, without changing a single line of backend merchant code, let's switch to Hank, who speaks the Google AP2 dialect.
> Hank constructs an atomic AP2 signed mandate containing his intent and public key signature. 
> The gateway performs pre-flight verification, verifies the HMAC-SHA256 signature, and atomically settles the order via Razorpay in milliseconds.
> One single Razorpay merchant backend — seamlessly serving two radically different agent protocols."

---

### [2:45 - 3:45] Demo 3: Circuit Breaker & Human-In-The-Loop (The Graceful Failure)
**Screen:** Click **Simulate Cap Breach Anomaly** (or Robin Rogue Persona). Watch the terminal pause and display *[CIRCUIT BREAKER ACTIVATED]*. Switch to the **Circuit Breaker & HITL** tab.  
**Voiceover:**
> "Track 01 requires that every money action is bounded and gated, with one failure handled gracefully.
> Here, Robin tries an adversarial exploit: attempting to purchase a ₹2,499 smartwatch with only a ₹1,000 mandate for books.
> Instead of crashing or allowing unauthorized money movement, our zero-trust Circuit Breaker immediately intercepts the cap breach and pauses execution.
> In the merchant dashboard, the operator receives a plain-language explanation of the anomaly. The operator can click 'Approve Override' or 'Deny & Terminate'. Let's approve the override — the transaction securely completes with a full audit log."

---

### [3:45 - 4:30] Demo 4: Hash-Chained Audit Ledger & Verification
**Screen:** Switch to **Audit Chain Ledger** tab. Click **Verify SHA-256 Hashes**. Inspect a block to show plain-language explainability.  
**Voiceover:**
> "Every single action — from catalog tool queries to upsells and payments — is immutably recorded in a SHA-256 hash-chained ledger. 
> Notice that every record includes plain-language justifications explaining *why* an action was allowed or blocked.
> Clicking 'Verify SHA-256 Hashes' proves that no past record has been modified or tampered with."

---

### [4:30 - 5:00] Summary & The Future of Agentic Commerce
**Screen:** Return to the full dashboard overview with live metrics pulsing green.  
**Voiceover:**
> "Agent Commerce Gateway solves the 2026 protocol fragmentation problem at the merchant's edge. It makes any Razorpay merchant instantly transactable by AI shopping agents with bounded security, explainable auditability, human-in-the-loop safety, and built-in growth engines.
> Thank you!"
