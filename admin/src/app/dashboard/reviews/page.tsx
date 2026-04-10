'use client';
// src/app/dashboard/reviews/page.tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/api';
import api from '@/lib/api';
import {
  Star, Check, X, Flag, Eye, Loader2,
  MessageSquare, ThumbsUp, ThumbsDown, AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={12} strokeWidth={1.5}
          className={i <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'} />
      ))}
    </div>
  );
}

const FILTER_TABS = [
  { id: 'pending',  label: 'Pending',  icon: MessageSquare, color: 'text-amber-600'  },
  { id: 'approved', label: 'Approved', icon: ThumbsUp,      color: 'text-green-600'  },
  { id: 'reported', label: 'Reported', icon: Flag,          color: 'text-red-500'    },
  { id: 'all',      label: 'All',      icon: Eye,           color: 'text-gray-500'   },
];

export default function ReviewsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'pending'|'approved'|'reported'|'all'>('pending');

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['admin-reviews', filter],
    queryFn:  () => api.get('/admin/reviews', { params: { filter } }).then((r: any) => r.data.data ?? []),
    staleTime: 30_000,
  });

  const approveMut = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      adminApi.updateReview(id, approve),
    onSuccess: (_d, { approve }) => {
      toast.success(approve ? 'Review approved and published' : 'Review rejected and hidden');
      qc.invalidateQueries({ queryKey: ['admin-reviews'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const allReviews    = reviews as any[];
  const pendingCount  = allReviews.filter(r => !r.is_approved && !r.is_reported).length;
  const reportedCount = allReviews.filter(r => r.is_reported).length;

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <MessageSquare size={20} className="text-indigo-600" /> Reviews & ratings
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Moderate customer reviews before they appear on product pages</p>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-amber-100 text-amber-700">
              <AlertTriangle size={12} />{pendingCount} pending
            </span>
          )}
          {reportedCount > 0 && (
            <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-red-100 text-red-700">
              <Flag size={12} />{reportedCount} reported
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {FILTER_TABS.map(t => (
          <button key={t.id} onClick={() => setFilter(t.id as any)}
            className={clsx('flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
              filter === t.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700')}>
            <t.icon size={13} />{t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-28 skeleton rounded-xl" />)}</div>
      ) : allReviews.length === 0 ? (
        <div className="card p-12 text-center">
          <MessageSquare size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium">
            {filter === 'pending' ? 'No pending reviews — all caught up!' :
             filter === 'reported' ? 'No reported reviews' :
             filter === 'approved' ? 'No approved reviews yet' : 'No reviews yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {allReviews.map((review: any) => (
            <div key={review.id} className={clsx('card p-5',
              review.is_reported && 'border-red-200 bg-red-50/30',
              !review.is_approved && !review.is_reported && 'border-amber-200 bg-amber-50/20')}>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-sm font-bold shrink-0">
                  {(review.first_name?.[0] ?? '?').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900">{review.first_name} {review.last_name}</span>
                        <StarDisplay rating={review.rating} />
                        <span className="text-xs text-gray-400">{new Date(review.created_at).toLocaleDateString('en-GB', { day:'numeric',month:'short',year:'numeric' })}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {review.is_approved
                          ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Published</span>
                          : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Pending</span>
                        }
                        {review.is_reported && (
                          <span className="flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                            <Flag size={9} />Reported
                          </span>
                        )}
                        {review.is_verified_purchase && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Verified purchase</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!review.is_approved && (
                        <button onClick={() => approveMut.mutate({ id: review.id, approve: true })}
                          disabled={approveMut.isPending}
                          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50">
                          {approveMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}Approve
                        </button>
                      )}
                      {review.is_approved && (
                        <button onClick={() => approveMut.mutate({ id: review.id, approve: false })}
                          disabled={approveMut.isPending}
                          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50">
                          {approveMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}Reject
                        </button>
                      )}
                    </div>
                  </div>

                  {review.product_name && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2 bg-gray-50 px-3 py-1.5 rounded-lg w-fit">
                      <Star size={10} className="text-gray-400" />
                      Review for: <span className="font-medium text-gray-700">{review.product_name}</span>
                    </div>
                  )}

                  {review.title && <p className="text-sm font-semibold text-gray-900 mb-1">{review.title}</p>}
                  {review.comment
                    ? <p className="text-sm text-gray-600 leading-relaxed">{review.comment}</p>
                    : <p className="text-xs text-gray-400 italic">Rating only — no written comment</p>
                  }

                  {review.is_reported && review.report_reason && (
                    <div className="mt-3 flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-100 rounded-lg">
                      <Flag size={12} className="text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-red-700">Report reason</p>
                        <p className="text-xs text-red-600 mt-0.5">{review.report_reason}</p>
                      </div>
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