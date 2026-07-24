# Segurança do site

## Arquitetura

O projeto é um site estático em HTML, CSS e JavaScript, publicado pela
Cloudflare. Não existem banco de dados, autenticação, cookies de sessão,
dependências npm ou segredos necessários no navegador.

## Content Security Policy

Scripts inline são autorizados por hashes SHA-256. A política bloqueia
atributos JavaScript inline, `eval`, objetos incorporados, frames e conteúdo
misto.

Após qualquer alteração dentro de uma tag `<script>` sem `src`, execute:

```sh
python3 scripts/update-csp.py
```

O comando também falha caso um atributo como `onclick` ou `onsubmit` seja
adicionado.

Os estilos inline continuam permitidos por compatibilidade com a arquitetura
visual atual. Remover `unsafe-inline` de `style-src` exige migrar os estilos
embutidos e atributos `style` para folhas CSS externas.

## Arquivos públicos

`.assetsignore` impede que configurações, documentação, arquivos temporários,
segredos locais e scripts internos sejam enviados como ativos estáticos.

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
