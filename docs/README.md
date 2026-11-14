# Veridell — documentation

The root `README.md` is the front door: what the site is, how to run it, how to
deploy it. Everything below is the detail you need once you are working on it,
kept in one folder so the repository root stays readable.

| Document | Read it when |
|---|---|
| [MAINTENANCE.md](MAINTENANCE.md) | You want the runbook: what to run, how often, and what each failure means. |
| [DESIGN.md](DESIGN.md) | You are changing anything visual — identity, tokens, surfaces, motion, reading width. |
| [QUALITY.md](QUALITY.md) | You need to know what was actually verified, on which commit, and what was not. |
| [AUDIT.md](AUDIT.md) | You want the history of what was found and fixed, release by release. |
| [CONTRIBUTING.md](CONTRIBUTING.md) | You are about to open a pull request. |
| [SECURITY.md](SECURITY.md) | You found a vulnerability, or you are reviewing how secrets are handled. |

## How this folder is kept honest

- **QUALITY.md is a record, not a claim.** It names the command, the commit and
  the date for every check. If a check was not run, it says so. A number in that
  file without a command beside it is a bug.
- **AUDIT.md is append-only.** A new release prepends a section; old sections
  are never rewritten, so the history of what was believed at the time survives.
- **DESIGN.md describes the system as it is**, not as it was planned. When a
  token or a rule changes, the table changes in the same commit.
- **MAINTENANCE.md is the runbook** and the only place that says how often
  something should be run. If a check is added, it is added there too.

## Where everything lives

```
README.md              the front door
docs/                  this folder
.github/               CI, the weekly health run, issue and PR templates
articles/<slug>/       the thirteen published articles, as real HTML
assets/js/             the ES modules the browser imports
assets/css/            the stylesheets, and the four built bundles
functions/api/         the Pages Functions (ask, models, speech, image)
scripts/               build, audit, release and maintenance scripts
test/                  the suite, one file per concern
```

A file that is not in one of those places is either generated (the bundles, the
sitemap, `assets/version.json`) or should not be in the repository at all.
