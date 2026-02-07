// Tool implementations for the multi-agent system
import { supabase } from '@/integrations/supabase/client';
import { ToolDefinition, ToolResponse } from './types';

// Helper function to make tool API calls via the new backend.
// This replaces the Supabase Edge Function proxy.
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/v1/api";

async function callApi(
  endpoint: string,
  params: Record<string, unknown>,
  _apiUrl?: string
): Promise<ToolResponse> {
  try {
    // The spec says endpoints are like {API_URL}/hackathon/add_tags
    // Our backend mounts the router at /v1/api/hackathon
    // So if endpoint is /add_tags, we want /hackathon/add_tags
    // But wait, the previous code called '/get_customer_orders' etc.
    // And our backend router is mounted at /v1/api/hackathon
    // So we should construct the URL as API_BASE_URL + '/hackathon' + endpoint

    // However, if the user provides the *full* API_URL including /v1/api,
    // we need to append /hackathon

    // User said: API_URL : https://lookfor-backend.ngrok.app/v1/api
    // And calls: {API_URL}/hackathon/add_tags

    const url = `${API_BASE_URL}/hackathon${endpoint}`;

    console.log(`Calling API: ${url} with params:`, params);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: `API error: ${response.statusText} - ${JSON.stringify(data)}` };
    }

    return data as ToolResponse;
  } catch (error) {
    return { success: false, error: `Network error: ${String(error)}` };
  }
}


// Shopify Tools
export const shopifyGetCustomerOrders: ToolDefinition = {
  name: 'shopify_get_customer_orders',
  description: 'Get customer orders by email',
  parameters: {
    type: 'object',
    required: ['email'],
    properties: {
      email: { type: 'string', description: 'Customer email' },
      after: { type: 'string', description: 'Cursor for pagination, "null" for first page' },
      limit: { type: 'number', description: 'Number of orders to return, max 250' },
    },
  },
  execute: (params, apiUrl) => {
    const email = params.email as string;
    const after = (params.after ?? 'null') as string;
    const limit = (params.limit ?? 10) as number;
    return callApi('/get_customer_orders', { ...params, email, after, limit }, apiUrl);
  },
};

export const shopifyGetOrderDetails: ToolDefinition = {
  name: 'shopify_get_order_details',
  description: 'Get detailed information for a single order',
  parameters: {
    type: 'object',
    required: [],
    properties: {
      orderId: { type: 'string', description: 'Order number or identifier (e.g. NP8073419 or #1234)' },
      order_number: { type: 'string', description: 'Alias for orderId' },
    },
  },
  execute: (params, apiUrl) => {
    const id = (params.orderId || params.order_number) as string;
    if (!id) {
      return Promise.resolve({ success: false, error: "Missing required parameter: orderId or order_number" });
    }
    return callApi('/get_order_details', { ...params, orderId: id }, apiUrl);
  },
};


export const shopifyAddTags: ToolDefinition = {
  name: 'shopify_add_tags',
  description: 'Add tags to an order, customer, or product',
  parameters: {
    type: 'object',
    required: ['id', 'tags'],
    properties: {
      id: { type: 'string', description: 'Shopify resource GID' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Tags to add' },
    },
  },
  execute: (params, apiUrl) => callApi('/add_tags', params, apiUrl),
};

export const shopifyCancelOrder: ToolDefinition = {
  name: 'shopify_cancel_order',
  description: 'Cancel an order',
  parameters: {
    type: 'object',
    required: ['orderId', 'reason', 'notifyCustomer', 'restock', 'staffNote', 'refundMode', 'storeCredit'],
    properties: {
      orderId: { type: 'string' },
      reason: { type: 'string', enum: ['CUSTOMER', 'DECLINED', 'FRAUD', 'INVENTORY', 'OTHER', 'STAFF'] },
      notifyCustomer: { type: 'boolean' },
      restock: { type: 'boolean' },
      staffNote: { type: 'string' },
      refundMode: { type: 'string', enum: ['ORIGINAL', 'STORE_CREDIT'] },
      storeCredit: { type: 'object' },
    },
  },
  execute: (params, apiUrl) => callApi('/cancel_order', params, apiUrl),
};

export const shopifyCreateDiscountCode: ToolDefinition = {
  name: 'shopify_create_discount_code',
  description: 'Create a discount code for the customer',
  parameters: {
    type: 'object',
    required: ['type', 'value', 'duration', 'productIds'],
    properties: {
      type: { type: 'string', description: "'percentage' (0-1) or 'fixed'" },
      value: { type: 'number' },
      duration: { type: 'number', description: 'Validity in hours' },
      productIds: { type: 'array', items: { type: 'string' } },
    },
  },
  execute: (params, apiUrl) => callApi('/create_discount_code', params, apiUrl),
};

export const shopifyCreateStoreCredit: ToolDefinition = {
  name: 'shopify_create_store_credit',
  description: 'Credit store credit to a customer',
  parameters: {
    type: 'object',
    required: ['id', 'creditAmount', 'expiresAt'],
    properties: {
      id: { type: 'string', description: 'Customer GID' },
      creditAmount: { type: 'object' },
      expiresAt: { type: ['string', 'null'] },
    },
  },
  execute: (params, apiUrl) => callApi('/create_store_credit', params, apiUrl),
};

export const shopifyRefundOrder: ToolDefinition = {
  name: 'shopify_refund_order',
  description: 'Refund an order',
  parameters: {
    type: 'object',
    required: ['orderId', 'refundMethod'],
    properties: {
      orderId: { type: 'string' },
      refundMethod: { type: 'string', enum: ['ORIGINAL_PAYMENT_METHODS', 'STORE_CREDIT'] },
    },
  },
  execute: (params, apiUrl) => callApi('/refund_order', params, apiUrl),
};

export const shopifyCreateReturn: ToolDefinition = {
  name: 'shopify_create_return',
  description: 'Create a return for an order',
  parameters: {
    type: 'object',
    required: ['orderId'],
    properties: {
      orderId: { type: 'string' },
    },
  },
  execute: (params, apiUrl) => callApi('/create_return', params, apiUrl),
};

export const shopifyUpdateOrderShippingAddress: ToolDefinition = {
  name: 'shopify_update_order_shipping_address',
  description: 'Update an order shipping address',
  parameters: {
    type: 'object',
    required: ['orderId', 'shippingAddress'],
    properties: {
      orderId: { type: 'string' },
      shippingAddress: { type: 'object' },
    },
  },
  execute: (params, apiUrl) => callApi('/update_order_shipping_address', params, apiUrl),
};

export const shopifyGetProductRecommendations: ToolDefinition = {
  name: 'shopify_get_product_recommendations',
  description: 'Get product recommendations based on keywords',
  parameters: {
    type: 'object',
    required: ['queryKeys'],
    properties: {
      queryKeys: { type: 'array', items: { type: 'string' } },
    },
  },
  execute: (params, apiUrl) => callApi('/get_product_recommendations', params, apiUrl),
};

export const shopifyGetRelatedKnowledge: ToolDefinition = {
  name: 'shopify_get_related_knowledge_source',
  description: 'Get related FAQs and knowledge articles',
  parameters: {
    type: 'object',
    required: ['question', 'specificToProductId'],
    properties: {
      question: { type: 'string' },
      specificToProductId: { type: 'string' },
    },
  },
  execute: (params, apiUrl) => callApi('/get_related_knowledge_source', params, apiUrl),
};

// Skio Subscription Tools
export const skioGetSubscriptionStatus: ToolDefinition = {
  name: 'skio_get_subscription_status',
  description: 'Get subscription status for a customer',
  parameters: {
    type: 'object',
    required: ['email'],
    properties: {
      email: { type: 'string' },
    },
  },
  execute: (params, apiUrl) => callApi('/get-subscription-status', params, apiUrl),
};

export const skioCancelSubscription: ToolDefinition = {
  name: 'skio_cancel_subscription',
  description: 'Cancel a subscription',
  parameters: {
    type: 'object',
    required: ['subscriptionId', 'cancellationReasons'],
    properties: {
      subscriptionId: { type: 'string' },
      cancellationReasons: { type: 'array', items: { type: 'string' } },
    },
  },
  execute: (params, apiUrl) => callApi('/cancel-subscription', params, apiUrl),
};

export const skioPauseSubscription: ToolDefinition = {
  name: 'skio_pause_subscription',
  description: 'Pause a subscription',
  parameters: {
    type: 'object',
    required: ['subscriptionId', 'pausedUntil'],
    properties: {
      subscriptionId: { type: 'string' },
      pausedUntil: { type: 'string', description: 'Format: YYYY-MM-DD' },
    },
  },
  execute: (params, apiUrl) => callApi('/pause-subscription', params, apiUrl),
};

export const skioSkipNextOrder: ToolDefinition = {
  name: 'skio_skip_next_order_subscription',
  description: 'Skip the next subscription order',
  parameters: {
    type: 'object',
    required: ['subscriptionId'],
    properties: {
      subscriptionId: { type: 'string' },
    },
  },
  execute: (params, apiUrl) => callApi('/skip-next-order-subscription', params, apiUrl),
};

export const skioUnpauseSubscription: ToolDefinition = {
  name: 'skio_unpause_subscription',
  description: 'Unpause a subscription',
  parameters: {
    type: 'object',
    required: ['subscriptionId'],
    properties: {
      subscriptionId: { type: 'string' },
    },
  },
  execute: (params, apiUrl) => callApi('/unpause-subscription', params, apiUrl),
};

// Tool registry
export const toolRegistry: Record<string, ToolDefinition> = {
  shopify_get_customer_orders: shopifyGetCustomerOrders,
  shopify_get_order_details: shopifyGetOrderDetails,
  shopify_add_tags: shopifyAddTags,
  shopify_cancel_order: shopifyCancelOrder,
  shopify_create_discount_code: shopifyCreateDiscountCode,
  shopify_create_store_credit: shopifyCreateStoreCredit,
  shopify_refund_order: shopifyRefundOrder,
  shopify_create_return: shopifyCreateReturn,
  shopify_update_order_shipping_address: shopifyUpdateOrderShippingAddress,
  shopify_get_product_recommendations: shopifyGetProductRecommendations,
  shopify_get_related_knowledge_source: shopifyGetRelatedKnowledge,
  skio_get_subscription_status: skioGetSubscriptionStatus,
  skio_cancel_subscription: skioCancelSubscription,
  skio_pause_subscription: skioPauseSubscription,
  skio_skip_next_order_subscription: skioSkipNextOrder,
  skio_unpause_subscription: skioUnpauseSubscription,
};
