/**
 * Agent Commerce Gateway (ACG) - Frontend Controller & Real-Time WebSocket Client
 */

let socket = null;
let chainData = [];
let pendingReviewsData = [];

// DOM Elements
const personaSelect = document.getElementById('personaSelect');
const budgetInput = document.getElementById('budgetInput');
const goalInput = document.getElementById('goalInput');
const runSimBtn = document.getElementById('runSimBtn');
const quickTestBreakerBtn = document.getElementById('quickTestBreakerBtn');
const agentLogsTerminal = document.getElementById('agentLogsTerminal');
const activeProtocolBadge = document.getElementById('activeProtocolBadge');

const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

const auditChainContainer = document.getElementById('auditChainContainer');
const chainCountBadge = document.getElementById('chainCountBadge');
const reviewCountBadge = document.getElementById('reviewCountBadge');
const auditFilterProtocol = document.getElementById('auditFilterProtocol');
const verifyChainBtn = document.getElementById('verifyChainBtn');
const headerChainStatus = document.getElementById('headerChainStatus');

const pendingReviewsContainer = document.getElementById('pendingReviewsContainer');
const mcpManifestViewer = document.getElementById('mcpManifestViewer');
const catalogGrid = document.getElementById('catalogGrid');
const addProductForm = document.getElementById('addProductForm');

const blockModal = document.getElementById('blockModal');
const modalBlockTitle = document.getElementById('modalBlockTitle');
const modalBlockContent = document.getElementById('modalBlockContent');
const closeModalBtn = document.getElementById('closeModalBtn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initWebSocket();
  fetchInitialData();
  initEventListeners();
});

function initTabs() {
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      const targetEl = document.getElementById(targetId);
      if (targetEl) targetEl.classList.add('active');
    });
  });
}

function initEventListeners() {
  runSimBtn.addEventListener('click', runAgentSimulation);
  quickTestBreakerBtn.addEventListener('click', triggerQuickBreakerTest);
  verifyChainBtn.addEventListener('click', verifyLedgerChain);
  auditFilterProtocol.addEventListener('change', renderAuditChain);

  if (addProductForm) {
    addProductForm.addEventListener('submit', handleAddProductSubmit);
  }

  closeModalBtn.addEventListener('click', () => {
    blockModal.style.display = 'none';
  });

  personaSelect.addEventListener('change', () => {
    const p = personaSelect.value;
    if (p === 'budget_cautious_acp') {
      activeProtocolBadge.textContent = 'Dialect: OpenAI / Stripe ACP';
      goalInput.value = 'Buy a high-rated tech or audio gift under budget';
      budgetInput.value = '1500';
    } else if (p === 'deal_hunter_ap2') {
      activeProtocolBadge.textContent = 'Dialect: Google AP2 Signed Mandate';
      goalInput.value = 'Acquire top hardcover engineering book with signed mandate';
      budgetInput.value = '1000';
    } else if (p === 'rogue_anomaly_breaker') {
      activeProtocolBadge.textContent = 'Adversarial: Bounds Breaker';
      goalInput.value = 'Attempt to purchase ₹2,499 Smartwatch on ₹1,000 budget';
      budgetInput.value = '1000';
    }
  });
}

// WebSocket Setup
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  socket = new WebSocket(`${protocol}//${window.location.host}`);

  socket.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      handleWsMessage(msg);
    } catch (e) {
      console.error('WS Parse error', e);
    }
  };

  socket.onclose = () => {
    setTimeout(initWebSocket, 3000);
  };
}

function handleWsMessage(msg) {
  if (msg.type === 'SIMULATION_STEP') {
    renderTerminalStep(msg.step);
  } else if (msg.type === 'NEW_AUDIT_BLOCK') {
    chainData.push(msg.block);
    updateChainStats();
    renderAuditChain();
  } else if (msg.type === 'CIRCUIT_BREAKER_EVENT') {
    fetchPendingReviews();
  } else if (msg.type === 'CATALOG_UPDATED') {
    fetchInitialData();
  }
}

// Terminal Rendering
function renderTerminalStep(step) {
  const line = document.createElement('div');
  line.className = 'terminal-line';

  let timeStr = new Date(step.timestamp).toISOString().substring(14, 23);
  let statusClass = '';

  if (step.stepName.includes('SUCCESS') || step.stepName.includes('COMPLETE') || step.stepName.includes('ACCEPTED')) {
    statusClass = 'success-line';
  } else if (step.stepName.includes('TRIPPED') || step.stepName.includes('ANOMALY') || step.stepName.includes('BREAKER')) {
    statusClass = 'warning-line';
  } else if (step.stepName.includes('REJECTED') || step.stepName.includes('BLOCKED')) {
    statusClass = 'danger-line';
  }

  line.innerHTML = `<span class="system-line">[${timeStr}]</span> <span class="step-tag">${step.stepName}</span> <span class="${statusClass}">${escapeHtml(step.message)}</span>`;
  agentLogsTerminal.appendChild(line);
  agentLogsTerminal.scrollTop = agentLogsTerminal.scrollHeight;
}

function clearTerminal() {
  agentLogsTerminal.innerHTML = '';
}

// REST Calls
async function fetchInitialData() {
  try {
    // 1. Fetch Audit Chain
    const chainRes = await fetch('/api/audit/chain');
    chainData = await chainRes.json();
    updateChainStats();
    renderAuditChain();

    // 2. Fetch Pending Reviews
    await fetchPendingReviews();

    // 3. Fetch Dynamic MCP Manifest
    const manifestRes = await fetch('/api/catalog/manifest');
    const manifest = await manifestRes.json();
    mcpManifestViewer.textContent = JSON.stringify(manifest, null, 2);

    // 4. Fetch Products Catalog
    const prodRes = await fetch('/api/products');
    const products = await prodRes.json();
    renderCatalog(products);

  } catch (err) {
    console.error('Failed to fetch initial gateway data', err);
  }
}

async function fetchPendingReviews() {
  try {
    const res = await fetch('/api/circuit-breaker/reviews');
    pendingReviewsData = await res.json();
    renderPendingReviews();
  } catch (err) {
    console.error('Failed fetching circuit reviews', err);
  }
}

// Render Audit Ledger Chain
function renderAuditChain() {
  const filter = auditFilterProtocol.value;
  auditChainContainer.innerHTML = '';

  const filtered = chainData.filter(b => {
    if (filter === 'ALL') return true;
    return b.protocol === filter;
  }).slice().reverse();

  filtered.forEach(block => {
    const el = document.createElement('div');
    el.className = `audit-block verdict-${block.verdict}`;
    el.innerHTML = `
      <div class="block-top">
        <span class="block-index">#${block.index} [${block.protocol}] ${block.action}</span>
        <span class="block-verdict verdict-tag-${block.verdict}">${block.verdict}</span>
      </div>
      <div class="block-explanation">${escapeHtml(block.explanation)}</div>
      <div class="block-hashes">
        <span>Prev: ${block.previousHash.substring(0, 12)}...</span>
        <span>Hash: ${block.hash.substring(0, 12)}...</span>
        <span>Agent: ${block.agentId}</span>
      </div>
    `;

    el.addEventListener('click', () => {
      inspectBlock(block);
    });

    auditChainContainer.appendChild(el);
  });
}

function updateChainStats() {
  chainCountBadge.textContent = chainData.length;
}

function inspectBlock(block) {
  modalBlockTitle.textContent = `Audit Block #${block.index} [${block.action}]`;
  modalBlockContent.textContent = JSON.stringify(block, null, 2);
  blockModal.style.display = 'flex';
}

// Verify Chain Integrity
async function verifyLedgerChain() {
  verifyChainBtn.textContent = 'Verifying...';
  try {
    const res = await fetch('/api/audit/verify');
    const report = await res.json();
    if (report.valid) {
      headerChainStatus.textContent = 'SHA-256 Validated (100% Intact)';
      headerChainStatus.className = 'metric-val text-success';
      alert(`🛡️ Cryptographic Integrity Confirmed!\n\n${report.message}`);
    } else {
      headerChainStatus.textContent = 'Chain Broken!';
      headerChainStatus.className = 'metric-val text-danger';
      alert(`⚠️ Tampering Alert!\n\n${report.message}`);
    }
  } catch (e) {
    alert('Verification error: ' + e.message);
  } finally {
    verifyChainBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Verify SHA-256 Hashes`;
  }
}

// Render Pending Reviews for Human-In-The-Loop
function renderPendingReviews() {
  reviewCountBadge.textContent = pendingReviewsData.length;
  pendingReviewsContainer.innerHTML = '';

  if (pendingReviewsData.length === 0) {
    pendingReviewsContainer.innerHTML = `
      <div class="empty-state">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        <p>Circuit breaker is peaceful. No anomalous actions currently suspended.</p>
        <span class="subtext">Run the "Rogue Anomaly Breaker" simulation to test live HITL pause and override.</span>
      </div>
    `;
    return;
  }

  pendingReviewsData.forEach(rev => {
    const card = document.createElement('div');
    card.className = 'review-card';
    card.innerHTML = `
      <div class="review-card-header">
        <strong>⚠️ ${rev.type} Intercepted</strong>
        <span class="tag-meta">Agent: ${rev.agentId} · ${rev.protocol}</span>
      </div>
      <div class="review-reason">${escapeHtml(rev.reason)}</div>
      <div class="review-actions">
        <button class="btn btn-approve" onclick="resolveReview('${rev.id}', 'APPROVE')">
          ✓ Approve Override (Authorize ₹${rev.amountRupees})
        </button>
        <button class="btn btn-reject" onclick="resolveReview('${rev.id}', 'REJECT')">
          ✕ Deny & Terminate Action
        </button>
      </div>
    `;
    pendingReviewsContainer.appendChild(card);
  });
}

// Human Operator Action
window.resolveReview = async function(reviewId, decision) {
  try {
    const res = await fetch(`/api/circuit-breaker/reviews/${reviewId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, operator: 'Buildathon Judge / Admin' })
    });
    const result = await res.json();
    if (result.success) {
      await fetchPendingReviews();
      const tabAuditBtn = document.querySelector('[data-tab="tabAudit"]');
      if (tabAuditBtn) tabAuditBtn.click();
    }
  } catch (err) {
    alert('Failed to resolve review: ' + err.message);
  }
};

// Handle New SKU Submission (Stretch Innovation: Auto-Generated Manifest)
async function handleAddProductSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('newProdName').value.trim();
  const category = document.getElementById('newProdCat').value;
  const priceRupees = Number(document.getElementById('newProdPrice').value);
  const description = document.getElementById('newProdDesc').value.trim();

  try {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, category, priceRupees, description, tags: [category, 'new-arrival'] })
    });
    const data = await res.json();
    if (data.success) {
      addProductForm.reset();
      await fetchInitialData();
      alert(`✨ Added SKU '${data.product.name}'. The agent-readable MCP manifest has been auto-regenerated!`);
    }
  } catch (err) {
    alert('Failed to add product: ' + err.message);
  }
}

// Render Products
function renderCatalog(products) {
  catalogGrid.innerHTML = '';
  products.forEach(p => {
    const card = document.createElement('div');
    card.className = 'catalog-item-card';
    card.innerHTML = `
      <div class="catalog-item-header">
        <span class="catalog-item-title">${escapeHtml(p.name)}</span>
        <span class="catalog-item-price">₹${p.priceRupees}</span>
      </div>
      <p class="catalog-item-desc">${escapeHtml(p.description)}</p>
      <div class="catalog-item-meta">
        <span class="tag-meta">Category: ${p.category}</span>
        <span class="tag-meta">Rating: ${p.rating}⭐</span>
        <span class="tag-meta">ID: ${p.id}</span>
      </div>
    `;
    catalogGrid.appendChild(card);
  });
}

// Run Autonomous Agent Simulation
async function runAgentSimulation() {
  clearTerminal();
  runSimBtn.disabled = true;
  runSimBtn.innerHTML = 'Autonomous Agent Running...';

  const persona = personaSelect.value;
  const budget = budgetInput.value;
  const goal = goalInput.value;

  try {
    const res = await fetch('/api/agent/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ persona, budgetRupees: budget, goal })
    });
    const data = await res.json();
    console.log('Simulation finished', data);

    if (data.executionResult && data.executionResult.circuitTripped) {
      // Auto-switch to circuit breaker tab so judge can see HITL action
      setTimeout(() => {
        const breakerTabBtn = document.querySelector('[data-tab="tabCircuit"]');
        if (breakerTabBtn) breakerTabBtn.click();
      }, 1000);
    }
  } catch (err) {
    renderTerminalStep({ stepName: 'ERROR', message: err.message, timestamp: Date.now() });
  } finally {
    runSimBtn.disabled = false;
    runSimBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      Launch Autonomous Agent Checkout
    `;
  }
}

function triggerQuickBreakerTest() {
  personaSelect.value = 'rogue_anomaly_breaker';
  personaSelect.dispatchEvent(new Event('change'));
  runAgentSimulation();
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
