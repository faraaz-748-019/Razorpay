/**
 * Agent Commerce Gateway (ACG) - Main Express & WebSocket Server
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');

const catalog = require('./core/catalog');
const mandates = require('./core/mandates');
const auditLedger = require('./core/auditLedger');
const circuitBreaker = require('./core/circuitBreaker');
const razorpayAdapter = require('./core/razorpayAdapter');
const buyerAgent = require('./agents/buyerAgent');

const acpRouter = require('./adapters/acpAdapter');
const ap2Router = require('./adapters/ap2Adapter');
const x402Router = require('./adapters/x402Adapter');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Root route: Serve Landing Page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/landing.html'));
});

// Console route: Serve Live Simulation & Operations Command Studio
app.get('/console', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Mount Protocol Adapters
app.use('/api/protocols/acp', acpRouter);
app.use('/api/protocols/ap2', ap2Router);
app.use('/api/protocols/x402', x402Router);

// Standard Agent Discovery Manifest (MCP / Agent standard)
app.get('/.well-known/agent-commerce.json', (req, res) => {
  res.json({
    gateway: "Agent Commerce Gateway (ACG)",
    version: "2026.1",
    protocolsSupported: ["ACP/1.0", "AP2/2.0-GoogleSpec", "x402/1.0"],
    settlementRail: "Razorpay Test Mode",
    toolsManifestUri: "/api/tools/manifest",
    catalogManifestUri: "/api/catalog/manifest",
    mandateVerificationUri: "/api/mandates/verify",
    auditLedgerUri: "/api/audit/chain"
  });
});

app.get('/api/tools/manifest', (req, res) => {
  res.json(catalog.getDynamicCatalogManifest());
});

app.get('/api/catalog/manifest', (req, res) => {
  res.json(catalog.getDynamicCatalogManifest());
});

// Merchant Catalog API
app.get('/api/products', (req, res) => {
  const { query, category, maxPrice } = req.query;
  const results = catalog.searchProducts(query, category, maxPrice ? Number(maxPrice) : null);
  res.json(results);
});

app.post('/api/products', (req, res) => {
  const { name, category, priceRupees, description, tags } = req.body;
  if (!name || !category || !priceRupees) {
    return res.status(400).json({ error: 'name, category, and priceRupees are required' });
  }
  const product = catalog.addProduct({ name, category, priceRupees, description, tags });

  auditLedger.logEvent({
    agentId: 'MERCHANT_ADMIN',
    protocol: 'SYSTEM',
    action: 'CATALOG_PRODUCT_ADDED',
    verdict: 'ALLOWED',
    explanation: `Merchant added new SKU '${product.name}' (₹${product.priceRupees}). Auto-updated agent discovery catalog manifest.`,
    payload: { product }
  });

  broadcastWs({ type: 'CATALOG_UPDATED', product });
  res.status(201).json({ success: true, product });
});

// Mandate Issuance & Verification APIs
app.post('/api/mandates/issue', (req, res) => {
  const { agentId, agentName, spendingCapInPaisa, allowedCategories, expiryMinutes } = req.body;
  if (!agentId || !spendingCapInPaisa) {
    return res.status(400).json({ error: 'agentId and spendingCapInPaisa are required' });
  }
  const mandate = mandates.issueMandate({
    agentId,
    agentName,
    spendingCapInPaisa,
    allowedCategories: allowedCategories || ['*'],
    expiryMinutes: expiryMinutes || 60
  });
  res.json(mandate);
});

app.post('/api/mandates/verify', (req, res) => {
  const { mandate, amountInPaisa, category } = req.body;
  const result = mandates.verifyMandate(mandate, amountInPaisa, category);
  res.json(result);
});

// Audit Chain & Integrity APIs
app.get('/api/audit/chain', (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : 100;
  res.json(auditLedger.getChain(limit));
});

app.get('/api/audit/verify', (req, res) => {
  const report = auditLedger.verifyChainIntegrity();
  res.json(report);
});

// Circuit Breaker & HITL APIs
app.get('/api/circuit-breaker/reviews', (req, res) => {
  res.json(circuitBreaker.getPendingReviews());
});

app.post('/api/circuit-breaker/reviews/:id/resolve', (req, res) => {
  const { id } = req.params;
  const { decision, operator } = req.body; // 'APPROVE' | 'REJECT'
  const outcome = circuitBreaker.resolveReview(id, decision, operator || 'Merchant Operator');
  if (!outcome.success) {
    return res.status(404).json(outcome);
  }
  res.json(outcome);
});

// Autonomous Buyer Agent Simulation Runner
app.post('/api/agent/simulate', async (req, res) => {
  const { persona, budgetRupees, goal } = req.body;
  try {
    const result = await buyerAgent.runSimulation({
      persona,
      budgetRupees: Number(budgetRupees) || 1500,
      goal: goal || 'Autonomous purchase on ACG',
      onStep: (step) => {
        broadcastWs({ type: 'SIMULATION_STEP', step });
      }
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// WebSocket Real-time Broadcasting
function broadcastWs(data) {
  const payload = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === 1) { // OPEN
      client.send(payload);
    }
  });
}

// Hook core events to WebSocket
auditLedger.subscribe((newBlock) => {
  broadcastWs({ type: 'NEW_AUDIT_BLOCK', block: newBlock });
});

circuitBreaker.subscribe((event) => {
  broadcastWs({ type: 'CIRCUIT_BREAKER_EVENT', event });
});

wss.on('connection', (ws) => {
  // Send initial state
  ws.send(JSON.stringify({
    type: 'INIT_STATE',
    chainLength: auditLedger.getChain().length,
    pendingReviews: circuitBreaker.getPendingReviews(),
    productsCount: catalog.getAllProducts().length
  }));
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Agent Commerce Gateway (ACG) running on http://localhost:${PORT}`);
  console.log(`✨ Landing Page: http://localhost:${PORT}/`);
  console.log(`🎛️  Command Console: http://localhost:${PORT}/console`);
  console.log(`💳 Settlement: Razorpay Test Mode Rails`);
  console.log(`🔗 Supported Protocols: ACP/1.0, AP2/2.0-GoogleSpec, x402/1.0`);
  console.log(`🛡️  Cryptographic Mandates & SHA-256 Audit Chain Active`);
  console.log(`=======================================================`);
});
