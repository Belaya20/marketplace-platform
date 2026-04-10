'use client';
// src/components/ui/Logo.tsx

import Link from 'next/link';
import clsx from 'clsx';

interface LogoProps {
  variant?: 'dark' | 'light';
  size?: 'sm' | 'md' | 'lg';
  href?: string;
  className?: string;
}

export default function Logo({
  variant = 'dark',
  size = 'md',
  href = '/',
  className,
}: LogoProps) {

  const markSize = { sm: 24, md: 34, lg: 56 }[size];
  const textSize = { sm: 'text-sm', md: 'text-lg', lg: 'text-3xl' }[size];
  const subSize  = { sm: 'text-[7px]', md: 'text-[8.5px]', lg: 'text-[11px]' }[size];
  const gap      = { sm: 'gap-1.5', md: 'gap-2', lg: 'gap-3' }[size];

  const isLight = variant === 'light';

  return (
    <Link
      href={href}
      className={clsx(
        'flex items-center flex-shrink-0 cursor-pointer select-none group',
        gap,
        className
      )}
      style={{ textDecoration: 'none' }}
    >
      {/* ── SVG Hex Mark ── */}
      <svg
        width={markSize}
        height={markSize}
        viewBox="0 0 34 34"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0 transition-transform duration-300 ease-[cubic-bezier(.16,1,.3,1)] group-hover:rotate-[15deg] group-hover:scale-[1.06]"
      >
        {/* Hex background */}
        <path
          d="M17 2L30.9 9.5V24.5L17 32L3.1 24.5V9.5L17 2Z"
          fill={isLight ? '#EBF2FF' : '#0D1F4E'}
          stroke="#1A6BFF"
          strokeWidth={isLight ? '1.4' : '1.2'}
        />
        {/* Inner facet highlights */}
        <path d="M17 2L30.9 9.5L17 17Z"       fill={`rgba(26,107,255,${isLight ? '0.25' : '0.35'})`} />
        <path d="M17 17L30.9 9.5V24.5Z"        fill={`rgba(26,107,255,${isLight ? '0.12' : '0.18'})`} />
        <path d="M17 17V32L3.1 24.5Z"           fill={`rgba(26,107,255,${isLight ? '0.08' : '0.12'})`} />
        <path d="M17 2L3.1 9.5L17 17Z"          fill={`rgba(26,107,255,${isLight ? '0.18' : '0.28'})`} />
        {/* A letterform legs */}
        <line x1="17" y1="9.5"  x2="11.5" y2="25" stroke={isLight ? '#1A6BFF' : 'white'} strokeWidth="2"   strokeLinecap="round" />
        <line x1="17" y1="9.5"  x2="22.5" y2="25" stroke={isLight ? '#1A6BFF' : 'white'} strokeWidth="2"   strokeLinecap="round" />
        {/* Gold crossbar */}
        <line x1="13.2" y1="19.5" x2="20.8" y2="19.5" stroke="#F5A623" strokeWidth="1.8" strokeLinecap="round" />
        {/* Gold apex dot */}
        <circle cx="17" cy="9.5" r="1.8" fill="#F5A623" />
        {/* Outer vertex dots */}
        <circle cx="17"   cy="2"    r="1" fill="#F5A623" opacity={isLight ? '.8' : '.7'} />
        <circle cx="30.9" cy="9.5"  r="1" fill="#1A6BFF" opacity={isLight ? '.6' : '.7'} />
        <circle cx="30.9" cy="24.5" r="1" fill="#1A6BFF" opacity={isLight ? '.6' : '.7'} />
        <circle cx="17"   cy="32"   r="1" fill="#F5A623" opacity={isLight ? '.8' : '.7'} />
        <circle cx="3.1"  cy="24.5" r="1" fill="#1A6BFF" opacity={isLight ? '.6' : '.7'} />
        <circle cx="3.1"  cy="9.5"  r="1" fill="#1A6BFF" opacity={isLight ? '.6' : '.7'} />
      </svg>

      {/* ── Wordmark ── */}
      <div className="flex flex-col leading-none gap-0">
        <div
          className={clsx(
            'font-black tracking-tight leading-none',
            textSize,
            isLight ? 'text-[#0B1628]' : 'text-white'
          )}
          style={{ fontFamily: "'Sora', sans-serif" }}
        >
          Addis<span style={{ color: '#F5A623' }}>Market</span>
        </div>
        <div
          className={clsx(
            'font-bold uppercase tracking-[.12em] mt-[2px] leading-none',
            subSize,
            isLight ? 'text-[#6B90B0]' : 'text-[#8BA4C0]'
          )}
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Digital Marketplace
        </div>
      </div>
    </Link>
  );
}
