import type { AddressInfo } from "node:net";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHttpServer } from "./httpServer.js";
import { fakeFormVaultClient } from "./testUtils.js";
import type { FormVaultClient } from "./apiClient.js";

describe("MCP HTTP server", () => {
  let server: ReturnType<typeof createHttpServer>;
  let baseUrl: URL;
  let clientFactory: ReturnType<
    typeof vi.fn<(apiKey: string) => FormVaultClient>
  >;

  beforeEach(async () => {
    clientFactory = vi.fn((_apiKey: string) => fakeFormVaultClient());
    server = createHttpServer({ clientFactory });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address() as AddressInfo;
    baseUrl = new URL(`http://127.0.0.1:${address.port}/`);
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("responds to /health without any auth", async () => {
    const res = await fetch(new URL("/health", baseUrl));
    expect(res.status).toBe(200);
    expect(clientFactory).not.toHaveBeenCalled();
  });

  it("rejects a request with no bearer token, without ever calling the client factory", async () => {
    const res = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {},
      }),
    });
    expect(res.status).toBe(401);
    expect(clientFactory).not.toHaveBeenCalled();
  });

  it("routes a real tool call through the injected client, scoped to that request's bearer token", async () => {
    const fake = fakeFormVaultClient();
    const spy = vi.spyOn(fake, "listForms").mockResolvedValue([]);
    clientFactory.mockReturnValue(fake);

    const transport = new StreamableHTTPClientTransport(baseUrl, {
      requestInit: {
        headers: { Authorization: "Bearer fv_test_key_from_client" },
      },
    });
    const mcpClient = new Client({ name: "test-client", version: "0.0.0" });
    await mcpClient.connect(transport);

    const result = await mcpClient.callTool({
      name: "list_forms",
      arguments: {},
    });

    expect(result.isError).toBeFalsy();
    expect(clientFactory).toHaveBeenCalledWith("fv_test_key_from_client");
    expect(spy).toHaveBeenCalled();

    await mcpClient.close();
  });

  it("gives two concurrent requests with different keys their own, unshared client instance", async () => {
    const clientA = fakeFormVaultClient();
    const clientB = fakeFormVaultClient();
    const baseForm = {
      description: null,
      fields: [],
      settings: {},
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    vi.spyOn(clientA, "listForms").mockResolvedValue([
      { ...baseForm, id: "form-a", name: "A" },
    ]);
    vi.spyOn(clientB, "listForms").mockResolvedValue([
      { ...baseForm, id: "form-b", name: "B" },
    ]);
    clientFactory.mockImplementation((apiKey: string) =>
      apiKey === "key-a" ? clientA : clientB,
    );

    async function callAs(apiKey: string) {
      const transport = new StreamableHTTPClientTransport(baseUrl, {
        requestInit: { headers: { Authorization: `Bearer ${apiKey}` } },
      });
      const mcpClient = new Client({ name: "test-client", version: "0.0.0" });
      await mcpClient.connect(transport);
      const result = await mcpClient.callTool({
        name: "list_forms",
        arguments: {},
      });
      await mcpClient.close();
      const text = (result.content as { text: string }[])[0]!.text;
      return JSON.parse(text) as { id: string }[];
    }

    const [resultA, resultB] = await Promise.all([
      callAs("key-a"),
      callAs("key-b"),
    ]);

    expect(resultA[0]?.id).toBe("form-a");
    expect(resultB[0]?.id).toBe("form-b");
  });
});
