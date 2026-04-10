'use client';
// src/app/(seller)/seller/products/[id]/edit/page.tsx
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { catalogApi, productApi } from '@/lib/api';
import { ChevronLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function EditProductPage() {
  const { id }    = useParams<{ id: string }>();
  const router    = useRouter();
  const [loading, setLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['seller-products-all'],
    queryFn:  () => productApi.getMyProducts({ limit: 200 }),
  });
  const product = (data?.data as any[] ?? []).find((p: any) => p.id === id);

  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: catalogApi.getCategories });
  const flatCats: any[] = [];
  const flatten = (cats: any[], depth = 0) => cats.forEach((c: any) => { flatCats.push({ ...c, depth }); if (c.children?.length) flatten(c.children, depth + 1); });
  flatten(categories as any[]);

  const { register, handleSubmit, reset } = useForm<any>();

  useEffect(() => {
    if (product) {
      reset({
        name:              product.name,
        category_id:       product.category_id,
        short_description: product.short_description ?? '',
        full_description:  product.full_description  ?? '',
      });
    }
  }, [product, reset]);

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      await productApi.updateProduct(id, data);
      toast.success('Product updated');
      router.push('/seller/products');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update');
    } finally { setLoading(false); }
  };

  if (isLoading) return (
    <div className="max-w-2xl space-y-4">
      <div className="h-8 skeleton rounded w-48" />
      <div className="h-64 skeleton rounded-xl" />
    </div>
  );

  if (!product) return <div className="text-gray-400 py-16 text-center">Product not found</div>;

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/seller/products" className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100"><ChevronLeft size={20} /></Link>
        <h1 className="text-xl font-semibold text-gray-900">Edit product</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="card p-5 space-y-4">
        <div>
          <label className="label">Product name</label>
          <input {...register('name', { required: true })} className="input" />
        </div>
        <div>
          <label className="label">Category</label>
          <select {...register('category_id')} className="input">
            {flatCats.map((c: any) => (
              <option key={c.id} value={c.id}>{'  '.repeat(c.depth)}{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Short description</label>
          <textarea {...register('short_description')} rows={2} className="input" />
        </div>
        <div>
          <label className="label">Full description</label>
          <textarea {...register('full_description')} rows={6} className="input" />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="btn-primary gap-2">
            {loading && <Loader2 size={15} className="animate-spin" />}Save changes
          </button>
          <Link href="/seller/products" className="btn-secondary">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
