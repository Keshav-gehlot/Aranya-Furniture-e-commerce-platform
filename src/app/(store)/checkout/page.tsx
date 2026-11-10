import { requireUser } from "@/lib/auth";
import { getCurrency } from "@/lib/currency";
import { providerFor } from "@/lib/payments";
import { CheckoutForm } from "@/components/checkout-form";

export const metadata = { title: "Checkout", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ cancelled?: string }> }) {
  const user = await requireUser("/checkout");
  const currency = await getCurrency();
  const { cancelled } = await searchParams;
  const gateway = providerFor(currency);
  return (
    <div className="container-x pb-12 pt-8 lg:pb-24 lg:pt-12">
      <h1 className="t-h1">Checkout</h1>
      {cancelled && <p className="mt-5 rounded-sm bg-warning-subtle p-4 text-[15px]" role="status">The payment was cancelled. Your cart is still here, so you can try again.</p>}
      <CheckoutForm
        currency={currency}
        gateway={gateway}
        user={{
          name: user.name,
          email: user.email,
          phone: user.phone ?? "",
          country: user.country,
          address: user.address ?? "",
          companyName: user.companyName ?? "",
          taxId: user.taxId ?? "",
          isBusiness: user.accountType === "BUSINESS",
        }}
      />
    </div>
  );
}
