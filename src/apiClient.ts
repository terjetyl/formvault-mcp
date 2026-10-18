// Thin HTTP wrapper around the FormVault v1 REST API (apps/forms-api/src/routes/apiKeys.ts).
// Deliberately doesn't share types with apps/forms-api — these are just the
// wire shapes the v1 routes actually return, not the full domain model.

export interface FormVaultClientConfig {
  baseUrl: string;
  apiKey: string;
}

export class FormVaultApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(FormVaultApiError.extractMessage(status, body));
    this.name = "FormVaultApiError";
  }

  private static extractMessage(status: number, body: unknown): string {
    if (body && typeof body === "object") {
      const b = body as Record<string, unknown>;
      const parts = [b.error, b.message].filter(
        (v): v is string => typeof v === "string" && v.length > 0,
      );
      if (parts.length) return parts.join(": ");
    }
    return `FormVault API request failed with status ${status}`;
  }
}

export interface FormFieldInput {
  id: string;
  type: string;
  label: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
  min?: number;
  max?: number;
  defaultValue?: string;
  accept?: string;
  maxSizeMb?: number;
}

export interface FormSettingsInput {
  successMessage?: string;
  redirectUrl?: string;
  closeAt?: string;
  maxResponses?: number;
}

export interface FormRow {
  id: string;
  name: string;
  description: string | null;
  fields: unknown;
  settings: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFormInput {
  name: string;
  description?: string;
  fields: FormFieldInput[];
  settings?: FormSettingsInput;
}

export interface SubmissionRow {
  id: string;
  formId: string;
  submittedAt: string;
  data: Record<string, unknown>;
}

export class FormVaultClient {
  constructor(private readonly config: FormVaultClientConfig) {}

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const res = await fetch(`${this.config.baseUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    const json = text ? JSON.parse(text) : undefined;

    if (!res.ok) {
      throw new FormVaultApiError(res.status, json);
    }

    return json as T;
  }

  listForms(): Promise<FormRow[]> {
    return this.request("GET", "/v1/forms");
  }

  createForm(input: CreateFormInput): Promise<FormRow> {
    return this.request("POST", "/v1/forms", input);
  }

  deleteForm(formId: string): Promise<void> {
    return this.request("DELETE", `/v1/forms/${encodeURIComponent(formId)}`);
  }

  listSubmissions(formId: string): Promise<SubmissionRow[]> {
    return this.request(
      "GET",
      `/v1/forms/${encodeURIComponent(formId)}/submissions`,
    );
  }
}

export function clientFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): FormVaultClient {
  const apiKey = env.FORMVAULT_API_KEY;
  const baseUrl = (env.FORMVAULT_API_URL ?? "https://api.formvault.eu").replace(
    /\/+$/,
    "",
  );

  if (!apiKey) {
    throw new Error(
      "FORMVAULT_API_KEY is not set. Create a key at formvault.eu/app/api-keys and add it to this MCP server's config.",
    );
  }
  if (!apiKey.startsWith("fv_")) {
    throw new Error(
      "FORMVAULT_API_KEY does not look like a key (expected fv_…).",
    );
  }

  return new FormVaultClient({ baseUrl, apiKey });
}
