'use client';
// src/app/(public)/checkout/success/page.tsx
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, Package, ShoppingBag, ArrowRight, Zap, Star } from 'lucide-react';

const REDIRECT_AFTER = 4;

const STEPS = [
  { icon: Package, label: 'Seller packs your items'    },
  { icon: Zap,     label: 'Shipped with tracking'      },
  { icon: Star,    label: 'Leave a review on delivery' },
];

function SuccessContent() {
  const params      = useSearchParams();
  const router      = useRouter();
  const orderNumber = params.get('order');
  const [seconds, setSeconds] = useState(REDIRECT_AFTER);

  useEffect(() => {
    const id = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) { clearInterval(id); router.replace('/account/orders'); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">

        {/* Check icon */}
        <div className="flex justify-center mb-5">
          <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
            <CheckCircle2 size={36} className="text-green-500" strokeWidth={1.8} />
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-xl font-bold text-gray-900 mb-1">Order confirmed!</h1>
        <p className="text-sm text-gray-500 mb-5">
          {orderNumber ? (
            <>Order <span className="font-mono font-semibold text-gray-700">{orderNumber}</span> placed successfully.</>
          ) : (
            'Your order has been placed successfully.'
          )}
        </p>

        {/* What happens next */}
        <div className="bg-gray-50 rounded-xl p-4 mb-5 text-left space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
            What happens next
          </p>
          {STEPS.map((step, i) => (
            <div key={step.label} className="flex items-center gap-3">
              <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center text-[10px] font-bold shrink-0">
                {i + 1}
              </span>
              <step.icon size={13} className="text-gray-400 shrink-0" />
              <span className="text-sm text-gray-600">{step.label}</span>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div className="space-y-2">
          <Link
            href="/account/orders"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl
              bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors"
          >
            <Package size={15} />View my orders<ArrowRight size={14} />
          </Link>
          <Link
            href="/"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl
              bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-medium transition-colors"
          >
            <ShoppingBag size={15} />Continue shopping
          </Link>
        </div>

        {/* Countdown */}
        <p className="text-xs text-gray-400 mt-5">
          Redirecting to orders in{' '}
          <span className="font-semibold tabular-nums text-gray-600">{seconds}s</span>
        </p>

      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 rounded-full border-2 border-gray-200 border-t-violet-600 animate-spin" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}