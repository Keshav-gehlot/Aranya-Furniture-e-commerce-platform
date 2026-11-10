"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CartItem, PurchaseType } from "@/lib/cart-types";

type Ctx = {
  items: CartItem[];
  ready: boolean;
  count: number;
  add: (productId: string, type: PurchaseType, qty: number) => void;
  setQty: (productId: string, type: PurchaseType, qty: number) => void;
  remove: (productId: string, type: PurchaseType) => void;
  clear: () => void;
};

const CartCtx = createContext<Ctx | null>(null);
const KEY = "cart_v1";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {}
  }, [items, ready]);

  const add = useCallback((productId: string, type: PurchaseType, qty: number) => {
    setItems((prev) => {
      const i = prev.findIndex((x) => x.productId === productId && x.type === type);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], qty: next[i].qty + qty };
        return next;
      }
      return [...prev, { productId, type, qty }];
    });
  }, []);

  const setQty = useCallback((productId: string, type: PurchaseType, qty: number) => {
    setItems((prev) =>
      prev.map((x) => (x.productId === productId && x.type === type ? { ...x, qty: Math.max(1, qty) } : x)),
    );
  }, []);

  const remove = useCallback((productId: string, type: PurchaseType) => {
    setItems((prev) => prev.filter((x) => !(x.productId === productId && x.type === type)));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(
    () => ({ items, ready, count: items.reduce((s, i) => s + i.qty, 0), add, setQty, remove, clear }),
    [items, ready, add, setQty, remove, clear],
  );
  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

export function useCart() {
  const c = useContext(CartCtx);
  if (!c) throw new Error("useCart must be used inside CartProvider");
  return c;
}
