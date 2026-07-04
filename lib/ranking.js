export function pontosPorColocacao(colocacao, tabela) {
  const found = tabela.find((t) => t.colocacao === colocacao);
  if (found) return found.pontos;
  return 20; // padrão para colocações não cadastradas na tabela
}

export function categoriaPorPontos(pontos, categorias) {
  const ordenadas = [...categorias].sort((a, b) => a.ordem - b.ordem);
  for (const c of ordenadas) {
    if (pontos >= c.pontos_min && (c.pontos_max === null || c.pontos_max === undefined || pontos <= c.pontos_max)) {
      return c.nome;
    }
  }
  return ordenadas.length ? ordenadas[ordenadas.length - 1].nome : '—';
}
