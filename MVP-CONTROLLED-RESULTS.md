# MVP controlado — resultado de implementação

Data: 13 de agosto de 2026  
Branch: `feat/controlled-mvp-diagnostics`  
Produção: não alterada

## Arquitetura implementada

`/diagnostico` → pedido controlado → Worker → D1 → Queue → investigação pública → Evidence Package → Sufficiency Gate → Analyzer → scoring determinístico → Report Composer → conversão ética → `PENDING_HUMAN_REVIEW` → `/operacao/diagnosticos`.

O frontend existente React/Vite/SSR foi reutilizado. O Worker existente recebeu endpoints próprios; D1 e Queue são os únicos recursos adicionais previstos. Não há pagamento, CRM, autenticação complexa ou produto Google.

## Primeiro E2E

Caso: `@renatajoin` + `renatajoin.com`.

### Analyzer real

- investigação: concluída;
- Instagram: `FOUND` para metadados públicos, com limitação editorial explícita;
- Site: `FOUND`;
- gate: `SUFFICIENT_WITH_LIMITATIONS`;
- OpenAI API: resposta `429`;
- resultado: `FAILED`, com evento no Audit Log e sem fabricar Analysis/Report.

### Continuação controlada

Para validar o restante do pipeline sem esconder a falha externa, foi usado localmente `ANALYZER_MODE=CONTROLLED_FIXTURE`. O artefato identifica o run como `run.fixture.*` e essa variável não deve ser ativada silenciosamente fora do teste local.

- pedido: `order.bc0d0be5-424b-4d1b-b7f4-f235142f2dbb`;
- gate: `SUFFICIENT_WITH_LIMITATIONS`;
- Instagram: score determinístico `30`, faixa `FRAGILE`;
- Site: score determinístico `70`, faixa `CONSISTENT`;
- cross-channel: `55`, `PARTIALLY_COHERENT`, sem critical fracture;
- prioridade: fazer a proposta profissional chegar antes do clique;
- próximo passo: `SELF_IMPLEMENTATION`;
- conversão: `NO_SERVICE_NEEDED`, zero CTA;
- estado final: `PENDING_HUMAN_REVIEW`;
- autoaprovação: não ocorreu.

Os números da continuação controlada validam encadeamento, scoring e QA; não substituem uma nova execução real do Analyzer quando quota/acesso da API estiver disponível.

## Comparação com o benchmark

O diagnóstico principal foi preservado: o site comunica melhor a atuação integrada e a entrada pública do Instagram torna a proposta profissional menos imediata. A recomendação também preservou self-service e anti-upsell. A diferença material é a menor cobertura autônoma de conteúdo do Instagram, registrada como limitation, sem inferência de ausência.

## Verificação

- `pnpm lint`: PASS;
- `pnpm test`: 17 testes, PASS;
- `pnpm build`: PASS;
- D1 migration local: PASS;
- desktop: PASS;
- mobile 390 × 844: PASS, sem overflow horizontal;
- console nas rotas inspecionadas: sem warnings/errors;
- produção/deploy remoto: não executado.

## Gate externo para staging

A CLI Cloudflare não está autenticada neste ambiente. Antes do preview remoto, é necessário autenticar, criar D1 e Queue de staging, substituir o placeholder do `database_id`, aplicar a migration e configurar os secrets do Worker. Nenhum desses recursos foi criado remotamente.

## QA da proprietária

1. iniciar o Worker local ou abrir o futuro preview;
2. acessar `/operacao/diagnosticos`;
3. informar `QA_SECRET`;
4. abrir o pedido em `PENDING_HUMAN_REVIEW`;
5. conferir Evidence summary, limitations, scores, findings, prioridades, recomendação e conversão;
6. escolher Aprovar, Rejeitar finding, Corrigir fato ou Reprocessar.

Não aprovar o relatório do run `run.fixture.*` como análise comercial real; ele existe para QA funcional do pipeline.

## Changelog de contratos e operação

### Report Contract V1.3.0 — 13 de agosto de 2026

- `dimension_scores` passa a representar todas as combinações presentes na análise com estado explícito `SCORED`, `UNEVALUABLE` ou `NOT_APPLICABLE`.
- `score` e `weighted_value` são `null` quando não há cálculo defensável; `UNEVALUABLE` nunca é convertido em zero.
- `channel_scores` recebe o mesmo estado explícito e usa `NOT_SCORED` sem inferir desempenho ruim.
- O mínimo artificial de sete registros pontuados foi removido; a cardinalidade deixa de bloquear relatórios com evidência insuficiente.
- Cross-channel sem índice calculável é explicado editorialmente e não gera `critical_fracture` artificial.

### Quick Wins no MVP

- Quick Wins são conteúdo derivado opcional; a ausência é válida e a seção é omitida.
- A regeneração LLM específica de Quick Wins foi removida do fluxo operacional do MVP.
- A infraestrutura genérica de regeneração parcial permanece isolada para eventual uso futuro, sem chamada automática para completar Quick Wins.

## Pendências aprovadas — QA de 13 de agosto de 2026

Identificadas na revisão do pedido `order.2303c874-63c8-441b-a162-99bb2d25f0df`.

1. ~~**Calibração do julgamento estratégico sobre conteúdo pessoal/lifestyle.**~~ **Resolvida no Sprint 5.** O prompt `MAIN_ANALYSIS` (`worker/diagnostics/analyzer.js`, `MAIN_ANALYSIS_INSTRUCTIONS`) recebeu, de forma aditiva, os princípios *diferença não é deficiência*, *ponte, não presença* e *proporcionalidade*: variedade, personalidade, vida pessoal ou tom informal não são incoerência sem ruptura concreta da cadeia identidade → competência → prova → método → oferta → jornada → conversão; o padrão continua `SELF_IMPLEMENTATION`, sem upsell novo. O mesmo princípio foi espelhado em `STRATEGIC_SIGNALS_INSTRUCTIONS` para `functional_role_conflicts`.
2. ~~**Camada de apresentação do cliente separada da visão técnica de QA.**~~ **Resolvida no Sprint 5.** `GET /api/diagnostics/orders/:id` deixou de devolver o artefato REPORT: agora devolve `client_report` produzido por `worker/diagnostics/client-report.js` (`toClientReport`, determinístico e read-only) — narrativa em pt-BR sem IDs, enums, estados internos, `scorecard` cru ou `source_refs`, validada contra `client_report_v1_0` e um denylist enumerado de tokens internos, com *fail-closed* para a narrativa base em qualquer possível vazamento. A visão de QA (`GET /qa/:id`) ganhou `qa_flags` (`worker/diagnostics/qa-flags.js`) + o artefato `strategic_reasoning`, expondo `self_critique.escalate`, `validation_required`, candidatos pendentes e cobertura de capacidades apenas para o revisor. REPORT permanece `1.3.0`; nenhum schema JSON existente foi alterado; ANALYSIS/REPORT/STRATEGIC_REASONING não são modificados pelo serializer.

### Client Report V1 — Sprint 5

- Novo contrato JS `client_report_v1_0` (`additionalProperties:false`, sem enums/IDs): `headline`, `status_label`, `reading` (opening/whats_happening/what_works), `strategic_reading?`, `hidden_strengths?`, `watch_points?`, `audience_note?`, `channels?` (bandas em palavras, sem números), `priorities`, `do_it_yourself`, `not_now`, `next_step` (`tone` self/supported, `cta?` só quando `ethical_conversion.cta_count === 1`), `honest_limits`.
- Transformação `StrategicInsight → cliente`: só entram insights que sustentam uma prioridade ou cujo finding é `NOW` e confiança ≠ LOW (3 por partição); `EVIDENCE_GAP` é dobrado em `honest_limits`. Functional Role: só `ACTUAL_FRICTION` usa enquadramento de problema. Contradições viram tensão com o título autoral. Hidden Assets viram força subaproveitada. Audience só aparece com confiança ≥ MEDIUM, sempre hedge e sem métricas. Objective Alignment vira lente relativa ao objetivo declarado. Alternative Explanations: ≤1 aside por insight, só MEDIUM/LOW, ≥3 elegíveis → uma linha colapsada.
- Denylist enumerado (sem catch-all `SHOUT_CASE`, que rejeitava prosa legítima como "IMPORTANTE"/"ESTRATÉGICA"): cada enum interno + shape de ID + chaves snake_case internas.
