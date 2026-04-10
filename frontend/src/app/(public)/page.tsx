// src/app/(public)/page.tsx
import {
  HomeBanners,
  FlashSaleSection,
  ProductSection,
  CategoryGrid,
  DiscountCodesStrip,
} from '@/components/features/product/ProductCard';

export default function HomePage() {
  return (
    <div className="space-y-10 pb-16">
      <HomeBanners />

      <section className="container-page">
        <h2 className="section-title">Shop by category</h2>
        <CategoryGrid />
      </section>

      {/* Flash sales — shown when admin has an active sale */}
      <FlashSaleSection />

      {/* Public discount codes — shoppers copy and use at checkout */}
      <DiscountCodesStrip />

      <section className="container-page">
        <ProductSection title="Featured products" params={{ sort: 'popularity' }} apiKey="featured" />
      </section>
      <section className="container-page">
        <ProductSection title="New arrivals" params={{ sort: 'newest' }} apiKey="new-arrivals" />
      </section>
      <section className="container-page">
        <ProductSection title="Best sellers" params={{ sort: 'popularity' }} apiKey="best-sellers" />
      </section>
    </div>
  );
}
