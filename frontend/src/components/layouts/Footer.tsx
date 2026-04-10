'use client';
// src/components/layouts/Footer.tsx
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Mail, Phone, MapPin,
  Facebook, Twitter, Instagram, Youtube,
  Send, CheckCircle2, ChevronDown, ChevronUp,
  Truck, Shield, RefreshCw, Headphones, ArrowUp,
} from 'lucide-react';
import clsx from 'clsx';
import Logo from '@/components/ui/Logo';

const GOLD    = '#F5A623';
const BLUE    = '#1A6BFF';
const TEXT    = '#94A3B8';
const WHITE   = '#F1F5F9';
const DIVIDER = 'rgba(255,255,255,0.09)';
const BG      = 'linear-gradient(135deg, #0D1F4E 0%, #112060 35%, #0E1A50 65%, #0A1535 100%)';

// ── Inline newsletter (slim, for bottom bar) ──────────────────────────────────
function NewsletterInline() {
  const [email,  setEmail]  = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'err'>('idle');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = email.trim();
    if (!v || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { setStatus('err'); return; }
    setStatus('loading');
    await new Promise(r => setTimeout(r, 700));
    setStatus('done'); setEmail('');
  };

  if (status === 'done') return (
    <div className="flex items-center gap-2 rounded-xl px-4 py-2.5"
      style={{ background: 'rgba(26,107,255,0.12)', border: '1px solid rgba(26,107,255,0.25)' }}>
      <CheckCircle2 size={14} style={{ color: GOLD }} className="shrink-0" />
      <p className="text-sm font-medium" style={{ color: '#93C5FD' }}>Subscribed!</p>
    </div>
  );

  return (
    <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2 w-full sm:max-w-sm">
      <input
        type="email" value={email}
        onChange={e => { setEmail(e.target.value); if (status === 'err') setStatus('idle'); }}
        placeholder="your@email.com"
        className="flex-1 text-sm rounded-xl px-4 py-2 outline-none text-white placeholder:text-slate-500 transition-colors duration-200"
        style={{
          background: 'rgba(255,255,255,0.07)',
          border:     `1px solid ${status === 'err' ? '#F87171' : DIVIDER}`,
        }}
        onFocus={e => { e.currentTarget.style.borderColor = `${GOLD}70`; }}
        onBlur={e  => { e.currentTarget.style.borderColor = status === 'err' ? '#F87171' : DIVIDER; }}
      />
      <button type="submit" disabled={status === 'loading'}
        className="flex items-center justify-center gap-1.5 text-sm font-bold px-5 py-2 rounded-xl transition-all duration-200 active:scale-[0.98] disabled:opacity-60 whitespace-nowrap"
        style={{ background: GOLD, color: '#0D1F4E' }}>
        {status === 'loading'
          ? <span className="w-4 h-4 border-2 rounded-full animate-spin"
              style={{ borderColor: 'rgba(13,31,78,0.3)', borderTopColor: '#0D1F4E' }} />
          : <><Send size={12} />Subscribe</>}
      </button>
      {status === 'err' && (
        <p className="text-xs text-red-400 sm:hidden">Valid email required.</p>
      )}
    </form>
  );
}

// ── Mobile accordion section ──────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between py-2 sm:py-0 sm:cursor-default sm:pointer-events-none"
      >
        <h4 className="text-[11px] font-black uppercase tracking-[0.15em]" style={{ color: '#64748B' }}>
          {title}
        </h4>
        <span className="sm:hidden" style={{ color: TEXT }}>
          {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </span>
      </button>
      <ul className={clsx('mt-4 space-y-2.5', !open && 'hidden sm:block')}>
        {children}
      </ul>
    </div>
  );
}

// ── Footer link ───────────────────────────────────────────────────────────────
function FLink({ href, children, badge }: {
  href: string; children: React.ReactNode; badge?: string;
}) {
  return (
    <li>
      <Link href={href}
        className="group flex items-center gap-2 text-sm py-0.5 transition-colors duration-150"
        style={{ color: TEXT }}
        onMouseEnter={e => (e.currentTarget.style.color = WHITE)}
        onMouseLeave={e => (e.currentTarget.style.color = TEXT)}
      >
        <span className="block h-px rounded-full shrink-0 transition-all duration-200"
          style={{ width: 0, background: GOLD }}
          ref={el => {
            if (!el) return;
            const a = el.closest('a');
            if (!a) return;
            a.addEventListener('mouseenter', () => { el.style.width = '8px'; });
            a.addEventListener('mouseleave', () => { el.style.width = '0px'; });
          }}
        />
        <span className="flex-1">{children}</span>
        {badge && (
          <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full shrink-0"
            style={{ background: `${GOLD}20`, color: GOLD, border: `1px solid ${GOLD}30` }}>
            {badge}
          </span>
        )}
      </Link>
    </li>
  );
}

const TRUST = [
  { icon: Truck,      title: 'Fast delivery',   sub: 'Nationwide shipping'   },
  { icon: Shield,     title: 'Secure payment',  sub: 'Chapa & bank transfer' },
  { icon: RefreshCw,  title: 'Easy returns',    sub: '7-day return policy'   },
  { icon: Headphones, title: '24/7 support',    sub: 'Always here for you'   },
];

const SOCIALS = [
  { icon: Facebook,  href: '#', label: 'Facebook'  },
  { icon: Twitter,   href: '#', label: 'Twitter'   },
  { icon: Instagram, href: '#', label: 'Instagram' },
  { icon: Youtube,   href: '#', label: 'YouTube'   },
];

function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const f = () => setShow(window.scrollY > 500);
    window.addEventListener('scroll', f, { passive: true });
    return () => window.removeEventListener('scroll', f);
  }, []);
  if (!show) return null;
  return (
    <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-6 right-6 z-50 w-10 h-10 rounded-2xl shadow-2xl flex items-center justify-center transition-all duration-200 active:scale-95 hover:scale-110"
      style={{ background: GOLD, color: '#0D1F4E' }} aria-label="Back to top">
      <ArrowUp size={16} strokeWidth={2.5} />
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function Footer() {
  return (
    <>
      <BackToTop />
      <footer className="mt-16" style={{ background: BG, color: TEXT }}>

        {/* Top glow line */}
        <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${BLUE}60, ${GOLD}50, ${BLUE}60, transparent)` }} />

        {/* ── 1. Trust strip ── */}
        <div style={{ borderBottom: `1px solid ${DIVIDER}` }}>
          <div className="container-page py-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
              {TRUST.map(t => (
                <div key={t.title} className="flex items-center gap-3 group">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110"
                    style={{ background: 'rgba(26,107,255,0.12)', border: 'rgba(26,107,255,0.22)' }}>
                    <t.icon size={16} strokeWidth={1.8} style={{ color: GOLD }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold leading-tight" style={{ color: WHITE }}>{t.title}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: TEXT }}>{t.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── 2. Main grid ── */}
        <div className="container-page py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-6">

            {/* Brand */}
            <div className="lg:col-span-2 space-y-6">
              <Logo variant="dark" size="md" href="/" />
              <p className="text-sm leading-relaxed max-w-[280px]" style={{ color: TEXT }}>
                Ethiopia's premier multi-vendor marketplace — connecting buyers with
                thousands of verified sellers across the country.
              </p>
              <div className="space-y-2.5">
                {[
                  { icon: Mail,   href: 'mailto:support@addismarket.et', label: 'support@addismarket.et' },
                  { icon: Phone,  href: 'tel:+251911000000',             label: '+251 911 000 000'        },
                  { icon: MapPin, href: '#',                             label: 'Bole, Addis Ababa'       },
                ].map(c => (
                  <a key={c.label} href={c.href}
                    className="flex items-center gap-2.5 text-sm transition-colors duration-150"
                    style={{ color: TEXT }}
                    onMouseEnter={e => (e.currentTarget.style.color = WHITE)}
                    onMouseLeave={e => (e.currentTarget.style.color = TEXT)}>
                    <c.icon size={13} style={{ color: GOLD }} className="shrink-0" />
                    {c.label}
                  </a>
                ))}
              </div>
              <div className="flex items-center gap-2">
                {SOCIALS.map(s => (
                  <a key={s.label} href={s.href} aria-label={s.label}
                    className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95"
                    style={{ background: 'rgba(255,255,255,0.07)', border: `1px solid ${DIVIDER}`, color: TEXT }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = `${BLUE}22`;
                      (e.currentTarget as HTMLElement).style.borderColor = `${BLUE}50`;
                      (e.currentTarget as HTMLElement).style.color = WHITE;
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)';
                      (e.currentTarget as HTMLElement).style.borderColor = DIVIDER;
                      (e.currentTarget as HTMLElement).style.color = TEXT;
                    }}>
                    <s.icon size={14} />
                  </a>
                ))}
              </div>
            </div>

            {/* Customer */}
            <Section title="Customer">
              <FLink href="/account/orders">My orders</FLink>
              <FLink href="/account/wishlist">Wishlist</FLink>
              <FLink href="/account/returns">Returns</FLink>
              <FLink href="/account/reviews">My reviews</FLink>
              <FLink href="/account/notifications">Notifications</FLink>
              <FLink href="/account/profile">My account</FLink>
            </Section>

            {/* Sellers */}
            <Section title="Sellers">
              <FLink href="/register/seller" badge="Join">Become a seller</FLink>
              <FLink href="/seller/dashboard">Dashboard</FLink>
              <FLink href="/seller/products">My products</FLink>
              <FLink href="/seller/orders">My orders</FLink>
              <FLink href="/seller/promotions">Promotions</FLink>
              <FLink href="/seller/wallet">Wallet</FLink>
            </Section>

            {/* Company */}
            <Section title="Company">
              <FLink href="/about">About us</FLink>
              <FLink href="/contact">Contact</FLink>
              <FLink href="/privacy">Privacy policy</FLink>
              <FLink href="/terms">Terms & conditions</FLink>
            </Section>
          </div>
        </div>

        {/* ── 3. Newsletter + copyright strip ── */}
        <div style={{ borderTop: `1px solid ${DIVIDER}` }}>
          <div className="container-page py-4 flex flex-col sm:flex-row items-center justify-between gap-3">

            {/* Newsletter left */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <p className="text-sm font-semibold whitespace-nowrap" style={{ color: WHITE }}>
                Stay in the loop
              </p>
              <NewsletterInline />
            </div>

            {/* Copyright right */}
            <p className="text-xs whitespace-nowrap text-center sm:text-right" style={{ color: '#475569' }}>
              © {new Date().getFullYear()} AddisMarket. All rights reserved.
            </p>

          </div>
        </div>

      </footer>
    </>
  );
}