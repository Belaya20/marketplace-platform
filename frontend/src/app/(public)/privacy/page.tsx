// src/app/(public)/privacy/page.tsx
// Req 3.4.7: CMS static page — Privacy Policy
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Privacy policy' };

export default function PrivacyPage() {
  return (
    <div className="container-page py-12 max-w-3xl">
      <h1 className="text-3xl font-semibold text-gray-900 mb-2">Privacy policy</h1>
      <p className="text-sm text-gray-400 mb-8">Last updated: January 2025</p>

      <div className="space-y-8 text-gray-600 leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">1. Information we collect</h2>
          <p>We collect information you provide directly to us when you create an account, make a purchase, or contact our support team. This includes your name, email address, phone number, delivery addresses, and payment information.</p>
          <p className="mt-3">We also automatically collect certain information when you use our platform, including your IP address, browser type, device information, and browsing activity on our site.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">2. How we use your information</h2>
          <ul className="space-y-2">
            <li>✓ Process and fulfil your orders</li>
            <li>✓ Send order confirmations, updates, and delivery notifications</li>
            <li>✓ Provide customer support</li>
            <li>✓ Send promotional communications (with your consent)</li>
            <li>✓ Improve our platform and services</li>
            <li>✓ Detect and prevent fraud and security issues</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">3. Information sharing</h2>
          <p>We do not sell your personal information to third parties. We share your information only with:</p>
          <ul className="space-y-2 mt-3">
            <li>• <strong>Sellers</strong> — order details necessary to fulfil your purchase</li>
            <li>• <strong>Payment processors</strong> — Chapa, to process your payments securely</li>
            <li>• <strong>Logistics partners</strong> — delivery address and contact details for shipping</li>
            <li>• <strong>Legal authorities</strong> — when required by Ethiopian law</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">4. Data security</h2>
          <p>We use industry-standard security measures including HTTPS encryption, secure password hashing, and role-based access controls to protect your personal information from unauthorised access, use, or disclosure.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">5. Your rights</h2>
          <p>You have the right to access, correct, or delete your personal information at any time from your account settings. You may also opt out of marketing communications by following the unsubscribe link in any email we send.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">6. Cookies</h2>
          <p>We use cookies and similar technologies to maintain your session, remember your preferences, and analyse how our platform is used. You can control cookies through your browser settings.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">7. Contact us</h2>
          <p>For privacy-related questions or requests, contact our Data Protection team at <a href="mailto:privacy@marketplace.et" className="text-violet-600 hover:text-violet-800">privacy@marketplace.et</a></p>
        </section>
      </div>
    </div>
  );
}
