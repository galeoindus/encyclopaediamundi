# Veridell

**Every answer, with its source.**

A question in your own words, answered from Wikipedia and Wikidata: a lead, the
sentences that actually answer it, numbered topics, and the article each one
came from. Plus Amigo, a chat that answers from those sources and says so when
it is answering from general knowledge instead.

This repository is a rewrite of the site. Same design, same features, new code:
a different module layout, a different stylesheet with its own class names, a
different endpoint, and its own test suite. It exists as a separate repository
because a Cloudflare Pages project belongs to the account that created it, and
a GitHub repository can only be attached to one Pages project at a time — a new
repository is the clean way onto a new account.

---

## What is here

```
index.html            the app shell — one document, hash routes
chat/index.html       Amigo
src/                  the modules the browser imports
  main.js             router and shell
  chat.js             the chat page: three runtimes, one composer
  views.js            home, answer, explore, today, library, sources, saved
  answer.js           article → answer (lead, key sentences, ranked topics)
  wiki.js             the Wikimedia client
  markdown.js         the small markdown subset a model writes
  core.js             tokens, storage, theme, DOM helper
styles/site.css       one stylesheet, built from tokens
functions/api/ask.js  the AI endpoint: Workers AI, then OpenRouter
data/articles.json    the article content the static pages are built from
scripts/build-pages.mjs   writes the crawlable pages and the sitemap
scripts/deploy.mjs        creates the Pages project if missing, then uploads
tests/site.test.mjs   the checks that keep it honest
```

Everything is static: no bundler, no framework, no build step for the app
itself. `npm run build` only writes the crawlable article pages.

## Features

- **Ask** — a question becomes a Wikipedia search; the best article is rebuilt
  around the question rather than shown as a wall of text.
- **Depth** — Quick, Detailed and Deep change how much of the article is shown,
  immediately, without a second request.
- **Amigo chat** — a search-shaped composer, answers in plain language, source
  chips, follow-up questions, and a copy button. It answers every question: if
  no article matches, the turn is answered as conversation and labelled
  **General answer** instead of being given a false citation.
- **Three runtimes** — Cloudflare Workers AI (free, default), OpenRouter
  (free-only unless the operator says otherwise), and Ollama on the reader's own
  machine, called straight from the browser so nothing leaves the device.
- **Library** — one search across Wikipedia, Wikiquote and Wikisource.
- **On this day**, **Explore**, **Saved** — kept in the browser, no account.
- **Twelve source languages**, light and dark themes, reduced-motion support.
- **Crawlable** — thirteen full article pages, topics, questions, help, how it
  works and research are real HTML files with their own head and JSON-LD, and
  `sitemap.xml` is generated from the files that exist.

## Running it

```bash
npm start          # http://localhost:4173 — a static server is enough
npm run build      # rewrite the crawlable pages and the sitemap
npm run verify     # syntax check, build, tests
```

The chat needs the `/api/ask` function, which only runs under Cloudflare Pages
(`npm run dev` with Wrangler) — or switch the chat to **This device · Ollama**
and it needs no server at all.

## Deploying

```bash
npm run deploy
```

That reads the project name from `wrangler.toml`, creates the Pages project if
the account has none, builds the pages and uploads. By hand it is two commands,
and the first is the one people forget:

```bash
npx wrangler pages project create veridell --production-branch=main
npx wrangler pages deploy . --project-name=veridell
```

**A fresh Cloudflare account has no Pages projects.** A project belongs to the
account that made it, so a new account starts empty and `pages deploy` answers
`Project not found` until the project exists. That message means a missing
project, not a broken repository.

For publishing on every push, add two repository secrets — `CLOUDFLARE_API_TOKEN`
(a token with *Cloudflare Pages: Edit*) and `CLOUDFLARE_ACCOUNT_ID` — and the
workflow in `.github/workflows/deploy.yml` does the rest. Without them it skips
instead of failing.

**Do not use "Connect to Git" for a repository that was already connected to a
Pages project in another account.** Cloudflare answers *"This repository is
being used for a Cloudflare Pages project on a different Cloudflare account"*.
Either remove the Cloudflare Pages app's access to that repository on GitHub
(Settings → Applications → Cloudflare Pages → Configure), or deploy by upload
as above, which needs no Git connection at all.

The host is `https://veridell.pages.dev/`. If you deploy under a
different name, change it in one commit in: `wrangler.toml`, `index.html`,
`chat/index.html`, `robots.txt`, `llms.txt`, `scripts/build-pages.mjs` (the
`ORIGIN` constant) and rebuild.

## The AI endpoint

`POST /api/ask` takes `{ question, mode, depth, passages?, history? }` and
returns `{ answer, provider, model, sources }`.

- `mode: "grounded"` — the passages the browser sent are the only evidence;
  citations are `[1]`, `[2]` and must point at a passage.
- `mode: "chat"` — no sources, no citations, a plain answer.

Workers AI is tried first because it is free and needs no key. OpenRouter is
used only when `OPENROUTER_API_KEY_1..6` (or `OPENROUTER_API_KEY`) is set, and
is free-only unless `OPENROUTER_FREE_ONLY=false`. No key, no provider error and
nothing about the caller is ever returned to the browser.

## Licences

Code: MIT. Wikipedia text: CC BY-SA 4.0. Wikidata: CC0 1.0. Wikimedia Commons
images carry their own licence. Veridell is an independent reader and
is not affiliated with or endorsed by the Wikimedia Foundation.
