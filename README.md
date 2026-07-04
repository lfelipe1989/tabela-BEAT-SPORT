# BEAT Torneio — Ranking & Chaveamento

App único (Next.js + Supabase) para cadastrar atletas, criar etapas,
sortear duplas, gerar chaveamento/grupos e manter um ranking geral
com histórico por atleta e nivelamento por categoria.

## O que ele faz

- **Atletas**: cadastro (nome, apelido, cidade, telefone) + página de
  perfil com histórico de etapas, pontos totais e categoria atual.
- **Etapas**: criar um evento, cadastrar as duplas participantes,
  marcar cabeças de chave, realizar o sorteio e rodar a fase de
  grupos e/ou o chaveamento eliminatório (mesma lógica do gerador de
  chaveamento avulso que já te mostrei).
- **Ranking geral**: soma os pontos de todas as etapas finalizadas de
  cada atleta e aplica as faixas de categoria (A/B/C/D, editável no
  banco).

## Isolamento no seu Supabase

Como você vai usar um projeto Supabase que já existe, **todas as
tabelas deste app ficam dentro de um schema próprio, `beat_torneio`**
— não em `public`. Isso garante que nada aqui encoste nas tabelas do
seu projeto de finanças (ou qualquer outra coisa que já exista lá).

## Passo a passo do deploy

### 1. Rodar o schema no Supabase

No projeto Supabase que você já tem, vá em **SQL Editor** e rode o
conteúdo de `supabase/schema.sql`. Ele cria o schema `beat_torneio`
e todas as tabelas dentro dele — não mexe em nada fora disso.

### 2. Expor o schema na API

Isso é o passo que costuma passar batido: por padrão o Supabase só
expõe o schema `public` via API. Vá em
**Project Settings → API → Exposed schemas** e adicione
`beat_torneio` na lista (junto com `public`, se já estiver lá).
Sem isso, o app não consegue ler/escrever nada.

### 3. Pegar as chaves

Ainda em **Project Settings → API**, copie:
- **Project URL**
- **anon public key**
- **service_role key** (fica só no servidor, nunca no navegador)

### 4. Configurar variáveis de ambiente

Copie `.env.local.example` para `.env.local` e preencha com as
chaves acima, mais uma senha de sua escolha em `ADMIN_PASSWORD`
(é ela que libera cadastrar atleta, criar etapa e lançar resultado —
sem ela, qualquer visitante só consegue ver o ranking, não editar).

### 5. Rodar localmente (opcional, mas recomendado)

```bash
npm install
npm run dev
```

Abra `http://localhost:3000` e confira se dá pra cadastrar um atleta
e criar uma etapa antes de subir pro Vercel.

### 6. Subir pro GitHub e conectar no Vercel

Mesmo fluxo que você já usa no projeto de finanças: crie um repositório,
suba este código, importe no Vercel e adicione as **mesmas 4 variáveis
de ambiente** (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD`) em
**Project Settings → Environment Variables** no Vercel. Deploy.

## Como funciona a segurança

- Leitura (ranking, lista de atletas, etapas) é pública — qualquer
  pessoa com o link vê, sem senha, direto pelo navegador usando a
  `anon key`.
- Escrita (cadastrar atleta, criar etapa, lançar resultado) passa
  **sempre** por rotas de API do Next.js (`app/api/**`), que
  conferem a senha em `ADMIN_PASSWORD` no servidor e só então usam a
  `service_role key` — que nunca é enviada ao navegador. A tabela do
  Supabase tem RLS habilitado e só permite `SELECT` pela `anon key`;
  não existe política de `INSERT/UPDATE/DELETE` para ela.

## Limitações conhecidas (bom saber)

- O sorteio e as partidas de uma etapa em andamento ficam salvos em
  uma coluna `estado_chaveamento` (JSON) na própria etapa — então dá
  pra fechar a aba e voltar depois sem perder nada. Mas se duas
  pessoas mexerem na mesma etapa ao mesmo tempo, quem salvar por
  último sobrescreve o outro (sem controle de conflito).
- O ranking usa uma tabela de pontos por colocação
  (`beat_torneio.pontos_colocacao`) e faixas de categoria
  (`beat_torneio.categorias`) com valores padrão. Dá pra editar os
  dois direto pelo SQL Editor do Supabase (ou eu monto uma telinha de
  configuração depois, se quiser).
- No formato "somente grupos" com mais de um grupo, a colocação usada
  pro ranking é a posição dentro do grupo (1º de qualquer grupo conta
  igual) — não existe uma disputa cruzada entre os grupos nesse
  formato.
