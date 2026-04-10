// src/lib/utils.ts
// Shared utilities for the admin app.
// Replaces @/hooks from the frontend app.

export function formatETB(amount: number | string | null | undefined): string {
  const n = Number(amount ?? 0);
  return new Intl.NumberFormat('en-ET', {
    style:                 'currency',
    currency:              'ETB',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(isNaN(n) ? 0 : n);
}

export const ORDER_STATUS_COLORS: Record<string, string> = {
  pending:    'bg-yellow-100 text-yellow-800',
  confirmed:  'bg-blue-100   text-blue-800',
  processing: 'bg-purple-100 text-purple-800',
  shipped:    'bg-indigo-100 text-indigo-800',
  delivered:  'bg-green-100  text-green-800',
  cancelled:  'bg-red-100    text-red-700',
  returned:   'bg-orange-100 text-orange-700',
};