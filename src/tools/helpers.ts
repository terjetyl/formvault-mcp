import { FormVaultApiError } from "../apiClient.js";

// MCP tool results are a list of content blocks. Returning JSON as a single
// text block keeps this simple and lets the model read structured fields
// straight out of the response without a separate schema per tool.
export function jsonResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

export function errorResult(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true as const,
  };
}

// Wraps a tool handler so an API failure (404, 401, validation error, etc.)
// comes back as a normal tool error the model can react to and explain,
// rather than an unhandled exception that kills the tool call.
export function withErrorHandling<Args extends unknown[]>(
  handler: (...args: Args) => Promise<ReturnType<typeof jsonResult>>,
) {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof FormVaultApiError) {
        return errorResult(
          `FormVault API error (${err.status}): ${err.message}`,
        );
      }
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(`Unexpected error: ${message}`);
    }
  };
}
