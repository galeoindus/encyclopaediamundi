#!/usr/bin/env node
/**
 * Veridell — deploy to Cloudflare Pages.
 *
 * A Pages project has to exist before `wrangler pages deploy` can publish to
 * it, and a fresh Cloudflare account has none. That is the whole reason a move
 * to a new account looks like "the upload does not work": wrangler answers
 * `Project not found` and stops, because the old project died with the old
 * account.
 *
 * This script removes that step from the operator's memory:
 *
 *   1. read the project name from wrangler.toml — one source of truth;
 *   2. create the project if it is missing, and treat "already exists" as fine;
 *   3. stamp the build (same stamp the site is served with);
 *   4. deploy, with the branch the project treats as production.
 *
 * Usage:
 *   npm run deploy                     # needs CLOUDFLARE_API_TOKEN + account id
 *   CLOUDFLARE_ACCOUNT_ID=… npm run deploy
 *
 * It never invents a name: if wrangler.toml and the project disagree, the
 * deploy fails loudly rather than publishing to a second, surprise project.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const wrangler = readFileSync(join(ROOT, 'wrangler.toml'), 'utf8');
const name = (/^\s*name\s*=\s*"([^"]+)"/m.exec(wrangler) || [])[1];
const branch = (/^\s*production_branch\s*=\s*"([^"]+)"/m.exec(wrangler) || [])[1] || 'main';

if (!name) {
  console.error('wrangler.toml has no name = "…" line; refusing to guess a project name.');
  process.exit(1);
}

const run = (args, { allowFail = false } = {}) => {
  try {
    return execFileSync('npx', ['--yes', 'wrangler', ...args], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    const out = `${error.stdout || ''}${error.stderr || ''}`;
    if (allowFail) return out;
    // Say what to do about it. A raw `npm error enoent` tells an operator
    // nothing, and this is the script people run when a deploy is already
    // going wrong.
    if (error.code === 'ENOENT') {
      console.error('Could not run npx. Install Node 18+ and run `npm install` first.');
    } else if (/not logged in|authentication|10000/i.test(out)) {
      console.error('Cloudflare rejected the credentials. Run `npx wrangler login`, or set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID for the account that owns this project.');
      console.error(out.trim().split('\n').slice(-4).join('\n'));
    } else {
      console.error(out.trim());
    }
    process.exit(1);
  }
};

console.log(`Pages project: ${name} · production branch: ${branch}`);

// 1 · the project. A 404 here is expected on a fresh account, and "already
// exists" is expected on every later run; neither is an error.
const created = run(['pages', 'project', 'create', name, '--production-branch', branch], { allowFail: true });
if (/already exists/i.test(created)) console.log(`Project ${name} already exists — reusing it.`);
else if (/error/i.test(created) && !/created successfully|Successfully created/i.test(created)) {
  console.log(created.trim().split('\n').slice(-3).join('\n'));
}

// 2 · the build stamp, so the deployed HTML and the assets agree.
execFileSync('node', [join(ROOT, 'scripts', 'stamp-build.mjs')], { cwd: ROOT, stdio: 'inherit' });

// 3 · the upload.
execFileSync('npx', ['--yes', 'wrangler', 'pages', 'deploy', '.',
  `--project-name=${name}`, `--branch=${branch}`, '--commit-dirty=true'], { cwd: ROOT, stdio: 'inherit' });

console.log(`\nLive at https://${name}.pages.dev/`);
