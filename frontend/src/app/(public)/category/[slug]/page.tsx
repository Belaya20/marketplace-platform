'use client';
// src/app/(public)/category/[slug]/page.tsx
import { useParams } from 'next/navigation';
import { useQuery }  from '@tanstack/react-query';
import { catalogApi, productApi } from '@/lib/api';
import { ProductGrid } from '@/components/features/product/ProductCard';
import { DiscountBanner } from '@/components/features/product/DiscountBanner';
import Link from 'next/link';

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();

  const { data: category } = useQuery({
    queryKey: ['category', slug],
    queryFn:  () => catalogApi.getCategory(slug),
    staleTime: 300_000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['products', 'cat', slug],
    queryFn:  () => productApi.search({ category: slug, limit: 24 }),
  });

  const products = (data?.data ?? []) as any[];
  const c = category as any;

  return (
    <div className="container-page py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">{c?.name ?? slug}</h1>
        {c?.description && (
          <p className="text-sm text-gray-500 mb-3">{c.description}</p>
        )}

        {/* Sub-categories */}
        {c?.children?.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {c.children.map((sub: any) => (
              <Link key={sub.id} href={`/category/${sub.slug}`}
                className="badge border border-gray-200 bg-white text-gray-700
                  hover:bg-violet-50 hover:text-violet-700 hover:border-violet-200 py-1.5 px-3">
                {sub.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Discount codes applicable to this category */}
      <DiscountBanner
        categorySlug={slug}
        title={`Discount codes for ${c?.name ?? 'this category'}`}
      />

      {/* Product grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="aspect-square skeleton rounded-xl" />
              <div className="h-4 skeleton rounded" />
            </div>
          ))}
        </div>
      ) : (
        <ProductGrid products={products} />
      )}
    </div>
  );
}