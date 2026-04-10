'use client';
// src/components/features/cart/CartDrawer.tsx
import Link from 'next/link';
import Image from 'next/image';
import { X, Trash2, Plus, Minus, ShoppingBag } from 'lucide-react';
import { useCart, formatETB } from '@/hooks';
import type { CartItem } from '@/types';

export default function CartDrawer() {
  const { cart, isOpen, closeCart, updateQty, removeItem } = useCart();
  if (!isOpen) return null;
  const items    = cart?.items ?? [];
  const subtotal = cart?.subtotal ?? 0;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={closeCart} />
      <div className="fixed right-0 top-0 h-full w-full sm:w-[400px] bg-white z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <ShoppingBag size={19} />
            Cart
            {items.length > 0 && <span className="text-gray-400 font-normal text-sm">({items.length})</span>}
          </h2>
          <button onClick={closeCart} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-52 text-center">
              <ShoppingBag size={48} className="text-gray-200 mb-3" />
              <p className="text-gray-500 font-medium text-sm">Your cart is empty</p>
              <button onClick={closeCart} className="btn-primary mt-4 text-sm py-2 px-5">
                Continue shopping
              </button>
            </div>
          ) : items.map((item: CartItem) => (
            <div key={item.id} className="flex gap-3">
              <Link href={`/product/${item.slug}`} onClick={closeCart}
                className="flex-shrink-0 w-16 h-16 bg-gray-100 rounded-lg overflow-hidden">
                {item.image_url
                  ? <Image src={item.image_url} alt={item.name} width={64} height={64} className="w-full h-full object-cover" />
                  : <div className="w-full h-full bg-gray-200" />}
              </Link>
              <div className="flex-1 min-w-0">
                <Link href={`/product/${item.slug}`} onClick={closeCart}>
                  <p className="text-sm font-medium text-gray-900 line-clamp-1">{item.name}</p>
                </Link>
                <p className="text-xs text-gray-400 mt-0.5">{item.seller_name}</p>
                <p className="text-sm font-semibold text-violet-600 mt-1">
                  {formatETB(item.discount_price || item.price)}
                  {item.discount_price && (
                    <span className="text-gray-400 font-normal line-through text-xs ml-1.5">
                      {formatETB(item.price)}
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => updateQty({ itemId: item.id, quantity: item.quantity - 1 })}
                    disabled={item.quantity <= 1}
                    className="w-6 h-6 flex items-center justify-center border border-gray-300 rounded text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                    <Minus size={11} />
                  </button>
                  <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                  <button
                    onClick={() => updateQty({ itemId: item.id, quantity: item.quantity + 1 })}
                    disabled={item.quantity >= item.stock_qty}
                    className="w-6 h-6 flex items-center justify-center border border-gray-300 rounded text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                    <Plus size={11} />
                  </button>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="ml-auto p-1 text-gray-300 hover:text-red-500 rounded">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-gray-200 p-5 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-semibold text-gray-900">{formatETB(subtotal)}</span>
            </div>
            <p className="text-xs text-gray-400">Shipping calculated at checkout</p>
            <Link href="/checkout" onClick={closeCart} className="btn-primary w-full py-3 text-sm">
              Proceed to checkout
            </Link>
            <Link href="/cart" onClick={closeCart} className="btn-secondary w-full py-2.5 text-sm">
              View full cart
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
