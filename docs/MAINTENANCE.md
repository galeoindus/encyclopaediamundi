# Maintenance runbook

The site is static, so "maintenance" is not a server to patch. It is a tree that
drifts: a page loses a link, an article falls out of the sitemap, a version
string stops matching, a dependency goes stale. This file says what to run, how
often, and what each failure means.

## One command

```bash
npm run doctor          # the fast pass: modules, pages, identity, deep audit
npm run doctor:full     # the fast pass plus the 270-test suite
```

`doctor` runs the checks a push runs, in the order that fails fastest, and
prints one verdict. Exit code 1 means something is genuinely wrong; warnings
that do not fail the build are printed separately and do not change the code.

## The cadence

| When | Run | What it catches |
|---|---|---|
| Before every commit | `npm run check` | a module that does not parse, an import that does not resolve, a page whose asset path is wrong, two different versions in the tree |
| Before every pull request | `npm run verify` | the above plus the full suite |
| Every push | CI runs `stamp:build` then `verify` | the same, on a clean checkout, with the commit's own build id |
| Every Monday, 03:30 IST | `scheduled-health.yml` runs the doctor and the weekly audit | drift: a page nothing links to, an article missing from the sitemap, a dead internal link, the live deployment being down |
| Every release | `npm run release` | bumps the version, stamps, verifies, commits and tags |
| When a dependency alerts | `npm ci` then `npm run verify` | a lockfile that no longer installs, or an upgrade that breaks a test |

## What each failure means

**`check: N problem(s)`** — the tree is internally inconsistent. The message
names the file and the rule. A `version:` line means `package.json` and a page
disagree; run `npm run stamp:build`. An `import:` line means a module imports a
name that is not exported — the page would blank in the browser, so fix it
before anything else.

**`site audit:` a broken local asset path** — a `<link>` or `<script>` points at
a file that is not on disk. Usually a rename that missed a page.

**`identity:` a page has no skip link / canonical / structured data** — a page
was added without the shell the others have. Copy the head and the first line of
the body from a neighbouring page.

**`identity:` the old product name** — something reintroduced the previous
brand, most often a regenerated asset or a copied snippet. Replace it; do not
weaken the test.

**`deep audit:` a problem** — a file-level inconsistency: a duplicate `id`, an
`<img>` without `alt`, a `url()` that resolves to nothing, a `<loc>` in the
sitemap with no page behind it, `_headers` disagreeing with the tree.

**`weekly audit:` a note** — drift rather than breakage. Read it, decide whether
it matters, and either fix it or record why it is fine.

**A test failure** — a behaviour changed. Read the assertion before changing it:
almost every test in `test/` was written because the bug it describes actually
happened once.

## Adding an article

1. Add the slug to the article list the generator reads.
2. Run `python3 scripts/gen_articles.py` (needs `beautifulsoup4` and `lxml`, and
   network access to the Wikimedia API).
3. Run `npm run stamp:build` so the new page gets the current build id and
   enters the sitemap.
4. Run `npm run verify`. `test/articles.test.mjs` checks every published page
   has a lead, a citation and a link back to its source.

## Releasing

```bash
npm run release            # patch
npm run release -- minor   # or minor / major
```

The release script bumps `package.json`, stamps every page with the new version
and the new commit, runs the checks, commits and tags. Nothing ships that has
not passed `verify` first.

## What must never be committed

- `node_modules/`, `.wrangler/`, `.dev.vars` — ignored by `.gitignore`.
- A key of any kind. The AI endpoint reads credentials from Cloudflare encrypted
  Secrets; `.env.example` holds placeholders only. `test/` and the deep audit
  both fail on a hardcoded secret.
- A build id other than the one `stamp:build` wrote. If a diff shows `?v=` lines
  changing without a version change, someone hand-edited a page.

## When the live site misbehaves

```bash
npm run verify:live        # post-deploy check against the deployed origin
npm run smoke              # renders the shell in jsdom and asserts it boots
```

If both pass and the browser still shows something wrong, the cause is almost
always cache: `_headers` revalidates HTML on every visit, but a service worker
or a proxy can still hold an old document. Check `assets/version.json` first —
it is never cached, and it names the build the edge is actually serving.
