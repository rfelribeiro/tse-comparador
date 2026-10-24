# Eleições Presidenciais 2022 × 2026

Comparador visual dos resultados oficiais do Tribunal Superior Eleitoral (TSE) para a eleição presidencial: **2022 (2º turno)** × **2026 (1º turno)**, por Brasil, unidade da federação (UF) e município. A aplicação é estática e está publicada em **https://tse.rfelribeiro.com**.

## Funcionalidades

- Indicadores (KPIs) com a variação em pontos percentuais (Δ p.p.) entre as duas eleições.
- Mapa coroplético por UF e por município, com 8 métricas: vencedor, % Lula, % campo Bolsonaro, % outros (2026), Δ Lula, Δ campo Bolsonaro, abstenção e Δ abstenção.
- Gráficos de barras e ranking.
- Dispersão 2022 × 2026 por município.
- Tabela com busca, para consultar qualquer UF ou município.
- Links compartilháveis (o estado da visualização fica na URL).
- Tema claro e escuro.

## Fontes de dados

Os dados são públicos e vêm das seguintes fontes (URLs exatamente como usadas em `scripts/fetch.ts` e `scripts/build-geo.ts`):

| Dado | URL |
| --- | --- |
| Votação por candidato, município e zona, 2022 | `https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_candidato_munzona/votacao_candidato_munzona_2022.zip` |
| Votação por candidato, município e zona, 2026 | `https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_candidato_munzona/votacao_candidato_munzona_2026.zip` |
| Detalhe da votação por município e zona, 2022 | `https://cdn.tse.jus.br/estatistica/sead/odsele/detalhe_votacao_munzona/detalhe_votacao_munzona_2022.zip` |
| Detalhe da votação por município e zona, 2026 | `https://cdn.tse.jus.br/estatistica/sead/odsele/detalhe_votacao_munzona/detalhe_votacao_munzona_2026.zip` |
| Lista de municípios com códigos TSE/IBGE | `https://resultados.tse.jus.br/oficial/ele2026/6257/config/mun-e006257-cm.json` |
| Malhas geográficas (UF e municípios) | `https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo+json&qualidade=minima` (API de malhas do IBGE, v3) |

- Dos ZIPs de votação por candidato, só a entrada `*_BR.csv` é lida, por HTTP Range, sem baixar o arquivo inteiro. Os ZIPs de detalhe são pequenos e são baixados por completo.
- Os dados brutos ficam em `data-raw/` (ignorado pelo git). Os JSONs usados pela aplicação ficam em `app/public/data/`.

## Metodologia

- Os percentuais são calculados sobre os **votos válidos** (votos nominais de candidatos).
- A eleição de 2022 (2º turno) teve 2 candidatos; a de 2026 (1º turno) teve 12. Para comparar, os candidatos são agrupados em **campos**:
  - **Lula (PT)**: Lula nas duas eleições.
  - **Campo Bolsonaro (PL)**: Jair Bolsonaro em 2022 e Flávio Bolsonaro em 2026.
  - **Outros**: demais candidatos de 2026 (existem apenas em 2026).
- A abstenção inclui os eleitores de seções não instaladas.
- O exterior (código `ZZ`) aparece nos dados, mas não tem polígono no mapa.
- Boa Esperança do Norte (MT) foi criado após 2022 e não tem polígono na malha usada; por isso não aparece no mapa.
- Os totais são verificados por `scripts/validate.ts`: totais oficiais conhecidos, soma dos municípios igual à UF, soma das UFs igual ao Brasil e votos válidos + brancos + nulos igual ao comparecimento.

## Como rodar

Requisitos: Node.js 24.

```bash
npm install

# Baixa os dados do TSE, gera os JSONs e valida
npm run data

# Gera as malhas geográficas simplificadas (IBGE)
npm run data:geo

npm run dev       # servidor de desenvolvimento
npm run build     # build de produção em app/dist
npm run preview   # serve o build localmente
```

## Estrutura do repositório

```
.
├── app/                  # aplicação (Vite + TypeScript + ECharts)
│   ├── public/data/      # JSONs de resultados (br, uf, mun/*.json, meta)
│   ├── public/geo/       # malhas geográficas simplificadas
│   └── src/              # main.ts, data.ts, state.ts, charts/, theme.ts...
├── scripts/              # fetch.ts, build-data.ts, build-geo.ts, validate.ts
│   └── lib/              # leitor de CSV e de ZIP (HTTP Range), tipos
├── data-raw/             # dados brutos do TSE (não versionado)
└── wrangler.jsonc        # configuração do Cloudflare Workers
```

## Deploy

A aplicação é publicada como arquivos estáticos no Cloudflare Workers (Static Assets), a partir de `app/dist`, com o domínio personalizado `tse.rfelribeiro.com` configurado em `wrangler.jsonc`.

```bash
npm run deploy    # build + wrangler deploy
```

## Licença

Distribuído sob a licença MIT. Veja o arquivo [LICENSE](LICENSE).
