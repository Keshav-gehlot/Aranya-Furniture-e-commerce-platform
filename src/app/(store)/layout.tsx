import { CartProvider } from "@/components/cart-context";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <Header />
      <main>{children}</main>
      <Footer />
    </CartProvider>
  );
}
