// src/app/(public)/terms/page.tsx
// Req 3.4.7: CMS static page — Terms & Conditions
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Terms & conditions' };

export default function TermsPage() {
  return (
    <div className="container-page py-12 max-w-3xl">
      <h1 className="text-3xl font-semibold text-gray-900 mb-2">Terms & conditions</h1>
      <p className="text-sm text-gray-400 mb-8">Last updated: January 2025</p>

      <div className="space-y-8 text-gray-600 leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">1. Acceptance of terms</h2>
          <p>By accessing or using Marketplace, you agree to be bound by these Terms and Conditions and our Privacy Policy. If you do not agree to these terms, please do not use our platform.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">2. Buyer terms</h2>
          <ul className="space-y-2">
            <li>• You must be at least 18 years old to create an account and make purchases</li>
            <li>• You agree to provide accurate and complete information when placing orders</li>
            <li>• You are responsible for all activity that occurs under your account</li>
            <li>• Payment is due at the time of placing an order</li>
            <li>• You agree to inspect goods upon delivery and report any issues within 48 hours</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">3. Seller terms</h2>
          <ul className="space-y-2">
            <li>• Sellers must register and receive approval before listing products</li>
            <li>• All products must comply with Ethiopian law and our product policies</li>
            <li>• Sellers must maintain accurate stock levels and pricing</li>
            <li>• Orders must be fulfilled within the agreed timeframe</li>
            <li>• Marketplace collects a commission on each sale as specified in the seller agreement</li>
            <li>• Seller accounts found listing counterfeit or prohibited items will be permanently suspended</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">4. Payments</h2>
          <p>All payments are processed securely through Chapa. By making a purchase, you agree to Chapa&apos;s terms of service. Marketplace does not store your full payment card details.</p>
          <p className="mt-3">For cash on delivery orders, payment must be made in full upon receipt of goods. Refusal to pay upon delivery may result in account suspension.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">5. Returns & refunds</h2>
          <p>Buyers may request returns within 7 days of delivery for items that are defective, damaged, or significantly different from the listing description. Sellers may set their own return policies within our platform guidelines.</p>
          <p className="mt-3">Refunds are processed within 5–10 business days after the return is approved. Refunds for Chapa payments are returned to the original payment method.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">6. Prohibited activities</h2>
          <ul className="space-y-2">
            <li>• Listing or selling counterfeit, stolen, or illegal goods</li>
            <li>• Creating fake reviews or manipulating ratings</li>
            <li>• Circumventing the platform to conduct off-platform transactions</li>
            <li>• Using the platform for money laundering or fraudulent activity</li>
            <li>• Harassment or abuse of other users or our support team</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">7. Limitation of liability</h2>
          <p>Marketplace acts as an intermediary between buyers and sellers. We are not liable for the quality, safety, legality, or availability of products listed by third-party sellers. We encourage buyers to review seller ratings and product descriptions carefully before purchasing.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">8. Changes to terms</h2>
          <p>We reserve the right to update these terms at any time. We will notify registered users of material changes via email. Continued use of the platform after changes constitutes acceptance of the new terms.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">9. Contact</h2>
          <p>For questions about these terms, contact <a href="mailto:legal@marketplace.et" className="text-violet-600 hover:text-violet-800">legal@marketplace.et</a></p>
        </section>
      </div>
    </div>
  );
}
