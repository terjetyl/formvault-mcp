import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { FormVaultClient } from "./apiClient.js";
import { createServer } from "./server.js";

// Connects a real MCP Client to a real McpServer over an in-memory
// transport, so tests exercise actual tool registration/validation/dispatch
// instead of reaching into SDK internals.
export async function connectedTestClient(formVaultClient: FormVaultClient) {
  const server = createServer(formVaultClient);
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.0" });

  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ]);

  return { client, server };
}

export function fakeFormVaultClient() {
  return new FormVaultClient({
    baseUrl: "http://formvault-test.invalid",
    apiKey: "fv_test",
  });
}

export function toolTextResult(
  result: Awaited<ReturnType<Client["callTool"]>>,
): unknown {
  const first = (result.content as { type: string; text?: string }[])[0];
  if (!first || first.type !== "text" || typeof first.text !== "string") {
    throw new Error("Expected a single text content block in tool result");
  }
  return JSON.parse(first.text);
}
