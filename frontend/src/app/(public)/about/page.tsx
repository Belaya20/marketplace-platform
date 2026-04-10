// src/app/(public)/about/page.tsx
// Req 3.4.7: CMS static page — About Us (content managed from Admin > CMS)
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'About us' };

export default function AboutPage() {
  return (
    <div className="container-page py-12 max-w-3xl">
      <h1 className="text-3xl font-semibold text-gray-900 mb-6">About us</h1>
      <div className="prose prose-gray max-w-none text-gray-600 leading-relaxed space-y-4">
        <p className="text-lg text-gray-700">
          AddisMarket is Ethiopia&apos;s premier multi-vendor e-commerce platform, connecting thousands of buyers
          and verified sellers across the country.
        </p>
        <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">Our mission</h2>
        <p>
          We believe every Ethiopian entrepreneur deserves a powerful, easy-to-use platform to reach customers
          nationwide. Our mission is to democratize commerce by giving sellers the tools they need to grow their
          business online, and buyers a safe, convenient place to shop.
        </p>
        <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">What we offer</h2>
        <ul className="space-y-2 text-gray-600">
          <li> Thousands of verified sellers across all categories</li>
          <li> Secure payments via Chapa — Telebirr, CBE Birr, bank transfer</li>
          <li> Cash on delivery across major cities</li>
          <li> Easy returns and buyer protection</li>
          <li> Fast delivery through trusted logistics partners</li>
        </ul>
        <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">Become a seller</h2>
        <p>
          Are you a business owner or entrepreneur? Register your store on AddisMarket and reach customers
          across Ethiopia. Our seller tools make it easy to manage products, track orders, and grow your business.
        </p>
        <div className="mt-6">
          <a href="/register/seller"
            className="inline-flex items-center justify-center px-6 py-3 bg-violet-600 text-white font-medium rounded-lg hover:bg-violet-700 transition-colors">
            Register as a seller →
          </a>
        </div>
      </div>
    </div>
  );
}
