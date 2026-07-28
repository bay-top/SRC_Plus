import { readFileSync, writeFileSync } from 'node:fs';

const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
if (!databaseId) throw new Error('CLOUDFLARE_D1_DATABASE_ID is required');
const source = readFileSync(new URL('../wrangler.template.jsonc', import.meta.url), 'utf8');
writeFileSync(
  new URL('../wrangler.generated.jsonc', import.meta.url),
  source.replace('__D1_DATABASE_ID__', databaseId),
  'utf8',
);
console.log('Generated wrangler.generated.jsonc');
