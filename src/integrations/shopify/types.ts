// src/integrations/shopify/types.ts

export interface ShopifyShop {
  id: number;
  name: string;
  email: string;
  domain: string;
  myshopify_domain: string;
  currency: string;
  money_format: string;
  iana_timezone: string;
  plan_name: string;
  created_at: string;
  updated_at: string;
  country: string;
  country_code: string;
}

export interface ShopifyOrder {
  id: number;
  name: string;
  email: string;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  closed_at: string | null;
  financial_status: string;
  fulfillment_status: string | null;
  total_price: string;
  subtotal_price: string;
  total_tax: string;
  total_discounts: string;
  currency: string;
  order_number: number;
  customer: ShopifyCustomer | null;
  line_items: ShopifyLineItem[];
  shipping_address: ShopifyAddress | null;
  billing_address: ShopifyAddress | null;
  discount_codes: Array<{
    code: string;
    amount: string;
    type: string;
  }>;
  tags: string;
  note: string | null;
  source_name: string;
  referring_site: string | null;
  landing_site: string | null;
}

export interface ShopifyLineItem {
  id: number;
  product_id: number;
  variant_id: number;
  title: string;
  quantity: number;
  price: string;
  sku: string;
  variant_title: string;
  fulfillment_status: string | null;
  total_discount: string;
}

export interface ShopifyCustomer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  created_at: string;
  updated_at: string;
  orders_count: number;
  total_spent: string;
  tags: string;
  state: string;
  verified_email: boolean;
  default_address: ShopifyAddress | null;
}

export interface ShopifyAddress {
  address1: string;
  address2: string | null;
  city: string;
  province: string;
  country: string;
  zip: string;
  phone: string | null;
  country_code: string;
  province_code: string;
}

export interface ShopifyProduct {
  id: number;
  title: string;
  body_html: string;
  vendor: string;
  product_type: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  handle: string;
  status: string;
  tags: string;
  variants: ShopifyVariant[];
  images: ShopifyImage[];
}

export interface ShopifyVariant {
  id: number;
  product_id: number;
  title: string;
  price: string;
  compare_at_price: string | null;
  sku: string;
  inventory_quantity: number;
  inventory_item_id: number;
  weight: number;
  weight_unit: string;
}

export interface ShopifyImage {
  id: number;
  product_id: number;
  src: string;
  alt: string | null;
  position: number;
  width: number;
  height: number;
}

export interface ShopifyDiscount {
  id?: string;
  code: string;
  priceRuleId?: string;
  created_at?: string;
  usage_count?: number;
}

export interface ShopifyWebhook {
  id: number;
  topic: string;
  address: string;
  format: string;
  created_at: string;
  updated_at: string;
}

// ─── Webhook Payloads ───

export interface ShopifyOrderWebhookPayload {
  id: number;
  name: string;
  email: string;
  total_price: string;
  subtotal_price: string;
  total_discounts: string;
  currency: string;
  financial_status: string;
  fulfillment_status: string | null;
  customer: ShopifyCustomer | null;
  line_items: ShopifyLineItem[];
  created_at: string;
  discount_codes: Array<{
    code: string;
    amount: string;
    type: string;
  }>;
  tags: string;
  source_name: string;
  referring_site: string | null;
}

export interface ShopifyCustomerWebhookPayload {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  orders_count: number;
  total_spent: string;
  tags: string;
  state: string;
  created_at: string;
  updated_at: string;
}

export interface ShopifyCheckoutWebhookPayload {
  id: number;
  token: string;
  cart_token: string;
  email: string | null;
  total_price: string;
  subtotal_price: string;
  currency: string;
  customer: ShopifyCustomer | null;
  line_items: ShopifyLineItem[];
  abandoned_checkout_url: string;
  created_at: string;
  updated_at: string;
}

export interface ShopifyAppUninstalledPayload {
  id: number;
  name: string;
  email: string;
  domain: string;
  myshopify_domain: string;
}
