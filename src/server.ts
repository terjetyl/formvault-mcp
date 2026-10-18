import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FormVaultClient } from "./apiClient.js";
import { registerFormTools } from "./tools/forms.js";
import { registerSubmissionTools } from "./tools/submissions.js";

// Sent to the client during initialize and available to the model without a
// tool call — the right place for context the model needs on every
// conversation (what this server is, safety expectations), as opposed to a
// resource/tool the model would have to think to fetch.
const SERVER_INSTRUCTIONS = `
FormVault is a GDPR-first, EU-hosted form builder. This server lets you list,
create, and delete forms, and read their submissions, on behalf of the
authenticated user — FormVault remains the system of record; this server
only ever acts through its REST API using the caller's own API key, so it
can only see and modify that one tenant's data. No tool takes a tenant id;
the key carries its own.

Safety: delete_form is irreversible and immediately breaks the form's public
URL — always confirm with the user which form before calling it. Submissions
contain respondents' personal data in the clear: only call list_submissions
when the user has explicitly asked for response content, not as part of
routine form-building work.
`.trim();

// Builds the server without attaching a transport, so tests can connect it
// via InMemoryTransport instead of stdio, and the hosted HTTP server can
// build a fresh instance scoped to each request's own client.
export function createServer(client: FormVaultClient): McpServer {
  const server = new McpServer(
    { name: "formvault", version: "0.1.0" },
    { instructions: SERVER_INSTRUCTIONS },
  );

  registerFormTools(server, client);
  registerSubmissionTools(server, client);

  return server;
}
