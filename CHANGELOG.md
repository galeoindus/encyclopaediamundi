# Changelog

Every release that changed the shipped site. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[semantic versioning](https://semver.org/): a major version means the reading
model or the identity changed, a minor means a surface was added, a patch means
something was fixed.

The build id on every page is `<version>-<commit>`, written by
`npm run stamp:build`. If the two disagree, the page was hand-edited.

## [Unreleased]

Nothing yet.

## [6.1.0] — 14 November 2026

The release that makes the repository as orderly as the site. No reading
behaviour changed; everything here is about finding things, keeping them
consistent, and noticing drift before a reader does.

### Added

- **`npm run doctor`** — one command that runs the push-time checks in the
  order that fails fastest and prints a single verdict. `npm run doctor:full`
  adds the 270-test suite. Wired into CI and into the weekly health run.
- **`docs/`** — the working documents in one folder with an index
  (`docs/README.md`), so the repository root holds the front door, the licence
  and the changelog rather than eight loose markdown files.
- **`docs/MAINTENANCE.md`** — the runbook: what to run, how often, what each
  failure means, how to add an article, how to release, and what must never be
  committed.
- **`CODE_OF_CONDUCT.md`** — including the one rule specific to this project:
  a change that lets the product present an uncited claim as sourced is out of
  scope.
- **`.editorconfig`** — two-space indent, LF, a final newline, and the one
  exception that matters: markdown keeps its trailing double spaces, because
  they are hard line breaks.
- **`CHANGELOG.md`** — this file.

### Changed

- `CONTRIBUTING.md`, `DESIGN.md`, `AUDIT.md`, `QUALITY.md` and `SECURITY.md`
  moved into `docs/`. Git history follows them; the old root paths are gone
  rather than duplicated, so there is one copy of each document.
- The README now carries a repository map and a short "keeping it organised"
  section that points at the runbook instead of restating it.

### Removed

- Four empty directories (`data/`, `src/`, `styles/`, `tests/`) left behind by
  the previous rewrite. Git never tracked them, but they made a fresh checkout
  look like it had two of everything.

### Verified

`npm run check` — 48 modules, 22 pages, one version. `npm test` — 270 passed,
0 failed. `npm run doctor:full` — all green.

## [6.0.0] — 14 November 2026

The rebuild. The whole site was brought onto one identity and one checked set of
pages, on the capability set of the earlier Encyclopaedia Mundi tree, under the
repository name that was already published.

### Added

- **A new mark** — a faceted V on the forest-to-copper tile, with a single dot
  beneath the point for the source. Shipped as SVG and at 48, 96, 180, 192 and
  512 px, plus a maskable icon and a 1200×630 social card drawn from the same
  geometry.
- **`test/identity.test.mjs`** — nine checks that read the files that ship and
  fail if a page loses its skip link or its canonical, if a stylesheet ships
  unreferenced, if the old product name returns, if a brand asset goes missing,
  or if the package, the manifest and `wrangler.toml` disagree on one name.
- **Preconnect** to the three Wikimedia hosts a page actually calls, from the
  document head.
- **Structured data** on `articles/`, `chat/`, `help/`, `how-it-works/` and
  `research/`, matching the shape the article and topic pages already used.

### Changed

- **One name everywhere** — product, package, Pages project, manifest, storage
  keys, meta tags and canonical host are all `veridell`; the repository stays
  `galeoindus/veridell`.
- **One promise** — *Every answer, with its source.* replaces *From question to
  understanding* in the manifest, `config.js`, `i18n.js` and the structured
  data.
- **All 22 pages** now carry a skip link that lands on a landmark that exists.
  `research/` gained the addressable `<main>` it never had.
- The site now ships the full capability set of the earlier tree: the research
  desk, the library across sister projects, on-this-day, topics, the twelve
  content languages and the Amigo chat surface.

### Fixed

- The social card read `indusmova`, with a wordmark two renames out of date. It
  was shipping on every link preview.

## Earlier

The site ran as Encyclopaedia Mundi through 5.29–5.34 before this repository
carried it. Those releases added the AI Mode chat surface, question-aware model
routing, the site guide that answers questions about the product itself from the
product's own facts, and free-only OpenRouter routing. Their detail lives in
`docs/AUDIT.md`, which is append-only.
