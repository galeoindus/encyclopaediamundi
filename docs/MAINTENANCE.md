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

## Setting the variables on Cloudflare

Cloudflare Pages does **not** read a `.env` file at runtime. There is no file to
upload: the values live in the project's settings and are injected into the
Functions as `env`. A `.env` file is useful for exactly one thing — pasting the
list into the dashboard once — and that is what `cloudflare.env.example` is for.

**The file.** `cloudflare.env.example` holds only `NAME=value` lines and no
comments, on purpose: the dashboard's bulk editor imports every line it is
given as a variable, so a `#` line becomes a variable called `#…`. Copy the
whole file, fill in the six keys, paste.

**Where it goes.**

1. Cloudflare dashboard → Workers & Pages → **veridell** → Settings →
   Variables and Secrets.
2. Use **Bulk edit** (or *Import .env*) and paste the filled file.
3. The four `OPENROUTER_API_KEY_*` lines are credentials. Cloudflare adds bulk
   lines as **Plaintext** by default — change those four to **Secret**, or add
   them one at a time with *Add → Secret*. A plaintext key is readable by anyone
   who can open the project settings.
4. Save, then redeploy. Variables set after a deployment do not reach the build
   that is already running; the Functions pick them up on the next deployment.

**By CLI, if you prefer.** This sets one secret at a time and needs no file:

```bash
npx wrangler pages secret put OPENROUTER_API_KEY_1 --project-name veridell
npx wrangler pages secret put OPENROUTER_API_KEY_2 --project-name veridell
# … through _6
```

Plaintext variables can go in `wrangler.toml` under `[vars]` and deploy with
the repository — that is where `AI_PROVIDER` and `OPENROUTER_FREE_ONLY` already
are. A secret must never be written there; `wrangler.toml` is committed.

**What the values mean here.**

| Name | Kind | What it does |
|---|---|---|
| `AI_PROVIDER` | plain | `openrouter` sends answers through OpenRouter; `workers-ai` keeps everything on Cloudflare. |
| `OPENROUTER_FREE_ONLY` | plain | `true` (the default) restricts every request to `:free` models, so the six keys cost nothing. `false` unlocks paid models, but only with `ENABLE_PAID_AI=true`. |
| `ENABLE_PAID_AI` | plain | The second lock on spending. A key alone never bills anything. |
| `ALLOW_PAID_FALLBACK` | plain | A third, separate opt-in: lets a failed free call fall through to a paid one. |
| `WORKERS_AI_MODEL` | plain | Which Workers AI model answers when the provider is `workers-ai`. |
| `OPENROUTER_API_KEY_1..6` | **secret** | Six separate quotas, tried in order; empty or rate-limited keys are skipped. |
| `OPENROUTER_MODEL_TIER` | plain | The automatic floor: `cheap`, `balanced` or `deep`. |
| `SITE_ORIGIN` | plain | The canonical origin, sent as the Referer to OpenRouter. Not a secret. |

With the file as shipped — `AI_PROVIDER=openrouter`, `OPENROUTER_FREE_ONLY=true`,
`ENABLE_PAID_AI=false` — the six keys are used against free models only. Nothing
is billed, and if all six are exhausted the endpoint says so rather than
silently spending.

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
