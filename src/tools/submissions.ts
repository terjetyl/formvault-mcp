import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FormVaultClient } from "../apiClient.js";
import { jsonResult, withErrorHandling } from "./helpers.js";

export function registerSubmissionTools(
  server: McpServer,
  client: FormVaultClient,
) {
  server.registerTool(
    "list_submissions",
    {
      title: "List submissions",
      description:
        "List decrypted submissions for a form. This returns respondents' personal data — only call it when the " +
        "user has asked for submission content, and do not repeat it further than needed to answer.",
      inputSchema: {
        formId: z.string().describe("UUID of the form"),
        limit: z
          .number()
          .optional()
          .describe("Maximum submissions to return (default 20)"),
      },
    },
    withErrorHandling(
      async ({ formId, limit }: { formId: string; limit?: number }) => {
        const rows = await client.listSubmissions(formId);
        return jsonResult(rows.slice(0, limit ?? 20));
      },
    ),
  );
}
