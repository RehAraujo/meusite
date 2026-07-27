# Renata Join

Site profissional de Renata Gomes Araujo. O projeto apresenta sua atuação entre
identidade, estratégia, design, tecnologia, processos e produtos digitais sem
transformar a experiência em uma vitrine genérica de serviços.

## Problema resolvido

O conteúdo anterior estava distribuído em páginas HTML independentes, com CSS e
JavaScript repetidos. Isso dificultava manutenção, consistência, testes e
evolução. A arquitetura atual centraliza navegação, conteúdo profissional,
componentes e decisões visuais, preservando rotas e identidade.

## Stack

- React e React Router;
- Vite;
- JavaScript moderno e JSX;
- CSS próprio com design tokens e camadas;
- pré-renderização estática para SEO e conteúdo essencial;
- Vitest e React Testing Library;
- ESLint, Stylelint e Prettier;
- GitHub Actions;
- Cloudflare Pages e Workers Static Assets.

Não existe banco de dados. O conteúdo atual não exige persistência, autenticação
ou consultas dinâmicas; manter o projeto estático reduz custo, superfície de
ataque e manutenção.

## Arquitetura

```text
src/
  components/
    layout/
    ui/
  data/
  hooks/
  pages/
  routes/
  styles/
  utils/
tests/
public/
scripts/
```

Dados de serviços, projetos, trajetória, ferramentas e navegação ficam
separados da apresentação. Componentes são criados quando possuem
responsabilidade reutilizável; não há wrappers sem função.

## Execução local

Requer Node.js 22 e pnpm.

```bash
pnpm install
pnpm dev
```

## Qualidade e build

```bash
pnpm lint
pnpm test
pnpm build
pnpm preview
```

O build gera HTML pré-renderizado para as rotas públicas em `dist/`. A rota
`/curriculo` recebe `noindex`, não aparece no menu nem no sitemap.

## Decisões técnicas

- CSS global em camadas foi escolhido porque o sistema visual é pequeno e
  compartilhado; misturar CSS Modules não agregaria valor nesta fase.
- React Router organiza rotas, mas o HTML essencial é gerado na build para não
  depender do JavaScript em indexação e leitura inicial.
- Formulários não persistem dados: validam no navegador e abrem uma mensagem
  codificada no WhatsApp.
- Source maps de produção permanecem desativados.
- Dependências são mantidas pequenas e justificadas por comportamento real.

## Segurança

Cabeçalhos incluem CSP, HSTS, proteção contra frames, MIME sniffing, políticas
de permissões e restrições de origem. Não há segredos no cliente. Consulte
[SECURITY.md](SECURITY.md) para decisões e riscos residuais.

## Acessibilidade

O projeto usa landmarks, elementos nativos, foco visível, skip link, labels,
navegação por teclado, modal com foco controlado, redução de movimento e estilos
de impressão.

## Performance

O JavaScript de produção não possui source maps. Imagens declaram dimensões
quando afetam layout, conteúdos abaixo da dobra usam carregamento tardio e o CSS
é minificado pelo Vite. Fontes externas permanecem como melhoria futura.

## Deploy

O GitHub executa lint, testes e build. A Cloudflare publica somente `dist/`.
Nenhum token é armazenado no repositório.

## Licença

Código e conteúdo são proprietários de Renata Gomes Araujo. A presença deste
repositório no GitHub não concede licença de reutilização de marca, textos,
imagens ou produtos.

## Próximos passos

1. self-host das fontes;
2. ampliar testes de acessibilidade automatizados;
3. documentar métricas reais de projetos;
4. estudar TypeScript, APIs, SQL e testes end-to-end em projetos próprios,
   sem apresentá-los prematuramente como domínio profissional.
