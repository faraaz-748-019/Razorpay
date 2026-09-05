/**
 * Merchant Product Catalog & Dynamic Agent Growth Upsell Hook
 */
const PRODUCTS = [
  {
    id: "prod_elec_01",
    name: "Aura ANC Noise-Cancelling Earbuds",
    category: "electronics",
    priceInPaisa: 129900, // ₹1,299.00
    priceRupees: 1299,
    description: "Compact wireless earbuds with active noise cancellation, 32-hour battery, and fast USB-C charge.",
    tags: ["audio", "bluetooth", "wireless", "earbuds", "gadget"],
    inStock: true,
    rating: 4.8,
    upsellPairWith: ["prod_acc_01", "prod_acc_02"]
  },
  {
    id: "prod_elec_02",
    name: "NovaPulse Pro Smartwatch 2",
    category: "electronics",
    priceInPaisa: 249900, // ₹2,499.00
    priceRupees: 2499,
    description: "AMOLED fitness smartwatch with continuous SpO2, heart-rate tracking, and 7-day battery life.",
    tags: ["smartwatch", "fitness", "wearable", "health"],
    inStock: true,
    rating: 4.6,
    upsellPairWith: ["prod_acc_01"]
  },
  {
    id: "prod_book_01",
    name: "Designing Autonomous AI Systems (Hardcover)",
    category: "books",
    priceInPaisa: 89900, // ₹899.00
    priceRupees: 899,
    description: "The definitive 2026 handbook on multi-agent architectures, cryptographic mandates, and agentic workflows.",
    tags: ["book", "ai", "engineering", "hardcover", "learning"],
    inStock: true,
    rating: 4.9,
    upsellPairWith: ["prod_acc_03"]
  },
  {
    id: "prod_book_02",
    name: "The Agentic Economy: Protocols & Micropayments",
    category: "books",
    priceInPaisa: 64900, // ₹649.00
    priceRupees: 649,
    description: "A deep exploration of ACP, AP2, x402, and decentralized merchant gateways by leading fintech researchers.",
    tags: ["book", "fintech", "economics", "protocols"],
    inStock: true,
    rating: 4.7,
    upsellPairWith: ["prod_acc_03"]
  },
  {
    id: "prod_acc_01",
    name: "Braided 60W Fast Charging Cable (1.5m)",
    category: "accessories",
    priceInPaisa: 19900, // ₹199.00
    priceRupees: 199,
    description: "Heavy-duty nylon braided Type-C to Type-C cable with reinforced strain relief.",
    tags: ["cable", "usb-c", "charger", "accessory"],
    inStock: true,
    rating: 4.9,
    upsellPairWith: []
  },
  {
    id: "prod_acc_02",
    name: "Matte Silicone Protective Earbuds Case",
    category: "accessories",
    priceInPaisa: 14900, // ₹149.00
    priceRupees: 149,
    description: "Shockproof carabiner case compatible with Aura Earbuds.",
    tags: ["case", "silicone", "protection", "accessory"],
    inStock: true,
    rating: 4.5,
    upsellPairWith: []
  },
  {
    id: "prod_acc_03",
    name: "Metallic Magnetic Bookmark & Highlighter Set",
    category: "accessories",
    priceInPaisa: 12000, // ₹120.00
    priceRupees: 120,
    description: "Premium laser-cut brass bookmark with dual dual-tip pastel highlighters.",
    tags: ["stationery", "bookmark", "accessory", "reading"],
    inStock: true,
    rating: 4.9,
    upsellPairWith: []
  },
  {
    id: "prod_lifestyle_01",
    name: "Smart Temperature Control Coffee Mug",
    category: "lifestyle",
    priceInPaisa: 179900, // ₹1,799.00
    priceRupees: 1799,
    description: "App-controlled self-heating desk mug keeping coffee hot for 3+ hours.",
    tags: ["coffee", "desk", "lifestyle", "gadget"],
    inStock: true,
    rating: 4.4,
    upsellPairWith: ["prod_acc_01"]
  }
];

class CatalogService {
  constructor() {
    this.products = [...PRODUCTS];
  }

  getAllProducts() {
    return this.products;
  }

  getProductById(id) {
    return this.products.find(p => p.id === id) || null;
  }

  /**
   * Dynamically adds a new product to store catalog and updates agent discovery schema
   */
  addProduct({ name, category, priceRupees, description, tags = [], upsellPairWith = [] }) {
    const id = `prod_${category.substring(0, 4)}_${Date.now().toString(36).substring(3, 7)}`;
    const newProd = {
      id,
      name,
      category: category.toLowerCase(),
      priceInPaisa: Math.round(priceRupees * 100),
      priceRupees: Number(priceRupees),
      description,
      tags: Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()),
      inStock: true,
      rating: 5.0,
      upsellPairWith
    };
    this.products.unshift(newProd);
    return newProd;
  }

  searchProducts(query = "", category = null, maxPriceRupees = null) {
    let results = this.products;

    if (category && category !== "all") {
      results = results.filter(p => p.category.toLowerCase() === category.toLowerCase());
    }

    if (maxPriceRupees) {
      results = results.filter(p => p.priceRupees <= maxPriceRupees);
    }

    if (query && query.trim().length > 0) {
      const q = query.toLowerCase().trim();
      results = results.filter(p => 
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags.some(tag => tag.toLowerCase().includes(q))
      );
    }

    return results;
  }

  /**
   * Growth Engine: Calculates mandate headroom and suggests a high-margin complementary item
   */
  findHeadroomUpsell(cartItems, mandateSpendingCapInPaisa) {
    if (!mandateSpendingCapInPaisa) return null;

    const cartTotalInPaisa = cartItems.reduce((sum, item) => sum + (item.priceInPaisa * (item.quantity || 1)), 0);
    const headroomInPaisa = mandateSpendingCapInPaisa - cartTotalInPaisa;

    if (headroomInPaisa <= 0) return null;

    // Collect upsell recommendations from existing cart items
    const recommendedIds = new Set();
    cartItems.forEach(item => {
      const prod = this.getProductById(item.id);
      if (prod && prod.upsellPairWith) {
        prod.upsellPairWith.forEach(id => recommendedIds.add(id));
      }
    });

    // Find affordable items fitting within headroom
    const candidates = this.products.filter(p => 
      !cartItems.some(ci => ci.id === p.id) &&
      p.priceInPaisa <= headroomInPaisa &&
      p.inStock
    );

    if (candidates.length === 0) return null;

    // Prioritize paired items, otherwise pick highest rating affordable item
    let selected = candidates.find(c => recommendedIds.has(c.id)) || candidates[0];

    return {
      product: selected,
      cartTotalInPaisa,
      headroomInPaisa,
      headroomRupees: (headroomInPaisa / 100).toFixed(2),
      message: `You have ₹${(headroomInPaisa / 100).toFixed(2)} headroom left in your mandate. Add '${selected.name}' for just ₹${selected.priceRupees}?`
    };
  }

  /**
   * Dynamically auto-generates the agent-readable catalog manifest directly from live product data
   */
  getDynamicCatalogManifest() {
    const categories = Array.from(new Set(this.products.map(p => p.category)));
    const totalInventoryValue = this.products.reduce((acc, p) => acc + p.priceRupees, 0);

    return {
      schema_version: "2026.01.mcp-live",
      generated_at: new Date().toISOString(),
      provider: "Agent Commerce Gateway (ACG)",
      merchant: {
        name: "Razorpay Live Store (Test Mode Rails)",
        currency: "INR",
        total_skus: this.products.length,
        supported_categories: categories,
        inventory_value_inr: totalInventoryValue
      },
      available_products: this.products.map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        price: p.priceRupees,
        in_stock: p.inStock,
        rating: p.rating,
        tags: p.tags
      })),
      tools: [
        {
          name: "search_catalog",
          description: "Search merchant products by query, category, and budget.",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Search keyword" },
              category: { type: "string", enum: [...categories, "all"] },
              max_price: { type: "number", description: "Maximum budget in INR" }
            }
          }
        },
        {
          name: "get_product_details",
          description: "Get detailed product specifications, stock status, and pricing.",
          parameters: {
            type: "object",
            properties: {
              product_id: { type: "string", description: "Product identifier (e.g. prod_elec_01)" }
            },
            required: ["product_id"]
          }
        },
        {
          name: "check_headroom_upsell",
          description: "Growth hook to query complementary add-ons fitting within mandate budget headroom.",
          parameters: {
            type: "object",
            properties: {
              cart_items: { type: "array", description: "Current items in cart" },
              mandate_id: { type: "string", description: "Authorized mandate ID" }
            },
            required: ["cart_items"]
          }
        }
      ]
    };
  }
}

module.exports = new CatalogService();
