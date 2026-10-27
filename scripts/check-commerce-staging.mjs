// Read-only, no dotenv, no credentials and no Cloudflare/provider calls.
import { URL } from 'node:url';
import { readFileSync } from 'node:fs';
import { log } from 'node:console';
import process from 'node:process';

const config = JSON.parse(
  readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8').replace(/^\s*\/\/.*$/gm, ''),
);
const stage = config.env.staging;
const issues = [];
const commerce = stage.d1_databases.find((db) => db.binding === 'COMMERCE_DB');
const productionIds = new Set(config.d1_databases.map((db) => db.database_id));
if (!commerce || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(commerce.database_id))
  issues.push(
    'Substituir o identificador pendente pelo ID do novo D1 exclusivo da loja em staging.',
  );
if (productionIds.has(commerce?.database_id))
  issues.push('O D1 da loja não pode ser um banco de produção.');
if (stage.d1_databases.some((db) => productionIds.has(db.database_id)))
  issues.push('Staging contém binding D1 de produção.');
if (commerce?.migrations_dir !== 'migrations/commerce')
  issues.push('Usar somente as migrações dedicadas da loja.');
try {
  const origin = new URL(stage.vars.COMMERCE_ORIGIN);
  if (
    origin.protocol !== 'https:' ||
    origin.origin !== stage.vars.COMMERCE_ORIGIN ||
    origin.hostname.endsWith('.invalid') ||
    ['renatajoin.com', 'www.renatajoin.com'].includes(origin.hostname)
  )
    issues.push('Informar a origem HTTPS exata e exclusiva de staging, sem barra final.');
} catch {
  issues.push('Informar uma origem HTTPS válida para staging.');
}
const expectedHostname = 'homologacao.renatajoin.com';
const safeRoutes =
  Array.isArray(stage.routes) &&
  stage.routes.length <= 1 &&
  stage.routes.every((route) => route.pattern === expectedHostname && route.custom_domain === true);
if (stage.name !== 'meusite-loja-staging' || !safeRoutes)
  issues.push(
    'Permitir somente o Worker isolado e o domínio exato de homologação, sem rotas do site público.',
  );
if (
  !stage.r2_buckets?.some(
    (b) =>
      b.binding === 'DIGITAL_PRODUCTS' &&
      b.bucket_name === 'meusite-digital-products-staging' &&
      b.remote === false,
  )
)
  issues.push('Conferir o bucket exclusivo de staging e a simulação local do R2.');
if (stage.vars.COMMERCE_ENVIRONMENT !== 'staging' || config.vars.COMMERCE_MODE !== 'disabled')
  issues.push('Manter o ambiente staging explícito e o checkout de produção desativado.');
if (issues.length) {
  for (const issue of issues) log(`PENDENTE: ${issue}`);
  process.exitCode = 1;
} else {
  log(
    'Configuração declarativa de staging consistente. Recursos, segredos, R2 privado e migrações remotas ainda exigem verificação autorizada.',
  );
}
