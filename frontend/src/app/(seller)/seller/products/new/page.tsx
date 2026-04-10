'use client';

// src/app/(seller)/seller/products/new/page.tsx
import { useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useFieldArray, useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { catalogApi, productApi } from '@/lib/api';
import { Plus, Trash2, Loader2, ChevronLeft, ImagePlus, X, Link2, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import Image from 'next/image';

// ── Types ───────────────────────────────────────────────────────────────────
interface ProductImage {
  url: string;
  preview: string;
  alt_text: string;
  source: 'url' | 'file';
}

interface Variant {
  sku: string;
  price: number | string;
  discount_price?: number | string;
  stock_qty: number;
  weight_kg?: number | string;
  attributes?: Record<string, string>;
}

interface ProductFormValues {
  name: string;
  category_id: string;
  brand_id?: string;
  short_description?: string;
  full_description?: string;
  tags?: string;
  variants: Variant[];
}

interface Category {
  id: string;
  name: string;
  children?: Category[];
}

interface FlatCategory extends Category {
  depth: number;
}

// ── Image Manager ───────────────────────────────────────────────────────────
function ImageManager({
  images,
  onChange,
}: {
  images: ProductImage[];
  onChange: (imgs: ProductImage[]) => void;
}) {
  const [urlInput, setUrlInput] = useState('');
  const [urlMode, setUrlMode] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const addUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    if (!/^https?:\/\/.+/.test(trimmed)) {
      toast.error('Please enter a valid URL starting with http:// or https://');
      return;
    }
    if (images.length >= 6) {
      toast.error('Maximum 6 images allowed');
      return;
    }
    onChange([...images, { url: trimmed, preview: trimmed, alt_text: '', source: 'url' }]);
    setUrlInput('');
    setUrlMode(false);
  };

  const addFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const remaining = 6 - images.length;
    if (remaining <= 0) {
      toast.error('Maximum 6 images allowed');
      return;
    }

    const validFiles = files.slice(0, remaining).filter(file => {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image`);
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 5MB limit`);
        return false;
      }
      return true;
    });

    try {
      // Process all files concurrently to prevent state-overwrite race conditions
      const newImages = await Promise.all(
        validFiles.map((file) => {
          return new Promise<ProductImage>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
              const dataUrl = ev.target?.result as string;
              resolve({
                url: dataUrl,
                preview: dataUrl,
                alt_text: file.name.replace(/\.[^.]+$/, ''),
                source: 'file',
              });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        })
      );

      onChange([...images, ...newImages]);
    } catch (err) {
      toast.error('Failed to process one or more images');
    } finally {
      e.target.value = ''; // Reset input
    }
  };

  const remove = (idx: number) => onChange(images.filter((_, i) => i !== idx));

  const moveFirst = (idx: number) => {
    if (idx === 0) return;
    const next = [...images];
    const [item] = next.splice(idx, 1);
    next.unshift(item);
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {images.map((img, i) => (
          <div
            key={i}
            className="relative group aspect-square rounded-xl overflow-hidden border-2 border-gray-200 hover:border-violet-500 transition-all cursor-pointer bg-gray-50 shadow-sm"
            onClick={() => moveFirst(i)}
            title={i === 0 ? 'Primary image' : 'Click to set as primary'}
          >
            <Image
              src={img.preview}
              alt={img.alt_text || `Image ${i + 1}`}
              fill
              className="object-cover"
              unoptimized={img.source === 'file'}
            />
            {i === 0 && (
              <span className="absolute top-2 left-2 bg-violet-600/90 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-md leading-none shadow-sm">
                Primary
              </span>
            )}
            <span
              className={`absolute bottom-2 left-2 text-[10px] font-bold px-2 py-1 rounded-md leading-none shadow-sm ${
                img.source === 'url' ? 'bg-blue-500/90 text-white' : 'bg-emerald-500/90 text-white'
              }`}
            >
              {img.source === 'url' ? 'URL' : 'File'}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                remove(i);
              }}
              className="absolute top-2 right-2 w-6 h-6 bg-red-500/90 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-sm transform scale-90 group-hover:scale-100"
            >
              <X size={12} strokeWidth={3} />
            </button>
          </div>
        ))}

        {images.length < 6 && (
          <div
            className="aspect-square rounded-xl border-2 border-dashed border-gray-300 hover:border-violet-400 hover:bg-violet-50 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer bg-gray-50/50"
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus size={20} className="text-gray-400" />
            <span className="text-[11px] text-gray-500 font-medium">Add image</span>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-500">
        {images.length === 0
          ? 'No images added yet. The first image will be used as the primary listing image.'
          : 'Click any image to set it as primary. Drag or re-click to reorder.'}
      </p>

      <div className="flex gap-3 flex-wrap items-center">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={images.length >= 6}
          className="btn-secondary text-xs py-2 px-4 gap-2 disabled:opacity-50 transition-all"
        >
          <Upload size={14} /> Upload from device
        </button>

        <button
          type="button"
          onClick={() => setUrlMode((m) => !m)}
          disabled={images.length >= 6}
          className="btn-secondary text-xs py-2 px-4 gap-2 disabled:opacity-50 transition-all"
        >
          <Link2 size={14} /> Add from URL
        </button>

        <span className="text-xs font-medium text-gray-400 ml-auto">
          {images.length}/6 images
        </span>
      </div>

      {urlMode && (
        <div className="flex gap-2 p-3 bg-gray-50/80 rounded-xl border border-gray-200 animate-in fade-in slide-in-from-top-2">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addUrl())}
            className="input flex-1 text-sm bg-white"
            placeholder="https://example.com/product-image.jpg"
            autoFocus
          />
          <button type="button" onClick={addUrl} className="btn-primary text-xs px-5">
            Add
          </button>
          <button
            type="button"
            onClick={() => {
              setUrlMode(false);
              setUrlInput('');
            }}
            className="btn-secondary text-xs px-4"
          >
            Cancel
          </button>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={addFiles}
      />
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function NewProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<ProductImage[]>([]);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ProductFormValues>({
    defaultValues: {
      variants: [{ sku: '', price: '', discount_price: '', stock_qty: 0, weight_kg: 0 }],
    },
  });
  
  const { fields, append, remove } = useFieldArray({ control, name: 'variants' });

  // API Queries
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: catalogApi.getCategories,
  });
  const { data: brands = [] } = useQuery<any[]>({
    queryKey: ['brands'],
    queryFn: catalogApi.getBrands,
  });
  const { data: attributes = [] } = useQuery<any[]>({
    queryKey: ['attributes'],
    queryFn: catalogApi.getAttributes,
  });

  // Memoized Category Flattening for performance
  const flatCats = useMemo(() => {
    const result: FlatCategory[] = [];
    const flatten = (cats: Category[], depth = 0) => {
      cats.forEach((c) => {
        result.push({ ...c, depth });
        if (c.children?.length) flatten(c.children, depth + 1);
      });
    };
    flatten(categories);
    return result;
  }, [categories]);

  const onSubmit = async (data: ProductFormValues) => {
    if (images.length === 0) {
      toast.error('Please add at least one product image');
      return;
    }
    
    setLoading(true);
    try {
      const payload = {
        ...data,
        brand_id: data.brand_id || undefined,
        tags: data.tags
          ? data.tags.split(',').map((t) => t.trim()).filter(Boolean)
          : [],
        images: images.map((img) => ({
          url: img.url,
          alt_text: img.alt_text || data.name,
        })),
        variants: data.variants.map((v) => ({
          ...v,
          price: Number(v.price),
          discount_price: v.discount_price ? Number(v.discount_price) : undefined,
          stock_qty: Number(v.stock_qty),
          weight_kg: Number(v.weight_kg) || 0,
        })),
      };

      await productApi.createProduct(payload);
      toast.success('Product submitted for review');
      router.push('/seller/products');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <div className="flex items-center gap-3">
        <Link
          href="/seller/products"
          className="p-2 text-gray-400 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Add new product</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Info Card */}
        <div className="card p-6 space-y-5 bg-white rounded-2xl shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-900 text-base border-b border-gray-100 pb-3">
            Basic information
          </h2>

          <div>
            <label className="label font-medium text-gray-700">Product name <span className="text-red-500">*</span></label>
            <input
              {...register('name', {
                required: 'Name is required',
                minLength: { value: 3, message: 'Min 3 characters' },
              })}
              className="input mt-1.5"
              placeholder="e.g. Samsung Galaxy A54 5G"
            />
            {errors.name && <p className="text-red-500 text-xs mt-1.5">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="label font-medium text-gray-700">Category <span className="text-red-500">*</span></label>
              <select
                {...register('category_id', { required: 'Select a category' })}
                className="input mt-1.5"
              >
                <option value="">Select category</option>
                {flatCats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {'\u00A0\u00A0'.repeat(c.depth)}
                    {c.name}
                  </option>
                ))}
              </select>
              {errors.category_id && (
                <p className="text-red-500 text-xs mt-1.5">{errors.category_id.message}</p>
              )}
            </div>
            <div>
              <label className="label font-medium text-gray-700">Brand <span className="text-gray-400 font-normal">(optional)</span></label>
              <select {...register('brand_id')} className="input mt-1.5">
                <option value="">No brand</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label font-medium text-gray-700">Short description</label>
            <textarea
              {...register('short_description')}
              rows={2}
              className="input mt-1.5 resize-none"
              placeholder="Brief product summary shown in listings"
            />
          </div>
          
          <div>
            <label className="label font-medium text-gray-700">Full description</label>
            <textarea
              {...register('full_description')}
              rows={5}
              className="input mt-1.5"
              placeholder="Detailed product description, features, specs..."
            />
          </div>

          <div>
            <label className="label font-medium text-gray-700">Tags <span className="text-gray-400 font-normal">(comma separated)</span></label>
            <input
              {...register('tags')}
              className="input mt-1.5"
              placeholder="wireless, bluetooth, samsung, electronics"
            />
          </div>
        </div>

        {/* Images Card */}
        <div className="card p-6 space-y-5 bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="border-b border-gray-100 pb-3">
            <h2 className="font-semibold text-gray-900 text-base">Product images <span className="text-red-500">*</span></h2>
            <p className="text-sm text-gray-500 mt-1">
              Upload from your device or add image URLs. First image is the primary listing image.
            </p>
          </div>
          <ImageManager images={images} onChange={setImages} />
        </div>

        {/* Variants Card */}
        <div className="card p-6 space-y-5 bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
            <div>
              <h2 className="font-semibold text-gray-900 text-base">Variants</h2>
              <p className="text-sm text-gray-500 mt-1">
                Each variant has its own SKU, price, and stock level.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                append({ sku: '', price: '', discount_price: '', stock_qty: 0, weight_kg: 0 })
              }
              className="btn-secondary text-sm py-2 px-4 gap-2 whitespace-nowrap"
            >
              <Plus size={16} /> Add variant
            </button>
          </div>

          <div className="space-y-4">
            {fields.map((field, idx) => (
              <div
                key={field.id}
                className="border border-gray-200 bg-gray-50/30 rounded-xl p-5 space-y-4 relative group transition-all hover:border-gray-300"
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md bg-gray-100 text-xs font-semibold text-gray-600">
                    {idx === 0 ? 'Default Variant' : `Variant ${idx + 1}`}
                  </span>
                  {idx > 0 && (
                    <button
                      type="button"
                      onClick={() => remove(idx)}
                      className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                      title="Remove variant"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="label text-xs font-semibold text-gray-600 uppercase tracking-wider">SKU <span className="text-red-500">*</span></label>
                    <input
                      {...register(`variants.${idx}.sku`, { required: true })}
                      className="input text-sm font-mono mt-1.5"
                      placeholder="SKU-001"
                    />
                  </div>
                  <div>
                    <label className="label text-xs font-semibold text-gray-600 uppercase tracking-wider">Price (ETB) <span className="text-red-500">*</span></label>
                    <input
                      {...register(`variants.${idx}.price`, { required: true, min: 0.01 })}
                      type="number"
                      step="0.01"
                      className="input text-sm mt-1.5"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="label text-xs font-semibold text-gray-600 uppercase tracking-wider">Discount Price</label>
                    <input
                      {...register(`variants.${idx}.discount_price`)}
                      type="number"
                      step="0.01"
                      className="input text-sm mt-1.5"
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label className="label text-xs font-semibold text-gray-600 uppercase tracking-wider">Stock Qty <span className="text-red-500">*</span></label>
                    <input
                      {...register(`variants.${idx}.stock_qty`, { required: true, min: 0 })}
                      type="number"
                      className="input text-sm mt-1.5"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div>
                  <label className="label text-xs font-semibold text-gray-600 uppercase tracking-wider">Weight (kg)</label>
                  <input
                    {...register(`variants.${idx}.weight_kg`)}
                    type="number"
                    step="0.001"
                    className="input text-sm w-full sm:w-48 mt-1.5"
                    placeholder="0.000"
                  />
                </div>

                {attributes.length > 0 && (
                  <div className="pt-2 border-t border-gray-200">
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">
                      Variant Attributes
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {attributes.map((attr) => (
                        <div key={attr.id}>
                          <label className="label text-xs text-gray-500 mb-1.5">{attr.display_name}</label>
                          {/* BUG FIX: Previously this select was missing the hook-form register call! */}
                          <select
                            {...register(`variants.${idx}.attributes.${attr.id}`)}
                            className="input text-sm bg-white"
                          >
                            <option value="">None</option>
                            {(attr.values ?? []).map((v: any) => (
                              <option key={v.id} value={v.id}>
                                {v.display_value}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary py-2.5 px-8 text-sm font-semibold rounded-xl shadow-sm hover:shadow transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Submitting...
              </>
            ) : (
              'Submit for review'
            )}
          </button>
          <Link
            href="/seller/products"
            className="btn-secondary py-2.5 px-6 text-sm font-semibold rounded-xl transition-all"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}