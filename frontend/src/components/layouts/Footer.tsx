'use client';

import { useState, useEffect, ReactNode } from 'react';
import Link from 'next/link';
import {
  Mail,
  Phone,
  MapPin,
  Facebook,
  Twitter,
  Instagram,
  Youtube,
  Truck,
  Shield,
  RefreshCw,
  Headphones,
  ArrowUp,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import clsx from 'clsx';
import Logo from '@/components/ui/Logo';

/* ──────────────────────────────────────────────────────────────
   TOKENS
────────────────────────────────────────────────────────────── */
const GOLD = '#F5A623';
const BLUE = '#1A6BFF';

const TRUST = [
  { icon: Truck, title: 'Fast delivery', sub: 'Nationwide shipping' },
  { icon: Shield, title: 'Secure payment', sub: 'Chapa & bank transfer' },
  { icon: RefreshCw, title: 'Easy returns', sub: '7-day return policy' },
  { icon: Headphones, title: '24/7 support', sub: 'Always here for you' },
];

const SOCIALS = [
  { icon: Facebook, href: '#', label: 'Facebook' },
  { icon: Twitter, href: '#', label: 'Twitter' },
  { icon: Instagram, href: '#', label: 'Instagram' },
  { icon: Youtube, href: '#', label: 'YouTube' },
];

const CONTACT_ITEMS = [
  {
    icon: Mail,
    href: 'mailto:support@addismarket.et',
    label: 'support@addismarket.et',
  },
  {
    icon: Phone,
    href: 'tel:+251911000000',
    label: '+251 911 000 000',
  },
  {
    icon: MapPin,
    href: '#',
    label: 'Bethel, Addis Ababa',
  },
];

/* ──────────────────────────────────────────────────────────────
   BACK TO TOP
────────────────────────────────────────────────────────────── */
function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handle = () => setVisible(window.scrollY > 500);
    window.addEventListener('scroll', handle, { passive: true });

    return () => window.removeEventListener('scroll', handle);
  }, []);

  return (
    <button
      aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className={clsx(
        'fixed bottom-6 right-5 sm:right-6 z-50',
        'w-11 h-11 rounded-2xl shadow-2xl',
        'flex items-center justify-center',
        'bg-[#F5A623] text-[#0D1F4E]',
        'transition-all duration-300',
        'hover:scale-110 active:scale-95',
        visible
          ? 'opacity-100 translate-y-0 pointer-events-auto'
          : 'opacity-0 translate-y-3 pointer-events-none'
      )}
    >
      <ArrowUp size={16} strokeWidth={2.5} />
    </button>
  );
}

/* ──────────────────────────────────────────────────────────────
   SECTION
────────────────────────────────────────────────────────────── */
function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="w-full">
      <button
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between sm:justify-start gap-2 py-3 sm:py-0"
      >
        <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
          {title}
        </span>

        <span className="sm:hidden text-slate-500">
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      <ul
        className={clsx(
          'space-y-1 pb-1 sm:pb-0 sm:block sm:mt-4',
          open ? 'block' : 'hidden'
        )}
      >
        {children}
      </ul>
    </div>
  );
}

 
function FLink({
  href,
  children,
  badge,
}: {
  href: string;
  children: ReactNode;
  badge?: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className={clsx(
          'group flex items-center justify-between gap-3 rounded-xl px-3 py-2',
          'text-sm text-slate-400 hover:text-white',
          'hover:bg-white/[0.04]',
          'transition-all duration-200'
        )}
      >
        <span className="truncate">{children}</span>

        {badge && (
          <span className="text-[9px] font-black uppercase px-2 py-1 rounded-full bg-[#F5A62320] text-[#F5A623] border border-[#F5A62330] shrink-0">
            {badge}
          </span>
        )}
      </Link>
    </li>
  );
}

/* ──────────────────────────────────────────────────────────────
   MAIN FOOTER
────────────────────────────────────────────────────────────── */
export default function Footer() {
  return (
    <>
      <BackToTop />

      <footer
        aria-label="Footer navigation"
        className="mt-16 text-slate-400"
        style={{
          background:
            'linear-gradient(135deg,#0D1F4E 0%,#112060 35%,#0E1A50 65%,#0A1535 100%)',
        }}
      >
        {/* top accent line */}
        <div
          style={{
            height: 1,
            background:
              'linear-gradient(90deg,transparent,rgba(26,107,255,.6),rgba(245,166,35,.5),rgba(26,107,255,.6),transparent)',
          }}
        />

        {/* TRUST */}
        <div className="border-b border-white/[0.08]">
          <div className="container-page py-7">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {TRUST.map((item) => (
                <div
                  key={item.title}
                  className="flex flex-col sm:flex-row items-center sm:items-start gap-3 text-center sm:text-left group"
                >
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 bg-[#1A6BFF1F] border border-[#1A6BFF38] group-hover:scale-110 transition-transform duration-200">
                    <item.icon
                      size={16}
                      strokeWidth={1.8}
                      className="text-[#F5A623]"
                    />
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-white">
                      {item.title}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {item.sub}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* MAIN */}
        <div className="container-page py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8">
            {/* BRAND */}
            <div className="lg:col-span-2 flex flex-col items-center sm:items-start text-center sm:text-left">
              <div className="mb-5">
                <Logo variant="dark" size="md" href="/" />
              </div>

              <div className="w-full max-w-md rounded-3xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-md p-5 sm:p-0 sm:bg-transparent sm:border-0 sm:rounded-none sm:backdrop-blur-none">
                <p className="text-sm leading-7 text-slate-300 sm:max-w-[300px]">
                 Connecting buyers and verified sellers across Ethiopia.
                </p>
                {/* CONTACT */}
                <div className="mt-5 grid gap-3 sm:space-y-2.5 sm:block">
                  {CONTACT_ITEMS.map((item) => (
                    <a
                      key={item.label}
                      href={item.href}
                      className={clsx(
                        'flex items-center gap-3 rounded-2xl px-4 py-3',
                        'bg-white/[0.04] border border-white/[0.05]',
                        'sm:bg-transparent sm:border-0 sm:px-0 sm:py-0',
                        'text-sm text-slate-300 hover:text-white transition'
                      )}
                    >
                      <div className="w-8 h-8 rounded-xl bg-[#F5A62315] flex items-center justify-center shrink-0">
                        <item.icon
                          size={14}
                          className="text-[#F5A623]"
                        />
                      </div>

                      <span>{item.label}</span>
                    </a>
                  ))}
                </div>

                {/* SOCIAL */}
                <div className="mt-5 flex items-center justify-center sm:justify-start gap-2">
                  {SOCIALS.map((item) => (
                    <a
                      key={item.label}
                      href={item.href}
                      aria-label={item.label}
                      rel="noopener noreferrer"
                      className={clsx(
                        'w-9 h-9 rounded-xl flex items-center justify-center',
                        'bg-white/[0.07] border border-white/[0.09]',
                        'text-slate-400 hover:text-white',
                        'hover:bg-[#1A6BFF22] hover:border-[#1A6BFF50]',
                        'transition-all duration-200 active:scale-95'
                      )}
                    >
                      <item.icon size={14} />
                    </a>
                  ))}
                </div>
              </div>
            </div>

            {/* LINKS */}
            <Section title="Customer">
              <FLink href="/account/orders">My orders</FLink>
              <FLink href="/account/wishlist">Wishlist</FLink>
              <FLink href="/account/returns">Returns</FLink>
              <FLink href="/account/reviews">My reviews</FLink>
              <FLink href="/account/notifications">Notifications</FLink>
              <FLink href="/account/profile">My account</FLink>
            </Section>

            <Section title="Sellers">
              <FLink href="/register/seller" badge="Join">
                Become a seller
              </FLink>
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

        {/* BOTTOM */}
        <div className="border-t border-white/[0.08]">
          <div className="container-page py-5 flex flex-col gap-3 lg:flex-row lg:justify-center lg:items-center">
            <p
              suppressHydrationWarning
              className="text-xs text-slate-500 text-center"
            >
              © {new Date().getFullYear()} AddisMarket. All rights reserved.
            </p>

            <div className="flex items-center justify-center gap-5">
              {[
                { href: '/privacy', label: 'Privacy' },
                { href: '/terms', label: 'Terms' },
                { href: '/contact', label: 'Contact' },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}