export type PurchaseType = "RETAIL" | "BUSINESS";
export type CartItem = { productId: string; type: PurchaseType; qty: number };

export type QuoteLine = {
  productId: string;
  name: string;
  slug: string;
  sku: string;
  image: string | null;
  type: PurchaseType;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  moq: number;
  stock: number;
  error?: string;
};

export type Quote = {
  currency: "INR" | "USD";
  lines: QuoteLine[];
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  hasBusiness: boolean;
  errors: string[];
};
