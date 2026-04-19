'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Mail, Phone, MapPin,
  Facebook, Twitter, Instagram, Youtube,
  Truck, Shield, RefreshCw, Headphones, ArrowUp,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import clsx from 'clsx';
import Logo from '@/components/ui/Logo';

const TRUST = [
  { icon: Truck,      title: 'Fast delivery',  sub: 'Nationwide shipping'   },
  { icon: Shield,     title: 'Secure payment', sub: 'Chapa & bank transfer' },
  { icon: RefreshCw,  title: 'Easy returns',   sub: '7-day return policy'   },
  { icon: Headphones, title: '24/7 support',   sub: 'Always here for you'   },
];

const SOCIALS = [
  { icon: Facebook,  href: '#', label: 'Facebook'  },
  { icon: Twitter,   href: '#', label: 'Twitter'   },
  { icon: Instagram, href: '#', label: 'Instagram' },
  { icon: Youtube,   href: '#', label: 'YouTube'   },
];

const CONTACT_ITEMS = [
  { icon: Mail,   href: 'mailto:support@addismarket.et', label: 'support@addismarket.et' },
  { icon: Phone,  href: 'tel:+251911000000',             label: '+251 911 000 000'       },
  { icon: MapPin, href: '#',                             label: 'Bole, Addis Ababa'      },
];

function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handle = () => setVisible(window.scrollY > 500);
    window.addEventListener('scroll', handle, { passive: true });
    return () => window.removeEventListener('scroll', handle);
  }, []);

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Back to top"
      className={clsx(
        'fixed bottom-6 right-5 sm:right-6 z-50 w-10 h-10 rounded-2xl shadow-2xl',
        'flex items-center justify-center',
        'bg-[#F5A623] text-[#0D1F4E]',
        'transition-all duration-300 hover:scale-110 active:scale-95',
        visible ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-3 pointer-events-none',
      )}
    >
      <ArrowUp size={16} strokeWidth={2.5} />
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-center sm:justify-start gap-2 py-2 sm:py-0 sm:cursor-default"
        aria-expanded={open}
      >
        <h4 className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-500">
          {title}
        </h4>
        <span className="sm:hidden text-slate-500">
          {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </span>
      </button>

      <ul className={clsx(
        'mt-4 space-y-1',
        'sm:block',
        open ? 'block' : 'hidden',
      )}>
        {children}
      </ul>
    </div>
  );
}

function FLink({ href, children, badge }: {
  href: string; children: React.ReactNode; badge?: string;
}) {
  return (
    <li className="flex justify-center sm:justify-start">
      <Link
        href={href}
        className={clsx(
          'group inline-flex items-center gap-2 text-sm py-1',
          'text-slate-400 hover:text-slate-100 transition-colors duration-150',
        )}
      >
        <span className={clsx(
          'block h-px rounded-full shrink-0 bg-[#F5A623]',
          'w-0 group-hover:w-2 transition-all duration-200',
        )} />
        <span className="flex-1">{children}</span>
        {badge && (
          <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full shrink-0 bg-[#F5A62320] text-[#F5A623] border border-[#F5A62330]">
            {badge}
          </span>
        )}
      </Link>
    </li>
  );
}

export default function Footer() {
  return (
    <>
      <BackToTop />

      <footer
        className="mt-16 text-slate-400"
        style={{
          background: 'linear-gradient(135deg, #0D1F4E 0%, #112060 35%, #0E1A50 65%, #0A1535 100%)',
        }}
      >
        <div style={{
          height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(26,107,255,0.6), rgba(245,166,35,0.5), rgba(26,107,255,0.6), transparent)',
        }} />

        <div className="border-b border-white/[0.09]">
          <div className="container-page py-7">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {TRUST.map(t => (
                <div
                  key={t.title}
                  className="flex flex-col sm:flex-row items-center sm:items-start gap-3 text-center sm:text-left group"
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-[#1A6BFF1F] border border-[#1A6BFF38] group-hover:scale-110 transition-transform duration-200">
                    <t.icon size={16} strokeWidth={1.8} className="text-[#F5A623]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold leading-tight text-slate-100">{t.title}</p>
                    <p className="text-[11px] mt-0.5 text-slate-400">{t.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="container-page py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-6">

            <div className="lg:col-span-2 flex flex-col items-center sm:items-start space-y-5 text-center sm:text-left">
              <div className="flex justify-center sm:justify-start">
                <Logo variant="dark" size="md" href="/" />
              </div>

              <p className="text-sm leading-relaxed max-w-[280px] text-slate-400">
                Ethiopia&apos;s premier multi-vendor marketplace — connecting buyers with
                thousands of verified sellers across the country.
              </p>

              <div className="space-y-2.5 w-full">
                {CONTACT_ITEMS.map(c => (
                  <a
                    key={c.label}
                    href={c.href}
                    className="flex items-center justify-center sm:justify-start gap-2.5 text-sm text-slate-400 hover:text-slate-100 transition-colors duration-150"
                  >
                    <c.icon size={13} className="text-[#F5A623] shrink-0" />
                    {c.label}
                  </a>
                ))}
              </div>

              <div className="flex items-center justify-center sm:justify-start gap-2">
                {SOCIALS.map(s => (
                  <a
                    key={s.label}
                    href={s.href}
                    aria-label={s.label}
                    rel="noopener noreferrer"
                    className={clsx(
                      'w-8 h-8 rounded-xl flex items-center justify-center',
                      'bg-white/[0.07] border border-white/[0.09]',
                      'text-slate-400 hover:text-slate-100',
                      'hover:bg-[#1A6BFF22] hover:border-[#1A6BFF50]',
                      'transition-all duration-200 active:scale-95',
                    )}
                  >
                    <s.icon size={14} />
                  </a>
                ))}
              </div>
            </div>

            <Section title="Customer">
              <FLink href="/account/orders">My orders</FLink>
              <FLink href="/account/wishlist">Wishlist</FLink>
              <FLink href="/account/returns">Returns</FLink>
              <FLink href="/account/reviews">My reviews</FLink>
              <FLink href="/account/notifications">Notifications</FLink>
              <FLink href="/account/profile">My account</FLink>
            </Section>

            <Section title="Sellers">
              <FLink href="/register/seller" badge="Join">Become a seller</FLink>
              <FLink href="/seller/dashboard">Dashboard</FLink>
              <FLink href="/seller/products">My products</FLink>
              <FLink href="/seller/orders">My orders</FLink>
              <FLink href="/seller/promotions">Promotions</FLink>
              <FLink href="/seller/wallet">Wallet</FLink>
            </Section>

            <Section title="Company">
              <FLink href="/about">About us</FLink>
              <FLink href="/contact">Contact</FLink>
              <FLink href="/privacy">Privacy policy</FLink>
              <FLink href="/terms">Terms &amp; conditions</FLink>
            </Section>
          </div>
        </div>

        <div className="border-t border-white/[0.09]">
          <div className="container-page py-4 flex flex-col sm:flex-row items-center justify-center sm:justify-between gap-2">
            <p className="text-xs text-slate-600 text-center sm:text-left">
              © {new Date().getFullYear()} AddisMarket. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              {[
                { href: '/privacy', label: 'Privacy' },
                { href: '/terms',   label: 'Terms'   },
                { href: '/contact', label: 'Contact' },
              ].map(l => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="text-xs text-slate-600 hover:text-slate-400 transition-colors duration-150"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

      </footer>
    </>
  );
}