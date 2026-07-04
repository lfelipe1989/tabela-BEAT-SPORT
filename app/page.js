import Link from 'next/link';

export default function Home() {
  return (
    <div className="page">
      <header className="topbar">
        <div className="topbar-row">
          <div className="brand">
            <span className="icon">🏖️</span>
            <h1 className="brand-title">BEAT Torneio</h1>
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
      </div>
    </div>
  );
}
