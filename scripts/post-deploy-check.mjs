#!/usr/bin/env node
/**
 * Post-deploy assertion: does the live site report the commit we shipped?
 *
 * The audit's IM-02 is about ambiguity, not about a broken deploy: the deploy
 * workflow reported success while its publish step was skipped, so nothing in
 * the pipeline ever compared what was published with what was committed. This
 * closes that gap in one command and can run in CI or by hand.
 *
 *   node scripts/post-deploy-check.mjs            # compares with HEAD
 *   node scripts/post-deploy-check.mjs <sha>      # compares with a commit
 *
 * Exits 0 when the live build matches, 1 when it does not, 2 when the site
 * cannot be reached — so a network failure is never reported as a bad deploy.
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const ORIGIN = process.env.SITE_ORIGIN || 'https://veridell.pages.dev';
const want = (process.argv[2] || execFileSync('git', ['rev-parse', '--short=7', 'HEAD']).toString()).trim();

const local = (() => {
  try { return JSON.parse(readFileSync(new URL('../assets/version.json', import.meta.url))).commit; }
  catch { return null; }
})();

let live = null;
try {
  const res = await fetch(`${ORIGIN}/assets/version.json?cb=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  live = (await res.json()).commit;
} catch (error) {
  console.log(`could not reach ${ORIGIN}: ${error.message}`);
  console.log('this is a network result, not a deployment result');
  process.exit(2);
}

console.log(`live   ${live}`);
console.log(`commit ${want}`);
console.log(`stamped ${local}`);

if (live === want) {
  console.log('ok — the live site is serving the commit that was pushed');
  process.exit(0);
}
console.log('MISMATCH — the live site is not serving this commit yet');
process.exit(1);
