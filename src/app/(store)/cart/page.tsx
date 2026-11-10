import { getCurrency } from "@/lib/currency";
import { CartView } from "@/components/cart-view";

export const metadata = { title: "Cart", robots: { index: false } };

export default async function CartPage() {
  const currency = await getCurrency();
  return (
    <div className="container-x pb-12 pt-8 lg:pb-24 lg:pt-12">
      <h1 className="t-h1">Your cart</h1>
      <CartView currency={currency} />
    </div>
  );
}
