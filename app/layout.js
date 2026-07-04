import './globals.css';

export const metadata = {
  title: 'BEAT Torneio — Ranking & Chaveamento',
  description: 'Cadastro de atletas, chaveamento de etapas e ranking geral.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
