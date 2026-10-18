import { describe, expect, it, vi } from "vitest";
import {
  connectedTestClient,
  fakeFormVaultClient,
  toolTextResult,
} from "../testUtils.js";
import { FormVaultApiError } from "../apiClient.js";

const baseForm = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Contact form",
  description: null,
  fields: [{ id: "q1", type: "text", label: "Name", required: true }],
  settings: {},
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("list_forms tool", () => {
  it("summarizes each form with a field count instead of the full fields array", async () => {
    const client = fakeFormVaultClient();
    vi.spyOn(client, "listForms").mockResolvedValue([baseForm]);

    const { client: mcpClient } = await connectedTestClient(client);
    const result = await mcpClient.callTool({
      name: "list_forms",
      arguments: {},
    });

    expect(toolTextResult(result)).toMatchObject([
      { id: baseForm.id, name: "Contact form", fieldCount: 1 },
    ]);
  });
});

describe("get_form tool", () => {
  it("returns the matching form from the tenant's list", async () => {
    const client = fakeFormVaultClient();
    vi.spyOn(client, "listForms").mockResolvedValue([baseForm]);

    const { client: mcpClient } = await connectedTestClient(client);
    const result = await mcpClient.callTool({
      name: "get_form",
      arguments: { formId: baseForm.id },
    });

    expect(toolTextResult(result)).toMatchObject({ id: baseForm.id });
  });

  it("reports not found for an id outside this tenant's forms", async () => {
    const client = fakeFormVaultClient();
    vi.spyOn(client, "listForms").mockResolvedValue([]);

    const { client: mcpClient } = await connectedTestClient(client);
    const result = await mcpClient.callTool({
      name: "get_form",
      arguments: { formId: "99999999-9999-4999-8999-999999999999" },
    });

    expect(result.isError).toBe(true);
  });
});

describe("create_form tool", () => {
  it("passes the input through and returns the created form with a public URL", async () => {
    const client = fakeFormVaultClient();
    const spy = vi.spyOn(client, "createForm").mockResolvedValue(baseForm);

    const { client: mcpClient } = await connectedTestClient(client);
    const result = await mcpClient.callTool({
      name: "create_form",
      arguments: {
        name: "Contact form",
        fields: [{ id: "q1", type: "text", label: "Name", required: true }],
      },
    });

    expect(spy).toHaveBeenCalledWith({
      name: "Contact form",
      fields: [{ id: "q1", type: "text", label: "Name", required: true }],
    });
    expect(toolTextResult(result)).toMatchObject({
      id: baseForm.id,
      publicUrl: `https://formvault.eu/form/${baseForm.id}`,
    });
  });
});

describe("delete_form tool", () => {
  it("deletes the form and confirms success", async () => {
    const client = fakeFormVaultClient();
    const spy = vi.spyOn(client, "deleteForm").mockResolvedValue(undefined);

    const { client: mcpClient } = await connectedTestClient(client);
    const result = await mcpClient.callTool({
      name: "delete_form",
      arguments: { formId: baseForm.id },
    });

    expect(spy).toHaveBeenCalledWith(baseForm.id);
    expect(toolTextResult(result)).toMatchObject({ deleted: baseForm.id });
  });

  it("surfaces an API error as a tool error instead of throwing", async () => {
    const client = fakeFormVaultClient();
    vi.spyOn(client, "deleteForm").mockRejectedValue(
      new FormVaultApiError(404, { error: "Form not found" }),
    );

    const { client: mcpClient } = await connectedTestClient(client);
    const result = await mcpClient.callTool({
      name: "delete_form",
      arguments: { formId: baseForm.id },
    });

    expect(result.isError).toBe(true);
  });
});
