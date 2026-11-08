# PR evidence: before/after screenshots and video

Done = the PR body shows a **before** and an **after** of the same screen, each with a one-line caption, served as GitHub attachments. Video or GIF for anything that moves; a still for the rest.

## 1. Run the real app

Start your own server on a port you confirmed free, then seed it:

```bash
lsof -iTCP:<port> -sTCP:LISTEN   # empty output = free
DATABASE_URL= PGLITE_DIR=.data/pglite-<name> BETTER_AUTH_URL=http://localhost:<port> vite dev --port <port> --strictPort   # from apps/web
SEED_URL=http://localhost:<port> pnpm db:seed
```

## 2. Capture

```bash
BASE=http://localhost:<port> pnpm shots <absolute-out-dir> [name,filter] [1440,390] [light,dark]
```

It signs in as the demo user, captures public pages logged out and app pages logged in, and prints `OVERFLOW` for any horizontal scroll. Output stays outside the repo. **Before** is a checkout of `origin/main`, captured the same way. Measure the claim next to the picture: the image shows it, the number proves it.

## 3. Attach

`gh` uploads attachments and rewrites relative references in the body. The PR hook reads `--body-file` from the literal command before it runs, so write the file in an earlier command and pass its absolute path:

```bash
gh pr create --body-file /abs/body.md --attach /abs/before.png --attach /abs/after.png
```

The body comes back with `user-attachments` URLs. For later edits, save the live body with `gh pr view <n> --json body --jq .body` and edit that, so they survive.
