'use client';
// src/app/(public)/contact/page.tsx
// Req 3.4.7: CMS static page — Contact
import type { Metadata } from 'next';
import { Mail, Phone, MapPin, Clock } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In production this would call an API endpoint
    setSent(true);
    toast.success('Message sent! We\'ll reply within 24 hours.');
  };

  const f = (k: keyof typeof form) => ({
    value: form[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value })),
  });

  return (
    <div className="container-page py-12 max-w-4xl">
      <h1 className="text-3xl font-semibold text-gray-900 mb-2">Contact us</h1>
      <p className="text-gray-500 mb-10">We&apos;re here to help. Reach out to us any time.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* Contact info */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-5">Get in touch</h2>
          <div className="space-y-4">
            {[
              { icon: Mail,    label: 'Email',   value: 'support@marketplace.et', href: 'mailto:support@marketplace.et' },
              { icon: Phone,   label: 'Phone',   value: '+251 11 XXX XXXX',        href: 'tel:+25111XXXXXXX' },
              { icon: MapPin,  label: 'Address', value: 'Bole Road, Addis Ababa, Ethiopia', href: null },
              { icon: Clock,   label: 'Hours',   value: 'Mon–Fri, 9am–6pm EAT',   href: null },
            ].map(({ icon: Icon, label, value, href }) => (
              <div key={label} className="flex items-start gap-3">
                <div className="w-9 h-9 bg-violet-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon size={17} className="text-violet-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
                  {href
                    ? <a href={href} className="text-sm text-violet-600 hover:text-violet-800">{value}</a>
                    : <p className="text-sm text-gray-700">{value}</p>
                  }
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 p-4 bg-violet-50 rounded-xl">
            <p className="text-sm font-medium text-violet-900 mb-1">Seller support</p>
            <p className="text-xs text-violet-700">For seller-specific inquiries: <a href="mailto:sellers@marketplace.et" className="font-medium underline">sellers@marketplace.et</a></p>
          </div>
        </div>

        {/* Contact form */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-5">Send a message</h2>
          {sent ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
              <p className="text-green-700 font-medium mb-1">Message sent!</p>
              <p className="text-green-600 text-sm">We&apos;ll get back to you within 24 hours.</p>
              <button onClick={() => { setSent(false); setForm({ name: '', email: '', subject: '', message: '' }); }}
                className="btn-secondary mt-4 text-sm">Send another message</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Your name</label>
                  <input {...f('name')} className="input" placeholder="Abebe Kebede" required />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input {...f('email')} type="email" className="input" placeholder="you@example.com" required />
                </div>
              </div>
              <div>
                <label className="label">Subject</label>
                <input {...f('subject')} className="input" placeholder="Order issue, account help, partnership..." required />
              </div>
              <div>
                <label className="label">Message</label>
                <textarea {...f('message')} rows={5} className="input" placeholder="Describe your issue or question in detail..." required />
              </div>
              <button type="submit" className="btn-primary w-full py-2.5">Send message</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
