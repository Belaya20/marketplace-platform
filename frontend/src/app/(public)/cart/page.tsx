'use client';
// src/app/(public)/cart/page.tsx
import Link from 'next/link';
import Image from 'next/image';
import { Trash2, Plus, Minus, ShoppingBag, Zap, Tag } from 'lucide-react';
import { useCart, formatETB } from '@/hooks';
import type { CartItem } from '@/types';

export default function CartPage() {
  const { cart, updateQty, removeItem } = useCart();
  const items    = (cart?.items ?? []) as any[];
  const subtotal = cart?.subtotal ?? 0;
  const hasFlash = cart?.has_flash_items ?? false;

  return (
    <div className="container-page py-8">
      <h1 className="text-2xl font-semibold text-gray-900 mb-8">Your cart</h1>

      {items.length === 0 ? (
        <div className="text-center py-20">
          <ShoppingBag size={64} className="text-gray-200 mx-auto mb-4" />
          <p className="text-xl font-medium text-gray-700 mb-2">Your cart is empty</p>
          <Link href="/" className="btn-primary px-8 py-3 mt-4">Browse products</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Items */}
          <div className="lg:col-span-2 space-y-4">
            {hasFlash && (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700 font-medium">
                <Zap size={15} className="fill-red-500 text-red-500 shrink-0" />
                Some items have flash sale prices applied — buy now before they expire!
              </div>
            )}

            {items.map((item: any) => (
              <div key={item.id} className={`card p-4 flex gap-4 transition-all ${
                item.is_flash_sale ? 'border-red-100 bg-red-50/30' : ''
              }`}>
                {/* Image */}
                <Link href={`/product/${item.slug}`}
                  className="flex-shrink-0 w-20 h-20 bg-gray-100 rounded-xl overflow-hidden">
                  {item.image_url
                    ? <Image src={item.image_url} alt={item.name} width={80} height={80} className="w-full h-full object-cover" />
                    : <div className="w-full h-full bg-gray-200" />}
                </Link>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2">
                    <Link href={`/product/${item.slug}`}>
                      <h3 className="font-medium text-gray-900 hover:text-violet-600 line-clamp-1">{item.name}</h3>
                    </Link>
                    {item.is_flash_sale && (
                      <span className="shrink-0 flex items-center gap-0.5 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                        <Zap size={8} className="fill-white" />FLASH
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{item.seller_name} · SKU: {item.sku}</p>

                  <div className="flex items-center justify-between mt-3">
                    {/* Qty controls */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQty({ itemId: item.id, quantity: item.quantity - 1 })}
                        disabled={item.quantity <= 1}
                        className="w-7 h-7 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40">
                        <Minus size={12} />
                      </button>
                      <span className="text-sm font-medium w-8 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQty({ itemId: item.id, quantity: item.quantity + 1 })}
                        disabled={item.quantity >= item.stock_qty}
                        className="w-7 h-7 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40">
                        <Plus size={12} />
                      </button>
                    </div>

                    {/* Price */}
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        {item.is_flash_sale ? (
                          <>
                            <p className="font-semibold text-red-600">
                              {formatETB(item.flash_sale_price * item.quantity)}
                            </p>
                            <p className="text-xs text-gray-400 line-through">
                              {formatETB(item.price * item.quantity)}
                            </p>
                          </>
                        ) : (
                          <p className="font-semibold text-violet-600">
                            {formatETB(item.effective_price * item.quantity)}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-gray-300 hover:text-red-500 p-1 transition-colors">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="card p-5 h-fit sticky top-24 space-y-4">
            <h2 className="font-semibold text-gray-900">Order summary</h2>

            <div className="space-y-2 text-sm">
              {items.map((item: any) => (
                <div key={item.id} className="flex justify-between text-gray-500 text-xs">
                  <span className="truncate max-w-[160px]">{item.name} ×{item.quantity}</span>
                  <span className={item.is_flash_sale ? 'text-red-600 font-medium' : ''}>
                    {formatETB(item.effective_price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            {/* Flash savings callout */}
            {hasFlash && (() => {
              const flashSavings = items
                .filter((i: any) => i.is_flash_sale)
                .reduce((s: number, i: any) => s + ((i.price - i.flash_sale_price) * i.quantity), 0);
              return flashSavings > 0 ? (
                <div className="flex items-center justify-between text-xs font-medium text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                  <span className="flex items-center gap-1"><Zap size={11} className="fill-red-500" />Flash savings</span>
                  <span>-{formatETB(flashSavings)}</span>
                </div>
              ) : null;
            })()}

            <div className="border-t border-gray-100 pt-3 flex justify-between font-semibold text-gray-900">
              <span>Subtotal</span>
              <span className="text-violet-600 text-lg">{formatETB(subtotal)}</span>
            </div>

            <p className="text-xs text-gray-400">Shipping & discounts applied at checkout</p>

            <Link href="/checkout" className="btn-primary w-full text-center py-3 block">
              Proceed to checkout
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
