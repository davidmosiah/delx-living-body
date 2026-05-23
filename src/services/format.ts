import type { ResponseFormat, ToolResponse } from "../types.js";

export function makeResponse<T>(data: T, format: ResponseFormat, markdown: string): ToolResponse<T> {
  return {
    content: [{ type: "text", text: format === "json" ? JSON.stringify(data, null, 2) : markdown }],
    structuredContent: data
  };
}

export function makeError(message: string): ToolResponse<{ error: string }> {
  return {
    isError: true,
    content: [{ type: "text", text: `Error: ${message}` }],
    structuredContent: { error: message }
  };
}

export function bulletList(title: string, fields: Record<string, unknown>): string {
  const lines = [`# ${title}`, ""];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      lines.push(`- **${key}**: ${value.length ? value.join(", ") : "(none)"}`);
    } else if (typeof value === "object") {
      lines.push(`- **${key}**: ${JSON.stringify(value)}`);
    } else {
      lines.push(`- **${key}**: ${String(value)}`);
    }
  }
  return lines.join("\n");
}
