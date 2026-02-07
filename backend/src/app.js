const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

const UPSTREAM_API_URL = process.env.UPSTREAM_API_URL;

// Helper to proxy requests
const proxyRequest = async (req, res, endpoint) => {
    try {
        const url = `${UPSTREAM_API_URL}/hackathon/${endpoint}`;
        console.log(`Proxying to: ${url}`);

        // We using global fetch (Node 18+)
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Forward auth headers if needed, or add API keys here if the upstream requires them
            },
            body: JSON.stringify(req.body)
        });

        const data = await response.json();

        // Forward the status code and data
        res.status(response.status).json(data);
    } catch (error) {
        console.error(`Proxy error for ${endpoint}:`, error);
        res.status(500).json({ success: false, error: "Internal Proxy Error" });
    }
};

// Router
const router = express.Router();

// 1) Shopify Add Tags
router.post('/add_tags', (req, res) => proxyRequest(req, res, 'add_tags'));

// 2) Shopify Cancel Order
router.post('/cancel_order', (req, res) => proxyRequest(req, res, 'cancel_order'));

// 3) Shopify Create Discount Code
router.post('/create_discount_code', (req, res) => proxyRequest(req, res, 'create_discount_code'));

// 4) Shopify Create Return
router.post('/create_return', (req, res) => proxyRequest(req, res, 'create_return'));

// 5) Shopify Create Store Credit
router.post('/create_store_credit', (req, res) => proxyRequest(req, res, 'create_store_credit'));

// 6) Shopify Get Collection Recommendations
router.post('/get_collection_recommendations', (req, res) => proxyRequest(req, res, 'get_collection_recommendations'));

// 7) Shopify Get Customer Orders
router.post('/get_customer_orders', (req, res) => proxyRequest(req, res, 'get_customer_orders'));

// 8) Shopify Get Order Details
router.post('/get_order_details', (req, res) => {
    const { orderId, order_number } = req.body;
    const id = orderId || order_number;

    // Mock for specific IDs or if the upstream fails (but here we intercept first)
    if (id && (id.includes('1377958') || id.includes('1354045') || id.includes('NP'))) {
        console.log(`Returning MOCK data for order: ${id}`);
        return res.json({
            id: "gid://shopify/Order/5867626922263",
            name: id.startsWith('NP') ? id : `NP${id}`,
            email: "demo@example.com",
            phone: "+15555555555",
            displayFinancialStatus: "PAID",
            displayFulfillmentStatus: "UNFULFILLED",
            totalPriceSet: {
                shopMoney: {
                    amount: "150.00",
                    currencyCode: "USD"
                }
            },
            lineItems: {
                nodes: [
                    {
                        title: "Premium Support Plan",
                        quantity: 1,
                        originalTotalSet: {
                            shopMoney: {
                                amount: "150.00",
                                currencyCode: "USD"
                            }
                        }
                    }
                ]
            },
            tags: ["VIP", "Urgent"],
            shippingAddress: {
                address1: "123 Demo St",
                city: "New York",
                zip: "10001",
                country: "USA"
            }
        });
    }

    return proxyRequest(req, res, 'get_order_details');
});

// 9) Shopify Get Product Details
router.post('/get_product_details', (req, res) => proxyRequest(req, res, 'get_product_details'));

// 10) Shopify Get Product Recommendations
router.post('/get_product_recommendations', (req, res) => proxyRequest(req, res, 'get_product_recommendations'));

// 11) Shopify Get Related Knowledge Source
router.post('/get_related_knowledge_source', (req, res) => proxyRequest(req, res, 'get_related_knowledge_source'));

// 12) Shopify Refund Order
router.post('/refund_order', (req, res) => proxyRequest(req, res, 'refund_order'));

// 13) Shopify Update Order Shipping Address
router.post('/update_order_shipping_address', (req, res) => proxyRequest(req, res, 'update_order_shipping_address'));

// 14) Skio Cancel Subscription
router.post('/cancel-subscription', (req, res) => proxyRequest(req, res, 'cancel-subscription'));

// 15) Skio Get Subscriptions
router.post('/get-subscriptions', (req, res) => proxyRequest(req, res, 'get-subscriptions'));

// 16) Skio Pause Subscription
router.post('/pause-subscription', (req, res) => proxyRequest(req, res, 'pause-subscription'));

// 17) Skio Skip Next Order Subscription
router.post('/skip-next-order-subscription', (req, res) => proxyRequest(req, res, 'skip-next-order-subscription'));

// 18) Skio Unpause Subscription
router.post('/unpause-subscription', (req, res) => proxyRequest(req, res, 'unpause-subscription'));


// Mount router
app.use('/v1/api/hackathon', router);

// Health check and root paths
app.get('/health', (req, res) => res.send('OK'));
app.get('/', (req, res) => res.send('API Server is running. Access endpoints at /v1/api/hackathon/{endpoint}'));
app.get('/v1/api', (req, res) => res.json({ success: true, message: "API V1 is running. Base path: /v1/api" }));

module.exports = app;
