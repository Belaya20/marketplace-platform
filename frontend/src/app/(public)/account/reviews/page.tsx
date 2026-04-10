'use client';
// src/app/(public)/account/reviews/page.tsx
// Shows:
//  1. Products the customer can still review (bought + delivered, no review yet)
//  2. Reviews they have already written
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Star, Package, CheckCircle2, Loader2, PenLine, Eye } from 'lucide-react';
import { reviewApi } from '@/lib/api';
import api from '@/lib/api';
import { formatETB } from '@/hooks';
import toast from 'react-hot-toast';
import clsx from 'clsx';

// ── Star selector ─────────────────────────────────────────────────────────────
function StarSelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <button key={i} type="button"
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(i)}
          className="p-0.5 transition-transform hover:scale-110 active:scale-95">
          <Star size={26} strokeWidth={1.5}
            className={clsx('transition-colors',
              i <= (hovered || value) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'
            )} />
        </button>
      ))}
      {(hovered || value) > 0 && (
        <span className="ml-2 text-sm font-medium text-gray-600">
          {LABELS[hovered || value]}
        </span>
      )}
    </div>
  );
}

// ── Inline review form for a specific product ─────────────────────────────────
function WriteReviewForm({
  productId,
  productName,
  orderId,
  onSuccess,
}: {
  productId:   string;
  productName: string;
  orderId:     string;
  onSuccess:   () => void;
}) {
  const [rating,  setRating]  = useState(0);
  const [title,   setTitle]   = useState('');
  const [comment, setComment] = useState('');

  const mutation = useMutation({
    mutationFn: () => reviewApi.submitReview(productId, {
      rating, title: title.trim() || undefined,
      comment: comment.trim() || undefined, order_id: orderId,
    }),
    onSuccess: () => {
      toast.success('Review submitted — thank you!');
      onSuccess();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to submit review'),
  });

  return (
    <div className="mt-3 p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        Your review for "{productName}"
      </p>

      {/* Stars */}
      <div>
        <label className="text-xs text-gray-500 mb-1.5 block">Rating *</label>
        <StarSelector value={rating} onChange={setRating} />
      </div>

      {/* Title */}
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Title (optional)</label>
        <input value={title} onChange={e => setTitle(e.target.value)}
          className="input text-sm" placeholder="Summarize your experience…" maxLength={120} />
      </div>

      {/* Comment */}
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Review (optional)</label>
        <textarea value={comment} onChange={e => setComment(e.target.value)}
          rows={3} className="input text-sm resize-none"
          placeholder="Tell others what you thought about this product…"
          maxLength={1000} />
        <p className="text-xs text-gray-400 text-right mt-0.5">{comment.length}/1000</p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => {
            if (!rating) { toast.error('Please select a star rating'); return; }
            mutation.mutate();
          }}
          disabled={mutation.isPending}
          className="btn-primary text-sm gap-2 disabled:opacity-50">
          {mutation.isPending
            ? <><Loader2 size={13} className="animate-spin" />Submitting…</>
            : <><CheckCircle2 size={13} />Submit review</>}
        </button>
      </div>
    </div>
  );
}

// ── Reviewable product card ───────────────────────────────────────────────────
function ReviewableCard({ item }: { item: any }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  return (
    <div className={clsx('card p-4 transition-all', open && 'border-violet-200')}>
      <div className="flex items-center gap-3">
        {/* Product image */}
        <div className="w-14 h-14 rounded-xl bg-gray-100 overflow-hidden shrink-0">
          {item.image_url
            ? <Image src={item.image_url} alt={item.product_name} width={56} height={56} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center"><Package size={18} className="text-gray-300" /></div>
          }
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 text-sm truncate">{item.product_name}</p>
          <p className="text-xs text-gray-400 mt-0.5 font-mono">{item.sku}</p>
          {item.unit_price_snapshot && (
            <p className="text-xs text-gray-500 mt-0.5">{formatETB(item.unit_price_snapshot)} · ×{item.quantity}</p>
          )}
        </div>

        {/* Write review button */}
        <button
          onClick={() => setOpen(o => !o)}
          className={clsx(
            'flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl transition-all shrink-0',
            open
              ? 'bg-gray-100 text-gray-600'
              : 'bg-violet-600 text-white hover:bg-violet-700 shadow-sm shadow-violet-500/20'
          )}>
          <PenLine size={13} />
          {open ? 'Cancel' : 'Write review'}
        </button>
      </div>

      {open && (
        <WriteReviewForm
          productId={item.product_id}
          productName={item.product_name}
          orderId={item.order_id}
          onSuccess={() => {
            setOpen(false);
            qc.invalidateQueries({ queryKey: ['my-pending-reviews'] });
            qc.invalidateQueries({ queryKey: ['my-reviews'] });
          }}
        />
      )}
    </div>
  );
}

// ── Star display (read-only) ──────────────────────────────────────────────────
function StarDisplay({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={size} strokeWidth={1.5}
          className={i <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'} />
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CustomerReviewsPage() {
  const [tab, setTab] = useState<'pending' | 'written'>('pending');

  // Delivered items not yet reviewed — custom endpoint
  const { data: pendingItems = [], isLoading: pendingLoading } = useQuery({
    queryKey: ['my-pending-reviews'],
    queryFn:  () => api.get('/reviews/pending').then((r: any) => r.data.data ?? []),
    staleTime: 60_000,
  });

  // Reviews the customer has already written
  const { data: writtenReviews = [], isLoading: writtenLoading } = useQuery({
    queryKey: ['my-reviews'],
    queryFn:  () => api.get('/reviews/mine').then((r: any) => r.data.data ?? []),
    staleTime: 60_000,
  });

  const pendingCount = (pendingItems as any[]).length;
  const writtenCount = (writtenReviews as any[]).length;

  return (
    <div className="container-page py-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Ratings & reviews</h1>
          <p className="text-sm text-gray-400 mt-0.5">Share your experience with products you've purchased</p>
        </div>
        <Link href="/account/orders" className="btn-secondary text-sm">← My orders</Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-amber-500">{pendingCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Awaiting your review</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-violet-600">{writtenCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Reviews written</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-5">
        {[
          { id: 'pending', label: 'To review',    count: pendingCount },
          { id: 'written', label: 'My reviews',   count: writtenCount },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={clsx('flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
              tab === t.id ? 'border-violet-600 text-violet-600' : 'border-transparent text-gray-500 hover:text-gray-700')}>
            {t.label}
            {t.count > 0 && (
              <span className={clsx('text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                tab === t.id ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-500')}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Pending reviews tab ── */}
      {tab === 'pending' && (
        <div className="space-y-3">
          {pendingLoading && (
            <div className="card p-8 flex items-center justify-center gap-2 text-gray-400">
              <Loader2 size={16} className="animate-spin" />Loading…
            </div>
          )}
          {!pendingLoading && (pendingItems as any[]).length === 0 && (
            <div className="card p-12 text-center">
              <CheckCircle2 size={40} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 text-sm font-medium">All caught up!</p>
              <p className="text-xs text-gray-400 mt-1">You've reviewed all your delivered products.</p>
              <Link href="/" className="btn-primary text-sm mt-4 inline-flex">Keep shopping</Link>
            </div>
          )}
          {(pendingItems as any[]).map((item: any) => (
            <ReviewableCard key={`${item.product_id}-${item.order_id}`} item={item} />
          ))}
        </div>
      )}

      {/* ── Written reviews tab ── */}
      {tab === 'written' && (
        <div className="space-y-4">
          {writtenLoading && (
            <div className="card p-8 flex items-center justify-center gap-2 text-gray-400">
              <Loader2 size={16} className="animate-spin" />Loading…
            </div>
          )}
          {!writtenLoading && (writtenReviews as any[]).length === 0 && (
            <div className="card p-12 text-center">
              <Star size={40} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 text-sm font-medium">No reviews yet</p>
              <p className="text-xs text-gray-400 mt-1">Your reviews will appear here after you submit them.</p>
            </div>
          )}
          {(writtenReviews as any[]).map((review: any) => (
            <div key={review.id} className="card p-4">
              <div className="flex items-start gap-3">
                {/* Product image */}
                <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden shrink-0">
                  {review.product_image
                    ? <Image src={review.product_image} alt={review.product_name} width={48} height={48} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center"><Package size={16} className="text-gray-300" /></div>
                  }
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <p className="font-medium text-sm text-gray-900 truncate">{review.product_name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <StarDisplay rating={review.rating} />
                        <span className="text-xs text-gray-400">
                          {new Date(review.created_at).toLocaleDateString('en-GB', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {review.is_approved ? (
                        <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                          <CheckCircle2 size={10} />Published
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          Under review
                        </span>
                      )}
                      <Link href={`/product/${review.product_slug}`}
                        className="p-1.5 text-gray-400 hover:text-violet-600 transition-colors rounded-lg hover:bg-violet-50"
                        title="View product">
                        <Eye size={14} />
                      </Link>
                    </div>
                  </div>

                  {review.title && (
                    <p className="text-sm font-semibold text-gray-800 mt-2">{review.title}</p>
                  )}
                  {review.comment && (
                    <p className="text-sm text-gray-600 mt-1 leading-relaxed">{review.comment}</p>
                  )}
                  {review.is_verified_purchase && (
                    <div className="flex items-center gap-1 mt-2">
                      <CheckCircle2 size={11} className="text-green-500" />
                      <p className="text-xs text-green-600 font-medium">Verified purchase</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}