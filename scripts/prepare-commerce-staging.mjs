// Preserve the existing asset-exclusion protections in the staging build output.
import { copyFile, access } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { URL, fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { log } from 'node:console';

const root = fileURLToPath(new URL('../', import.meta.url));
const config = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
const stage = config.env.staging;
if (stage.name !== 'meusite-loja-staging' || stage.vars.COMMERCE_MODE !== 'disabled')
  throw new Error('Unexpected staging target or payment mode.');
const output = resolve(root, stage.assets.directory);
if (output !== resolve(root, 'dist')) throw new Error('Unexpected assets directory.');
await access(resolve(output, 'checkout/index.html'));
await copyFile(resolve(root, '.assetsignore'), resolve(output, '.assetsignore'));
log('Staging assets prepared with existing internal-file and metadata exclusions.');
