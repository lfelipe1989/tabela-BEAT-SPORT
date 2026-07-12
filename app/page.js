import Link from 'next/link';

export default function Home() {
  return (
    <div className="page">
      <header className="topbar">
        <div className="topbar-row">
          <div className="brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-branco.png" alt="BEAT Sports" className="brand-logo-home" />
          </div>
        </div>
      </header>
      <div className="home-grid">
        <Link href="/atletas" className="home-card">
          <span className="hc-icon">🧑‍🤝‍🧑</span>
          <span className="hc-title">Atletas</span>
          <span className="hc-desc">Cadastro e histórico individual de cada atleta</span>
        </Link>
        <Link href="/etapas" className="home-card">
          <span className="hc-icon">🏐</span>
          <span className="hc-title">Etapas</span>
          <span className="hc-desc">Criar torneios, sortear duplas e gerar o chaveamento</span>
        </Link>
        <Link href="/ranking" className="home-card">
          <span className="hc-icon">🏆</span>
          <span className="hc-title">Ranking geral</span>
          <span className="hc-desc">Classificação acumulada e nivelamento por categoria</span>
        </Link>
        <Link href="/ligas" className="home-card">
          <span className="hc-icon">🏅</span>
          <span className="hc-title">Ligas</span>
          <span className="hc-desc">Circuitos com várias etapas e ranking próprio</span>
        </Link>
      </div>
    </div>
  );
}
