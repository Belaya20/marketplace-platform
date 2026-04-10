// src/app/(public)/layout.tsx
import Navbar      from '@/components/layouts/Navbar';
import Footer      from '@/components/layouts/Footer';
import CartDrawer  from '@/components/features/cart/CartDrawer';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
      <CartDrawer />
    </div>
  );
}
