#!/usr/bin/env node
/**
 * Deploy to Cloudflare Pages.
 *
 * A Pages project has to exist before `wrangler pages deploy` can publish to
 * it, and a fresh Cloudflare account has none — which is what "the upload does
 * not work" looks like from the outside. This script removes that step:
 *
 *   1. read the project name from wrangler.toml (one source of truth);
 *   2. create the project when the account has none;
 *   3. build the crawlable pages;
 *   4. upload.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const config = readFileSync(join(ROOT, 'wrangler.toml'), 'utf8');
const name = (/^\s*name\s*=\s*"([^"]+)"/m.exec(config) || [])[1];
const branch = 'main';

if (!name) {
  console.error('wrangler.toml has no name = "…" line; refusing to guess a project name.');
  process.exit(1);
}

const wrangler = (args, { allowFail = false } = {}) => {
  try {
    return execFileSync('npx', ['--yes', 'wrangler', ...args], { cwd: ROOT, encoding: 'utf8' });
  } catch (error) {
    const out = `${error.stdout || ''}${error.stderr || ''}`;
    if (allowFail) return out;
    if (error.code === 'ENOENT') console.error('Could not run npx. Install Node 18+ first.');
    else if (/not logged in|authentication|10000/i.test(out)) {
      console.error('Cloudflare rejected the credentials. Run `npx wrangler login`, or set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID for the account that owns this project.');
    } else console.error(out.trim());
    process.exit(1);
  }
};

console.log(`Pages project: ${name}`);

const created = wrangler(['pages', 'project', 'create', name, '--production-branch', branch], { allowFail: true });
if (/already exists/i.test(created)) console.log(`Project ${name} already exists — reusing it.`);
else if (/created successfully/i.test(created)) console.log(`Created project ${name}.`);
else if (/error/i.test(created)) console.log(created.trim().split('\n').slice(-3).join('\n'));

execFileSync('node', [join(ROOT, 'scripts', 'build-pages.mjs')], { cwd: ROOT, stdio: 'inherit' });

execFileSync('npx', ['--yes', 'wrangler', 'pages', 'deploy', '.',
  `--project-name=${name}`, `--branch=${branch}`, '--commit-dirty=true'], { cwd: ROOT, stdio: 'inherit' });

console.log(`\nLive at https://${name}.pages.dev/`);
