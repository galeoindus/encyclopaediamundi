# Security

## What this site holds

Nothing about you. There is no account, no sign-in, no analytics script and no
server-side history. Chat threads, saved answers and memory notes live in your
browser's own storage.

The only thing that leaves the browser is what a question needs: the question,
the passages it was answered from, and — if you attached one — the text of that
file. That goes to this site's `/api/ask`, which forwards it to the configured
model runtime and keeps nothing.

## Reporting a problem

Open an issue with the `security` label, or write to the address on the GitHub
profile. Please do not open a public issue for anything that would let someone
else exploit it before it is fixed.

## What is deliberately not here

- No API key in the client. The model keys are Cloudflare secrets, server-side.
- No third-party script. The content policy allows `script-src 'self'` only.
- No `innerHTML` with model output: markdown is escaped first, then our own tags
  are introduced, and links are limited to http(s).
