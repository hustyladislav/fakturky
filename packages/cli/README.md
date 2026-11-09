# fakturky (CLI)

Command-line client for [Fakturky](https://fakturky.vercel.app), the free Czech invoicing app.
Commands are generated from the server's OpenAPI spec, so every API capability is available.

> Not published to npm yet; the commands below work once it is.

```bash
npx fakturky login              # paste an API key (Nastavení → API klíče); stored with mode 0600
npx fakturky whoami
npx fakturky contacts list --json
npx fakturky contacts create --name "ACME s.r.o." --ico 12345678 --emails '["fakturace@acme.cz"]'
npx fakturky documents create-draft --data @invoice.json
npx fakturky documents issue <id>
```

- `--json` prints raw JSON; otherwise tables / key-value output.
- `--data` takes JSON, `@file.json` or `-` (stdin); individual body fields are also flags.
- Environment: `FAKTURKY_API_KEY`, `FAKTURKY_URL` (default `https://fakturky.vercel.app`).
- Config: `$XDG_CONFIG_HOME/fakturky/config.json` (default `~/.config/fakturky/`).

## Releasing (maintainers)

`.github/workflows/publish-cli.yml` publishes to npm with provenance when a tag `cli-v<version>` is pushed
(the tag must match `package.json`). It needs the repository secret `NPM_TOKEN`.

```bash
# bump packages/cli/package.json "version", merge to main, then:
git tag cli-v0.1.1 && git push origin cli-v0.1.1
```
