'use client';
// frontend/src/app/(public)/contact/ContactForm.tsx
// Client component — extracted from contact/page.tsx so the outer
// page can remain a server component (better SEO, CMS fetch).

import { useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import toast from 'react-hot-toast';

interface FormState {
  name:    string;
  email:   string;
  subject: string;
  message: string;
}

const INITIAL: FormState = { name: '', email: '', subject: '', message: '' };

export function ContactForm() {
  const [form,    setForm]    = useState<FormState>(INITIAL);
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // In production: replace with a real API call
    await new Promise(r => setTimeout(r, 600));
    setLoading(false);
    setSent(true);
    toast.success("Message sent! We'll reply within 24 hours.");
  };

  const f = (k: keyof FormState) => ({
    value:    form[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value })),
  });

  if (sent) return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-5">Send a message</h2>
      <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
        <p className="text-green-700 font-medium mb-1">Message sent!</p>
        <p className="text-green-600 text-sm">We&apos;ll get back to you within 24 hours.</p>
        <button
          onClick={() => { setSent(false); setForm(INITIAL); }}
          className="btn-secondary mt-4 text-sm"
        >
          Send another message
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-5">Send a message</h2>
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
          <input
            {...f('subject')}
            className="input"
            placeholder="Order issue, account help, partnership…"
            required
          />
        </div>
        <div>
          <label className="label">Message</label>
          <textarea
            {...f('message')}
            rows={5}
            className="input"
            placeholder="Describe your issue or question in detail…"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full py-2.5 gap-2"
        >
          {loading
            ? <><Loader2 size={15} className="animate-spin" />Sending…</>
            : <><Send size={15} />Send message</>
          }
        </button>
      </form>
    </div>
  );
}