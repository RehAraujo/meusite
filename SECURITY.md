# Segurança do site

## Arquitetura

O projeto é uma aplicação React pré-renderizada na build e publicada como
ativos estáticos pela Cloudflare. Não existem banco de dados, autenticação,
cookies de sessão ou segredos necessários no navegador.

## Content Security Policy

Todo JavaScript da aplicação é empacotado em arquivo externo. A política
bloqueia scripts e atributos JavaScript inline, `eval`, objetos incorporados,
frames e conteúdo misto.

Os estilos da aplicação ficam em CSS externo. `style-src` ainda permite estilos
inline porque a barra de progresso atualiza uma propriedade de apresentação
calculada em tempo real. Essa exceção não permite execução de JavaScript.

## Arquivos públicos

A Cloudflare recebe somente a pasta `dist/`. Configurações, documentação,
fontes, testes e scripts de build não integram os ativos publicados.

## Dependências

O lockfile deve ser versionado e instalações de CI usam modo imutável. A
auditoria deve ser repetida em atualizações. Em 25 de julho de 2026, o registro
reportou um alerta no modo React Server Components do React Router. O projeto
não habilita RSC, actions, loaders remotos ou desserialização de dados do
servidor. A linha anterior do pacote apresentava vulnerabilidades aplicáveis ao
navegador, por isso foi mantida a versão atual e o risco não aplicável foi
documentado até a publicação de uma correção estável.

Nunca versionar:

- `.env` ou `.dev.vars`;
- chaves privadas;
- tokens de API;
- credenciais;
- logs com dados pessoais;
- backups ou arquivos temporários.

## Formulários

Os formulários não enviam dados a um servidor próprio. Após validação nativa
do navegador, eles montam uma mensagem codificada e abrem o WhatsApp. Nenhum
dado é armazenado pelo site.

## Comunicação de vulnerabilidades

Relatos de segurança devem ser enviados pelos canais institucionais publicados
no próprio site, sem incluir dados pessoais desnecessários ou credenciais.
