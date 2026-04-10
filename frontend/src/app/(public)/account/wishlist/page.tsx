'use client';
// src/app/(public)/account/wishlist/page.tsx
import Link from 'next/link';
import Image from 'next/image';
import { Heart, ShoppingCart } from 'lucide-react';
import { useWishlist, formatETB } from '@/hooks';

export default function WishlistPage() {
  const { items, removeItem, moveToCart } = useWishlist();
  return (
    <div className="container-page py-8 max-w-3xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
        <Heart size={21} className="text-red-500" />My wishlist
        {(items as any[]).length > 0 && <span className="text-gray-400 font-normal text-base">({(items as any[]).length})</span>}
      </h1>
      {(items as any[]).length === 0 ? (
        <div className="text-center py-16">
          <Heart size={48} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">Your wishlist is empty</p>
          <Link href="/" className="btn-primary">Discover products</Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {(items as any[]).map((item: any) => (
            <div key={item.id} className="card p-0 overflow-hidden">
              <Link href={`/product/${item.slug}`} className="block aspect-square bg-gray-50 relative">
                {item.image_url
                  ? <Image src={item.image_url} alt={item.name} fill className="object-cover" />
                  : <div className="w-full h-full bg-gray-100" />}
              </Link>
              <div className="p-3">
                <Link href={`/product/${item.slug}`}>
                  <p className="text-sm font-medium text-gray-900 line-clamp-2">{item.name}</p>
                </Link>
                <p className="text-sm font-semibold text-violet-600 mt-1">{formatETB(item.discount_price ?? item.price)}</p>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => moveToCart(item.product_id)} className="btn-primary flex-1 text-xs py-1.5 gap-1">
                    <ShoppingCart size={11} />Move to cart
                  </button>
                  <button onClick={() => removeItem(item.product_id)} className="btn-secondary px-2 py-1.5">
                    <Heart size={13} className="fill-red-500 text-red-500" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
