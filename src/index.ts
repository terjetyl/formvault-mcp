#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { clientFromEnv } from "./apiClient.js";
import { createServer } from "./server.js";

async function main() {
  const client = clientFromEnv();
  const server = createServer(client);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("formvault-mcp failed to start:", err);
  process.exit(1);
});
