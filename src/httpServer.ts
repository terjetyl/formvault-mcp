import {
  createServer as createNodeHttpServer,
  type IncomingMessage,
  type ServerResponse,
  type Server,
} from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { FormVaultClient } from "./apiClient.js";
import { createServer as createMcpServer } from "./server.js";

export interface HttpServerOptions {
  // Injectable so tests can substitute a fake client instead of hitting a
  // real API — same spy-based approach already used for the stdio tool tests.
  clientFactory: (apiKey: string) => FormVaultClient;
}

function getBearerToken(req: IncomingMessage): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim() || null;
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

// A fresh McpServer + transport per request, scoped to that request's own
// bearer token. Nothing is kept between requests, so there's no shared
// state one user's request could ever read or influence another's through.
async function handleMcpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  clientFactory: (apiKey: string) => FormVaultClient,
) {
  const apiKey = getBearerToken(req);
  if (!apiKey) {
    sendJson(res, 401, { error: "Missing bearer token" });
    return;
  }

  const client = clientFactory(apiKey);
  const mcpServer = createMcpServer(client);
  const transport = new StreamableHTTPServerTransport({
    // No session store: every request is independently authenticated and
    // every tool call is already a stateless wrapper over a REST call.
    sessionIdGenerator: undefined,
    // Avoids SSE framing for what's always a single request/response here —
    // simpler to reason about behind a reverse proxy, and none of these
    // tools need server-initiated streaming.
    enableJsonResponse: true,
  });

  res.on("close", () => {
    void transport.close();
    void mcpServer.close();
  });

  try {
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res);
  } catch (err) {
    if (!res.headersSent) {
      sendJson(res, 500, {
        error: "Internal server error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

export function createHttpServer(options: HttpServerOptions): Server {
  const { clientFactory } = options;

  return createNodeHttpServer((req, res) => {
    if (req.method === "GET" && req.url?.replace(/\/+$/, "") === "/health") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("ok");
      return;
    }

    // Everything else is the MCP endpoint — Caddy only ever forwards
    // traffic here after matching the public /mcp* mount point, so this
    // process doesn't need to know or care about its own public path.
    void handleMcpRequest(req, res, clientFactory);
  });
}

export function defaultClientFactory(apiKey: string): FormVaultClient {
  const baseUrl = process.env.FORMVAULT_API_URL;
  if (!baseUrl) {
    throw new Error("FORMVAULT_API_URL must be set");
  }
  return new FormVaultClient({ baseUrl: baseUrl.replace(/\/+$/, ""), apiKey });
}

// Only start listening when this file is run directly (`node dist/httpServer.js`),
// not when httpServer.test.ts imports createHttpServer to test it in isolation.
const isMain =
  process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const port = parseInt(process.env.PORT || "3003", 10);
  const host = process.env.HOST || "0.0.0.0";
  const server = createHttpServer({ clientFactory: defaultClientFactory });
  server.listen(port, host, () => {
    console.log(`formvault-mcp http server listening on ${host}:${port}`);
  });
}
