'use client';
// src/app/(public)/checkout/page.tsx
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  MapPin, Truck, CreditCard, ClipboardList,
  Check, Loader2, Tag, X, CheckCircle2, AlertCircle, Zap,
} from 'lucide-react';
import { useCart, formatETB } from '@/hooks';
import { userApi, shippingApi, orderApi, paymentApi } from '@/lib/api';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const STEPS = [
  { id: 1, label: 'Address',  icon: MapPin },
  { id: 2, label: 'Shipping', icon: Truck },
  { id: 3, label: 'Payment',  icon: CreditCard },
  { id: 4, label: 'Review',   icon: ClipboardList },
];

interface DiscountState {
  status:      'idle' | 'checking' | 'valid' | 'invalid';
  message:     string;
  amount:      number;
  type:        string;
  scope?:      'global' | 'category' | 'product';
  scope_label?: string;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { cart } = useCart();

  const [step,          setStep]         = useState(1);
  const [addressId,     setAddressId]    = useState('');
  const [zoneId,        setZoneId]       = useState('');
  const [payment,       setPayment]      = useState<'chapa' | 'cod'>('chapa');
  const [discountCode,  setDiscountCode] = useState('');
  const [placing,       setPlacing]      = useState(false);
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);
  const [discount, setDiscount] = useState<DiscountState>({
    status: 'idle', message: '', amount: 0, type: '',
  });

  const { data: addresses = [] } = useQuery({ queryKey: ['addresses'],      queryFn: userApi.getAddresses });
  const { data: zones     = [] } = useQuery({ queryKey: ['shipping-zones'], queryFn: shippingApi.getZones });

  const totalWeight = (cart?.items ?? []).reduce((s: number, i: any) => s + (i.weight_kg * i.quantity), 0);
  const { data: shippingCalc } = useQuery({
    queryKey: ['shipping-calc', zoneId, cart?.subtotal],
    queryFn:  () => shippingApi.calculate(zoneId, cart?.subtotal ?? 0, totalWeight),
    enabled:  !!zoneId && !!cart,
  });

  const sc           = shippingCalc as any;
  const subtotal     = cart?.subtotal ?? 0;
  const shippingCost = discount.status === 'valid' && discount.type === 'free_shipping'
    ? 0
    : (sc?.shipping_cost ?? 0);
  const total = Math.max(0, subtotal + shippingCost - (discount.status === 'valid' ? discount.amount : 0));

  const hasFlash = cart?.has_flash_items ?? false;

  // ── Live discount validation ──────────────────────────────────────────────
  const validateDiscount = async () => {
    const code = discountCode.trim().toUpperCase();
    if (!code) return;
    setDiscount({ status: 'checking', message: '', amount: 0, type: '' });
    try {
      const res = await api.post('/discounts/validate', {
        code,
        subtotal,
        category_ids: cart?.category_ids ?? [],
        product_ids:  cart?.product_ids  ?? [],
      }) as any;
      const d = res.data.data;
      setDiscount({
        status:      'valid',
        message:     d.message,
        amount:      d.discount_amount,
        type:        d.type,
        scope:       d.scope,
        scope_label: d.scope_label,
      });
      toast.success(`Code applied: ${d.message}`);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Invalid or expired discount code';
      setDiscount({ status: 'invalid', message: msg, amount: 0, type: '' });
    }
  };

  const clearDiscount = () => {
    setDiscountCode('');
    setDiscount({ status: 'idle', message: '', amount: 0, type: '' });
  };

  // ── Place order ───────────────────────────────────────────────────────────
  const handlePlaceOrder = async () => {
    if (!addressId || !zoneId) { toast.error('Please complete all steps'); return; }
    if (placing) return;
    setPlacing(true);

    try {
      let orderId     = placedOrderId;
      let orderNumber = '';

      if (!orderId) {
        const order = await orderApi.placeOrder({
          shipping_address_id: addressId,
          shipping_zone_id:    zoneId,
          payment_method:      payment,
          discount_code:       discount.status === 'valid' ? discountCode.trim().toUpperCase() : undefined,
        }) as any;
        orderId     = order.id;
        orderNumber = order.order_number;
        setPlacedOrderId(order.id);
      } else {
        // Retry — fetch order number from existing order
        const existing = await orderApi.getOrder(orderId) as any;
        orderNumber = existing.order_number;
      }

      if (payment === 'chapa') {
        try {
          const pay = await paymentApi.initiate(orderId!) as any;
          window.location.replace(pay.checkout_url);
        } catch (chapaErr: any) {
          const msg = chapaErr.response?.data?.message || 'Chapa payment could not be initialized';
          toast.error(`Order placed but payment failed: ${msg}. Try again below.`);
          setPlacing(false);
        }
      } else {
        // ── COD FIX: confirm the order so it moves from 'pending' to 'confirmed'
        // This unblocks the seller from seeing and acting on the order.
        // If cod-confirm fails (network error), still redirect — the admin/seller
        // can manually confirm it, but at least the order exists in the DB.
        try {
          await api.post('/payments/cod-confirm', { order_id: orderId });
        } catch {
          // Non-fatal — order was placed, just not auto-confirmed
          // Seller can still see it as 'pending' and accept it
        }

        // Redirect to success page same as Chapa flow, so customer sees confirmation
        router.replace(`/checkout/success?order=${orderNumber}`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to place order');
      setPlacing(false);
    }
  };

  const btnLabel = () => {
    if (placing) return null;
    if (placedOrderId && payment === 'chapa') return 'Retry Chapa payment';
    if (payment === 'chapa') return 'Pay now with Chapa';
    return 'Place order (Cash on delivery)';
  };

  return (
    <div className="container-page py-8 max-w-3xl">
      <h1 className="text-2xl font-semibold text-gray-900 mb-8">Checkout</h1>

      {/* Step indicator */}
      <div className="flex items-center mb-8">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center flex-1">
            <button onClick={() => s.id < step && setStep(s.id)}
              className={clsx('flex items-center gap-2 text-sm font-medium transition-colors',
                step === s.id   ? 'text-violet-600'
                : s.id < step  ? 'text-green-600 cursor-pointer'
                               : 'text-gray-400')}>
              <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors',
                step === s.id  ? 'border-violet-600 bg-violet-50'
                : s.id < step ? 'border-green-500 bg-green-500'
                              : 'border-gray-300')}>
                {s.id < step ? <Check size={14} className="text-white" /> : <s.icon size={14} />}
              </div>
              <span className="hidden sm:block">{s.label}</span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={clsx('flex-1 h-0.5 mx-2', s.id < step ? 'bg-green-400' : 'bg-gray-200')} />
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">

          {/* Step 1: Address */}
          {step === 1 && (
            <div className="card p-5">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <MapPin size={17} className="text-violet-600" />Shipping address
              </h2>
              {(addresses as any[]).length === 0
                ? <p className="text-gray-500 text-sm py-4">No saved addresses. <a href="/account/profile" className="text-violet-600">Add one in your profile.</a></p>
                : <div className="space-y-3">
                    {(addresses as any[]).map(addr => (
                      <label key={addr.id} className={clsx('flex gap-3 p-3 border rounded-xl cursor-pointer transition-colors',
                        addressId === addr.id ? 'border-violet-600 bg-violet-50' : 'border-gray-200 hover:border-gray-400')}>
                        <input type="radio" name="addr" value={addr.id} checked={addressId === addr.id} onChange={() => setAddressId(addr.id)} className="mt-0.5" />
                        <div className="text-sm">
                          <p className="font-medium text-gray-900">{addr.full_name}</p>
                          <p className="text-gray-600">{addr.street_address}, {addr.city}, {addr.region}</p>
                          <p className="text-gray-500">{addr.phone}</p>
                        </div>
                      </label>
                    ))}
                  </div>
              }
              <button onClick={() => addressId ? setStep(2) : toast.error('Select an address')}
                className="btn-primary w-full mt-4">Continue to shipping</button>
            </div>
          )}

          {/* Step 2: Shipping */}
          {step === 2 && (
            <div className="card p-5">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Truck size={17} className="text-violet-600" />Shipping method
              </h2>
              <div className="space-y-3">
                {(zones as any[]).map((z: any) => (
                  <label key={z.id} className={clsx('flex gap-3 p-3 border rounded-xl cursor-pointer transition-colors',
                    zoneId === z.id ? 'border-violet-600 bg-violet-50' : 'border-gray-200 hover:border-gray-400')}>
                    <input type="radio" name="zone" value={z.id} checked={zoneId === z.id} onChange={() => setZoneId(z.id)} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm text-gray-900">{z.name}</p>
                        <p className="text-sm font-semibold text-violet-600">{formatETB(z.base_rate)}</p>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {z.estimated_days_min}–{z.estimated_days_max} business days
                        {z.free_above_amount > 0 && ` · Free above ${formatETB(z.free_above_amount)}`}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
              <button onClick={() => zoneId ? setStep(3) : toast.error('Select a shipping method')}
                className="btn-primary w-full mt-4">Continue to payment</button>
            </div>
          )}

          {/* Step 3: Payment + discount code */}
          {step === 3 && (
            <div className="card p-5">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <CreditCard size={17} className="text-violet-600" />Payment method
              </h2>

              <div className="space-y-3 mb-5">
                {[
                  { value: 'chapa', label: 'Pay with Chapa',   desc: 'Telebirr, CBE Birr, mobile money, bank transfer' },
                  { value: 'cod',   label: 'Cash on delivery', desc: 'Pay when your order arrives' },
                ].map(opt => (
                  <label key={opt.value} className={clsx('flex gap-3 p-3 border rounded-xl cursor-pointer transition-colors',
                    payment === opt.value ? 'border-violet-600 bg-violet-50' : 'border-gray-200 hover:border-gray-400')}>
                    <input type="radio" name="payment" value={opt.value} checked={payment === opt.value} onChange={() => setPayment(opt.value as any)} />
                    <div>
                      <p className="font-medium text-sm text-gray-900">{opt.label}</p>
                      <p className="text-xs text-gray-500">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>

              {/* Discount code */}
              <div className="mb-5">
                <label className="label text-sm flex items-center gap-1.5">
                  <Tag size={13} className="text-gray-400" />Discount code
                </label>

                {discount.status === 'valid' ? (
                  <div className="flex items-center gap-3 px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono font-bold text-emerald-700">{discountCode.toUpperCase()}</p>
                      <p className="text-xs text-emerald-600">{discount.message}</p>
                      {discount.scope && discount.scope !== 'global' && (
                        <p className="text-xs text-emerald-500 mt-0.5">
                          Applies to: {discount.scope_label ?? 'specific items'}
                        </p>
                      )}
                    </div>
                    <button onClick={clearDiscount} className="p-1 text-emerald-400 hover:text-emerald-600 transition-colors"><X size={14} /></button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex gap-2">
                      <input
                        value={discountCode}
                        onChange={e => {
                          setDiscountCode(e.target.value.toUpperCase());
                          if (discount.status === 'invalid') setDiscount({ status: 'idle', message: '', amount: 0, type: '' });
                        }}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), validateDiscount())}
                        className={clsx('input font-mono flex-1', discount.status === 'invalid' && 'border-red-300')}
                        placeholder="SUMMER20"
                        style={{ textTransform: 'uppercase' }}
                      />
                      <button type="button" onClick={validateDiscount}
                        disabled={!discountCode.trim() || discount.status === 'checking'}
                        className="btn-secondary text-xs px-4 whitespace-nowrap disabled:opacity-50">
                        {discount.status === 'checking' ? <Loader2 size={13} className="animate-spin" /> : 'Apply'}
                      </button>
                    </div>
                    {discount.status === 'invalid' && (
                      <div className="flex items-center gap-1.5 text-xs text-red-600">
                        <AlertCircle size={12} />{discount.message}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button onClick={() => setStep(4)} className="btn-primary w-full">Review order</button>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div className="card p-5">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <ClipboardList size={17} className="text-violet-600" />Review your order
              </h2>

              {hasFlash && (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-100 rounded-xl mb-4 text-sm text-red-700">
                  <Zap size={13} className="fill-red-500 text-red-500 shrink-0" />
                  Flash sale prices applied to some items
                </div>
              )}

              <div className="space-y-3 mb-4">
                {(cart?.items ?? []).map((item: any) => (
                  <div key={item.id} className="flex justify-between gap-4 text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-medium text-gray-900 truncate">{item.name}</p>
                        {item.is_flash_sale && (
                          <span className="flex items-center gap-0.5 bg-red-500 text-white text-[9px] font-bold px-1 py-0.5 rounded shrink-0">
                            <Zap size={7} className="fill-white" />FLASH
                          </span>
                        )}
                      </div>
                      <p className="text-gray-400 text-xs">Qty: {item.quantity}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={clsx('font-medium', item.is_flash_sale ? 'text-red-600' : '')}>
                        {formatETB(item.effective_price * item.quantity)}
                      </span>
                      {item.is_flash_sale && (
                        <p className="text-xs text-gray-400 line-through">{formatETB(item.price * item.quantity)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-100 pt-3 space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{formatETB(subtotal)}</span></div>
                <div className="flex justify-between text-gray-600">
                  <span>Shipping</span>
                  <span>
                    {discount.status === 'valid' && discount.type === 'free_shipping'
                      ? <span className="text-emerald-600 font-medium">Free</span>
                      : formatETB(sc?.shipping_cost ?? 0)
                    }
                  </span>
                </div>
                {discount.status === 'valid' && discount.amount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span className="flex items-center gap-1"><Tag size={11} />Discount ({discountCode.toUpperCase()})</span>
                    <span>-{formatETB(discount.amount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-gray-900 text-base pt-1 border-t border-gray-100">
                  <span>Total</span>
                  <span className="text-violet-600">{formatETB(total)}</span>
                </div>
              </div>

              {payment === 'chapa' && (
                <p className="text-xs text-gray-400 mt-3 text-center">
                  You will be redirected to Chapa to complete payment securely.
                </p>
              )}
              {payment === 'cod' && (
                <p className="text-xs text-gray-400 mt-3 text-center">
                  You will pay when your order is delivered.
                </p>
              )}

              <button onClick={handlePlaceOrder} disabled={placing}
                className="btn-primary w-full mt-5 py-3 gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
                {placing ? <><Loader2 size={15} className="animate-spin" />Processing…</> : btnLabel()}
              </button>
            </div>
          )}
        </div>

        {/* Summary sidebar */}
        <div className="card p-4 h-fit sticky top-24">
          <h3 className="font-medium text-gray-900 mb-3 text-sm">Order summary</h3>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>{cart?.item_count} item(s)</span>
              <span>{formatETB(subtotal)}</span>
            </div>
            {zoneId && (
              <div className="flex justify-between">
                <span>Shipping</span>
                <span>
                  {discount.status === 'valid' && discount.type === 'free_shipping'
                    ? <span className="text-emerald-600 font-medium">Free</span>
                    : formatETB(sc?.shipping_cost ?? 0)
                  }
                </span>
              </div>
            )}
            {discount.status === 'valid' && discount.amount > 0 && (
              <div className="flex justify-between text-emerald-600 font-medium">
                <span>Discount</span><span>-{formatETB(discount.amount)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-gray-900 pt-2 border-t border-gray-100">
              <span>Total</span>
              <span className="text-violet-600">{formatETB(total)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}