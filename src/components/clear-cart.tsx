"use client";
import { useEffect } from "react";
import { useCart } from "./cart-context";

export function ClearCartOnMount() {
  const { clear, ready } = useCart();
  useEffect(() => {
    if (ready) clear();
  }, [ready, clear]);
  return null;
}
