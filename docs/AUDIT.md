# Independent audit — 14 November 2026 (v6.4.0)

Scope: the fourteen findings of the external repository audit, applied in one
release. Every fix below names the finding it answers and the test that now
holds it in place.

| # | Finding | Fix | Held by |
|---|---|---|---|
| F-01 | Free-only OpenRouter was gated by the paid flag | A `:free` model now runs with `ENABLE_PAID_AI=false`; only a paid id needs the opt-in, refused at the last boundary | `test/provider-free-only.test.mjs` |
| F-02 | Fallback source card read an undefined `s.sourceType` | Reads `source.sourceType` through one formatter, so a Crossref card says Crossref | `test/chat-shell.test.mjs` |
| F-03 | Image endpoint had no origin, size or rate controls | Same-origin check, JSON content type, 4 KB streamed body ceiling, per-caller burst and daily quota, `Retry-After` on 429 | `test/image-endpoint.test.mjs` |
| F-04 | The picker listed models the request path ignored | A validated model is honoured in free-only mode too, not only when paid AI is on | `test/provider-free-only.test.mjs` |
| F-05 | Site-help detector captured unrelated questions | Two tiers: a strong product reference, or a weak word that needs product context beside it | `test/site-knowledge.test.mjs` |
| F-06 | Docs and runtime disagreed about the default provider | One contract in `docs/MAINTENANCE.md`; the env templates and product copy follow it | — |
| F-07 | Throttles are per isolate, not global | Documented as a fast guard; WAF rate limiting named as the global layer | — |
| F-08 | Node floor advertised 18, jsdom needs 20.19 | `engines.node` is `>=20.19.0`; CI runs Node 20 | `npm ci` |
| F-09 | No product analytics | Deliberately unchanged: the privacy promise is the product decision. Recorded, not silently dropped | — |
| F-10 | SSE data fields joined with a literal `\n` | New `assets/js/sse.js`, joined with a real newline, CRLF and chunk boundaries handled | `test/sse.test.mjs` |
| F-11 | `Buffer` used for image bytes with no compat flag | Worker-native base64 over `btoa`; typed arrays accepted as well as `ArrayBuffer` | `test/image-endpoint.test.mjs` |
| F-12 | Amigo is not a general tool-using agent | Out of scope for a static site with one bounded endpoint. Recorded as a product decision | — |
| F-13 | Seventeen stacked chat CSS layers | Kept, but the order is now asserted in `test/chat-shell.test.mjs` and `refine.css` is documented as the last, layout-free layer | `test/chat-shell.test.mjs` |
| F-14 | A personal mailbox shipped in browser source | The Crossref/OpenAlex `mailto` is gone; the feedback address stays, because the reader chooses to write to it | — |

Two findings were not code defects and were not "fixed": F-09 and F-12 are
product decisions, and F-07 is a platform limitation that needs WAF, not a
patch. They are recorded here rather than quietly closed.

## What was not verified

No browser, device or Lighthouse run. The provider tests mock the network, so
they prove the routing logic and the billing gate, not that OpenRouter answers
today. The live check remains `npm run verify:live` after a deploy.

---

# Deep audit — 14 November 2026 (v6.0.0)

Scope: the whole tree after the 6.0 rebuild — 22 HTML entry points, 48 ES
modules, 26 stylesheets (of which 4 are shipped bundles), 4 Pages Functions, 18
build and audit scripts, 32 test files, headers, redirects, manifest, sitemap,
robots, `llms.txt` and the image set.

## What was run

| Check | Command | Result |
|---|---|---|
| Every module parses; every named import resolves | `npm run check` | pass — 48 modules |
| Every page's local assets exist and share one build ID | `npm run check` (site audit) | pass — 22 pages, 53 JS files |
| The suite | `npm test` | pass — 296 tests |
| The identity suite | `node --test test/identity.test.mjs` | pass — 9 checks |
| Build stamping and sitemap regeneration | `npm run stamp:build` | pass — 22 pages, 21 URLs |

## Found and fixed in this release

- **A second product name was still shipping.** The social card read
  `indusmova`, and the wordmark inside it predated even that. Both are gone:
  the card is redrawn from the same geometry as the icon, and a test fails if
  the old name comes back anywhere in the shipped tree.
- **Seven pages had no skip link.** `404`, `articles/`, `help/`,
  `how-it-works/`, `questions/`, `research/` and `topics/` opened straight into
  navigation for a keyboard reader. All seven now start with a skip link that
  lands on an id that exists; the test checks the target, not just the link.
- **`research/` had no addressable main landmark.** Its `<main>` carried no id
  and no `tabindex`, so there was nothing to skip to and nothing to focus. Both
  were added.
- **Five pages carried no structured data.** `articles/`, `chat/`, `help/`,
  `how-it-works/` and `research/` now declare a `CollectionPage` or `WebPage`
  node tied to the site node, the same shape the article and topic pages use.
- **The first Wikimedia request paid for its own handshake.** The three hosts a
  page actually calls are now preconnected from the document head.
- **A stale tagline in four places.** *From question to understanding* was in
  the manifest, `config.js`, `i18n.js` and the structured data while the README
  and the repository description said *Every answer, with its source.* One
  promise now, in all of them.

## Not claimed

Nothing here is a browser measurement. Layout, contrast in situ, Lighthouse
scores and real-device behaviour still need a browser run, and the deep static
audit is a static reading of the tree.

---

# Deep audit — 12 November 2026 (v5.29.0)

Scope: every folder and file in the repository — 22 HTML entry points, 52 ES
modules, 26 stylesheets, 6 Pages Functions, the build and audit scripts, the
test suite, headers, redirects, manifest, sitemap and the image set. Each file
was read or exercised; the checks below were run against the tree, not against
memory.

## What was run

| Check | Command | Result |
|---|---|---|
| Unit and integration tests | `node --test` | 239 passed, 0 failed |
| Module / import / version check | `node scripts/check.mjs` | 47 modules parsed, every import resolves, one version everywhere |
| Site audit | `node scripts/audit-site.mjs` | 52 JS files parsed, 22 HTML pages checked, asset paths and build IDs consistent |
| Deep static audit | `node scripts/deep-audit.mjs` | 22 HTML, 52 JS, 26 CSS, 189 files — 0 problems, 0 warnings |
| Internal links and assets | link scan across every HTML file | no missing local target, no missing icon, no sitemap URL without a page |
| Unused files | reference scan across HTML/JS/CSS/functions/config | one dead stylesheet found (below); no unused image or module |
| Runtime sweep, 18 routes | headless Chromium over a local server | no JS exception, no horizontal overflow, no broken image, no thin page |

External `ERR_CERT_AUTHORITY_INVALID` entries in the browser console come from
the Wikipedia/Wikidata calls being intercepted in the audit sandbox; they are
environmental, not site faults. In production those hosts are allowed by the
`connect-src` policy in `_headers`.

## Fixed in this release

1. **The mascot was drawn twice.** `chat/index.html` put an Amigo in the rail
   brand mark *and* the same character in the welcome state, so the empty chat
   opened with two copies of the same face. The rail now carries the site facet
   and `AI Mode`; the character appears once per screen. `test/chat-ui.test.mjs`
   now asserts exactly one instance so the duplicate cannot come back.
2. **The rail's "New chat" label was invisible.** The AI Mode layer painted the
   button with the plain surface colour while the layer below forced white type
   on it, in both themes. The label now takes the ink token in light and dark.
3. **The mode switch stretched across the composer.** `html body …` in the
   experience layer outranked the new `body …` rule, so Auto / Chat / Research
   filled the row instead of sitting as a compact segmented control. Specificity
   raised; it is a centred pill again.
4. **A seam above the composer.** The experience layer drew a 1px specular rule
   across the dock, which read as a hairline across the page once the composer
   owned the floor. Removed on the chat route.
5. **Dead stylesheet removed.** `assets/css/chat-enhancements.css` was in no
   bundle and no page — 2.9 KB that could never load.

## Chat surface — Google AI Mode shape

New final layer `assets/css/chat-ai-mode.css`, appended to the chat bundle so it
settles the five older chat layers instead of adding a sixth language:

- search-led hero: one Amigo, a pill eyebrow, a balanced headline, three trust
  chips and three equal starter cards;
- answers as one card each — meta line, prose, source chips, action chips,
  follow-up chips — so a long thread reads as a stack of answers, not a
  messenger transcript;
- a single rounded composer on the floor, focus ring on the accent token,
  centred Auto / Chat / Research control above it;
- light and dark both checked; phone layout collapses starters to one line and
  drops the decorative avatar;
- no new colours: only the `--im-*` tokens the earlier layers already own.

## Left as it was, on purpose

- Old `bundle-*.css` files stay on disk: the filename is a content hash, and a
  cached HTML page still asks for the previous name. Deleting them turns a cache
  hit into an unstyled page.
- `article-translate-page.js` is loaded by `article-points.js`; its separate
  script tag is stripped by the build, which is correct.

---

# Follow-up release — 12 November 2026 (v5.30.0)

Second pass over the same tree, this time on the chat's behaviour rather than
its layout.

## Added

- **`assets/js/site-knowledge.js`** — the site's own facts in one place: every
  page with a one-line purpose, the sources, the privacy model, the provider
  order, the limits, the languages and the version. `isSiteQuestion()` decides
  whether a message is about Veridell; `siteAnswerMarkdown()` writes the
  answer, with real links, in English or Hindi; `SITE_CONTEXT` is the same
  material injected into the model prompt. A site question is now answered
  locally: no search, no provider call, no quota, and no chance of a model
  inventing a feature the site does not have.
- **Question-aware model routing** in `functions/api/ask.js`. `routeFor()` reads
  the message and the depth, then names the band it will spend in: `light` for
  greetings and short conversation, `normal` for an everyday question, `heavy`
  for long, comparative or Deep questions. The chat path no longer hard-codes
  the `quick` model for every message.
- **Cheapest-first by live price.** `autoModel()` now sorts the allowed band by
  OpenRouter's own price list (output weighted ×3, because output tokens
  dominate an answer) instead of trusting the order of the catalogue array.
- **A verification strip on every answer** — the badge (Source-backed, From the
  library, Site guide, Conversation), `n/m sources cited`, and the model that
  wrote it. Trust is stated on the answer, not buried in a footer.
- **Site doorways in the rail** — Articles, Topics, Library, Sources, How it
  works — so the chat integrates with the site instead of sitting beside it.
- **Internal links in answers.** The markdown renderer now keeps a same-site
  route (`/articles/`, `/#/library`) in the current tab, while external sources
  still open in a new one.

## Fixed

- A site answer could print `[1]`-style text that the renderer turned into a
  citation link pointing at no source card. Those sentences are now written in
  words, and a test asserts no site answer contains a bare citation marker.
- Site answers offered follow-ups like "What is the history of About
  Veridell?" — a follow-up row built from the answer title. Suppressed for site
  answers, which already end with the real pages.
- The privacy sentence was printed twice in a site answer; the essentials list
  now defers to the "Your data" section.

## Verified

`node --test` 250 passed / 0 failed (11 new tests in
`test/site-knowledge.test.mjs`), `check.mjs` 48 modules, `deep-audit.mjs` 22
HTML / 53 JS / 26 CSS — 0 problems. Headless Chromium: one mascot on the empty
screen, a site answer rendered with five working internal links, no JS
exception.

---

# Free OpenRouter — 13 November 2026 (v5.31.0)

OpenRouter was configured with six keys but never used: the endpoint gated the
provider behind `ENABLE_PAID_AI=true`, so every answer came from Workers AI.

That gate exists to stop a surprise bill, and it should. But OpenRouter
publishes free variants of many models under an id ending in `:free`, and those
cost nothing. So the gate is now split in two:

- **`OPENROUTER_FREE_ONLY`** (default `true`) — only `:free` ids are ever sent.
  Enforced three times: the catalogue is filtered to free entries, the operator
  allowlist cannot add a paid id, and `runOpenRouter()` re-checks the first id
  in the queue before spending anything. Auto therefore always lands on a free
  model.
- **`ENABLE_PAID_AI`** — still required, and still `false`, before any paid id
  can be reached. `ALLOW_PAID_FALLBACK` is forced off while free-only is on.

Selecting `AI_PROVIDER=openrouter` is now enough to run the free models; the
six keys rotate as before. Deployment environment (production):

| Variable | Value |
|---|---|
| `AI_PROVIDER` | `openrouter` |
| `OPENROUTER_FREE_ONLY` | `true` |
| `OPENROUTER_API_KEY_1…6` | unchanged (secrets preserved) |
| `ENABLE_PAID_AI` | unset — no paid model is reachable |

Tests: `test/free-only-openrouter.test.mjs` (8 tests) pins the default, the id
rule, the provider decision, the allowlist escape hatch, the fallback, and Auto
always choosing a free model.

## What the live deployment taught us (v5.31.1 → v5.31.3)

Three faults only appeared once the configuration was real, and each is now
covered by a test or by repository config:

1. **A dashboard-only variable does not survive a deploy.** `AI_PROVIDER` and
   `OPENROUTER_FREE_ONLY` were set through the API and were gone from the next
   deployment's snapshot: a Pages build syncs plain-text variables from
   `wrangler.toml`, so anything set only in the dashboard is written back. They
   live in `[vars]` in `wrangler.toml` now.
2. **The curated free ids had all aged out.** OpenRouter's catalogue carried 14
   `:free` ids, none of them the six this file listed, so the filtered menu was
   empty. Free ids are now discovered from the live catalogue as well.
3. **An empty band fell back to a paid model.** `autoModel()` ended on
   `DEFAULT_OPENROUTER_MODEL` (`openai/gpt-4o-mini`), so a free-only deployment
   with an empty menu advertised a paid id. In free-only mode an empty band
   returns nothing, and a free id is offered even when the catalogue call is
   quiet, because free variants rotate weekly and a 404 on a retired one is
   cheaper than an empty menu.

Live state after v5.31.3: `/api/models` reports `providerMode: openrouter`,
`freeOnly: true`, `paidAIEnabled: false`, six free models and
`auto: meta-llama/llama-3.3-70b-instruct:free`.
