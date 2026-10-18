import { describe, expect, it, vi } from "vitest";
import {
  connectedTestClient,
  fakeFormVaultClient,
  toolTextResult,
} from "../testUtils.js";

describe("list_submissions tool", () => {
  it("returns decrypted submissions for the form", async () => {
    const client = fakeFormVaultClient();
    const spy = vi.spyOn(client, "listSubmissions").mockResolvedValue([
      {
        id: "sub-1",
        formId: "form-1",
        submittedAt: "2026-01-01T00:00:00.000Z",
        data: { name: "Ada Lovelace" },
      },
    ]);

    const { client: mcpClient } = await connectedTestClient(client);
    const result = await mcpClient.callTool({
      name: "list_submissions",
      arguments: { formId: "form-1" },
    });

    expect(spy).toHaveBeenCalledWith("form-1");
    expect(toolTextResult(result)).toMatchObject([
      { id: "sub-1", data: { name: "Ada Lovelace" } },
    ]);
  });

  it("caps results at the requested limit", async () => {
    const client = fakeFormVaultClient();
    vi.spyOn(client, "listSubmissions").mockResolvedValue([
      {
        id: "sub-1",
        formId: "form-1",
        submittedAt: "2026-01-01T00:00:00.000Z",
        data: {},
      },
      {
        id: "sub-2",
        formId: "form-1",
        submittedAt: "2026-01-02T00:00:00.000Z",
        data: {},
      },
    ]);

    const { client: mcpClient } = await connectedTestClient(client);
    const result = await mcpClient.callTool({
      name: "list_submissions",
      arguments: { formId: "form-1", limit: 1 },
    });

    expect(toolTextResult(result)).toMatchObject([{ id: "sub-1" }]);
  });
});
