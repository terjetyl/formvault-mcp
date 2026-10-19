import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FormVaultClient } from "../apiClient.js";
import { jsonResult, errorResult, withErrorHandling } from "./helpers.js";

const FIELD_TYPES = [
  "text",
  "email",
  "phone",
  "date",
  "select",
  "checkbox",
  "consent",
  "textarea",
  "number",
  "rating",
  "multiselect",
  "hidden",
  "file",
  "page_break",
  "calculated",
] as const;

const fieldSchema = z.object({
  id: z.string().describe("Unique id for this field within the form"),
  type: z.enum(FIELD_TYPES),
  label: z.string(),
  required: z.boolean(),
  placeholder: z.string().optional(),
  options: z
    .array(z.string())
    .optional()
    .describe("Choices for select/multiselect"),
  min: z.number().optional().describe("For number/rating"),
  max: z.number().optional().describe("For number/rating"),
  defaultValue: z.string().optional().describe("For hidden fields"),
  accept: z.string().optional().describe("MIME type filter, for file fields"),
  maxSizeMb: z.number().optional().describe("For file fields"),
});

const settingsSchema = z.object({
  successMessage: z
    .string()
    .optional()
    .describe("Message shown to the respondent after they submit"),
  redirectUrl: z
    .string()
    .optional()
    .describe("URL to send the respondent to after they submit"),
  closeAt: z
    .string()
    .optional()
    .describe(
      "ISO 8601 date string — form stops accepting responses after this",
    ),
  maxResponses: z
    .number()
    .optional()
    .describe("Maximum number of submissions accepted"),
});

export function registerFormTools(server: McpServer, client: FormVaultClient) {
  server.registerTool(
    "list_forms",
    {
      title: "List forms",
      description:
        "List every form belonging to the API key's tenant. Returns id, name, description, field count and timestamps. " +
        "Read-only. Use this first to find a form's id before calling get_form, list_submissions or delete_form; " +
        "use get_form when you need the field definitions.",
      inputSchema: {},
    },
    withErrorHandling(async () => {
      const rows = await client.listForms();
      return jsonResult(
        rows.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description ?? null,
          fieldCount: Array.isArray(r.fields) ? r.fields.length : 0,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        })),
      );
    }),
  );

  server.registerTool(
    "get_form",
    {
      title: "Get a form",
      description:
        "Get one form with its full field and settings definition. Read-only. Fetched from the tenant's form list, so an " +
        "unknown id returns a not-found error rather than another tenant's form. Use list_forms to discover ids; " +
        "use list_submissions for responses.",
      inputSchema: {
        formId: z.string().describe("UUID of the form"),
      },
    },
    withErrorHandling(async ({ formId }: { formId: string }) => {
      const rows = await client.listForms();
      const form = rows.find((r) => r.id === formId);
      if (!form) return errorResult(`Form not found in this tenant: ${formId}`);
      return jsonResult(form);
    }),
  );

  server.registerTool(
    "create_form",
    {
      title: "Create a form",
      description: `Create a form for the API key's tenant.

Field types: ${FIELD_TYPES.join(" | ")}

Each field needs: id (unique within the form), type, label, required.
Optional per field: placeholder, options (select/multiselect), min/max
(number/rating), defaultValue (hidden), accept and maxSizeMb (file).

Settings (all optional): successMessage, redirectUrl, closeAt (ISO date),
maxResponses.

Returns the created form (including its id) and its publicUrl, the shareable
link respondents use. This tool only creates: it never edits an existing form, so call it once per new form and check
list_forms first if a form with the same name may already exist. If the
FormVault API rejects the input or the key, the tool returns an error result
with the API's message and nothing is created.

Keep public-facing forms short — every extra question costs responses.`,
      inputSchema: {
        name: z.string().min(1).describe("Form name (non-empty)"),
        description: z
          .string()
          .optional()
          .describe("Shown to respondents above the fields"),
        fields: z
          .array(fieldSchema)
          .min(1)
          .describe("Field definitions (at least one)"),
        settings: settingsSchema
          .optional()
          .describe(
            "Optional form behaviour: successMessage, redirectUrl, closeAt (ISO 8601) and maxResponses",
          ),
      },
    },
    withErrorHandling(
      async (input: {
        name: string;
        description?: string;
        fields: z.infer<typeof fieldSchema>[];
        settings?: z.infer<typeof settingsSchema>;
      }) => {
        const created = await client.createForm(input);
        return jsonResult({
          ...created,
          publicUrl: `https://formvault.eu/form/${created.id}`,
        });
      },
    ),
  );

  server.registerTool(
    "delete_form",
    {
      title: "Delete a form (irreversible)",
      description:
        "Permanently delete a form belonging to the API key's tenant. Irreversible, and the form's public URL " +
        "stops working immediately. Use list_forms to find the id first. Confirm with the user before calling this — do not delete a form on your own " +
        "initiative.",
      inputSchema: {
        formId: z.string().describe("UUID of the form to delete"),
      },
    },
    withErrorHandling(async ({ formId }: { formId: string }) => {
      await client.deleteForm(formId);
      return jsonResult({ deleted: formId });
    }),
  );
}
