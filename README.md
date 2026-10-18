# @formvault/mcp

An [MCP](https://modelcontextprotocol.io) server for [FormVault](https://formvault.eu) — a GDPR-first form builder hosted in Germany.

Point Claude, ChatGPT, Cursor, Copilot or any MCP-compatible assistant at your FormVault account and build forms by describing them.

## Setup (hosted — recommended)

Create an API key at [formvault.eu/app/api-keys](https://formvault.eu/app/api-keys), then add the hosted server to your assistant's MCP configuration — no install, no local process:

```json
{
  "mcpServers": {
    "formvault": {
      "url": "https://api.formvault.eu/mcp",
      "headers": {
        "Authorization": "Bearer fv_your_key_here"
      }
    }
  }
}
```

Claude Desktop's support for remote/header-based MCP servers depends on your version — check its current docs if the above doesn't show up as an option.

No tool takes a tenant id. The API key carries its own, so it cannot read or write another organisation's forms — and a form id it may not touch reports as _not found_ rather than _forbidden_, so a key cannot be used to discover what exists. The server itself holds no standing credentials of its own; every request is scoped to whichever key you send. Revoke a key at any time from the API keys page.

## Setup (npx / stdio)

For clients that don't yet support a remote/header-based server:

```json
{
  "mcpServers": {
    "formvault": {
      "command": "npx",
      "args": ["-y", "@formvault/mcp"],
      "env": {
        "FORMVAULT_API_KEY": "fv_your_key_here"
      }
    }
  }
}
```

Restart your assistant and ask for what you need — _"build me a client intake form with a GDPR consent checkbox"_.

| Variable            | Required | Default                    |
| ------------------- | -------- | -------------------------- |
| `FORMVAULT_API_KEY` | yes      | —                          |
| `FORMVAULT_API_URL` | no       | `https://api.formvault.eu` |

## Self-hosting / local development

You can also run this package yourself, either as a local stdio server or as your own HTTP deployment:

```bash
pnpm install
pnpm build

# stdio (for a local Claude Desktop/Code config using "command"/"args")
FORMVAULT_API_KEY=fv_... node dist/index.js

# HTTP (what the hosted deployment runs)
PORT=3003 FORMVAULT_API_URL=https://api.formvault.eu node dist/httpServer.js
```

To develop against a local FormVault API, point `FORMVAULT_API_URL` at it (for example `http://localhost:3000`).

## Tools

| Tool               | What it does                                  |
| ------------------ | --------------------------------------------- |
| `list_forms`       | Every form in your account, with field counts |
| `get_form`         | One form's full field and settings definition |
| `create_form`      | Build a form from a description               |
| `delete_form`      | Remove a form (irreversible)                  |
| `list_submissions` | Decrypted responses for a form                |

## About respondent data

`list_submissions` returns your respondents' personal data in the clear. It is described to the model with an instruction not to call it unless you explicitly ask for responses, so ordinary form-building work never pulls it into context.

That is a deliberate boundary, not a limitation. FormVault stores submissions encrypted with AES-256-GCM on servers in Nuremberg, Germany, with a signed DPA on every plan. Whatever you send to your AI provider is your decision — this server's job is to make sure it is a decision rather than a side effect.

## Links

- [formvault.eu/mcp](https://formvault.eu/mcp)
- [Data processing agreement](https://formvault.eu/dpa)
- [Privacy](https://formvault.eu/privacy)

## License

[MIT](LICENSE)
