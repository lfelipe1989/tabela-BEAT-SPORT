'use client';
import Link from 'next/link';

export default function PageHeader({ title, icon }) {
  return (
    <header className="topbar">
      <div className="topbar-row">
        <div className="brand">
          <span className="icon">{icon}</span>
          <h1 className="brand-title">{title}</h1>
        </div>
        <Link href="/" className="btn btn-ghost btn-sm">
          ← Início
        </Link>
      </div>
    </header>
  );
}
