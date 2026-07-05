'use client';
import Link from 'next/link';

export default function PageHeader({ title, icon }) {
  return (
    <header className="topbar">
      <div className="topbar-row">
        <div className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-branco.svg" alt="BEAT Sports" className="brand-logo" />
          <span className="brand-sep">|</span>
          <h1 className="brand-title">{title}</h1>
        </div>
        <Link href="/" className="btn btn-ghost btn-sm">
          ← Início
        </Link>
      </div>
    </header>
  );
}
