"use client";
import { useEffect, useState } from "react";
import type { CartItem, Quote } from "@/lib/cart-types";

export function useQuote(items: CartItem[], currency: "INR" | "USD", ready: boolean) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const key = JSON.stringify(items) + currency;
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    setLoading(true);
    fetch("/api/cart/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, currency }),
    })
      .then((r) => r.json())
      .then((q) => alive && setQuote(q))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready]);
  return { quote, loading };
}
