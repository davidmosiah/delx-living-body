export type ResponseFormat = "markdown" | "json";
export type PrivacyMode = "summary" | "structured" | "raw";
export type ConnectorStatus = "active" | "detected" | "missing" | "timeout" | "error";

export interface DetectedConnector {
  id: string;
  package: string;
  display_name: string;
  status: ConnectorStatus;
  detection_method?: "tokens.json" | "config.json" | "export-path" | "stateless" | "profile.json";
  detected_path?: string;
  last_seen?: string;
  version_if_known?: string;
  note?: string;
}

export interface ComposedSourceResult {
  source: string;
  status: "ok" | "timeout" | "error" | "skipped";
  duration_ms: number;
  context?: Record<string, unknown>;
  error?: string;
}

export interface SynthesisResult {
  recommendation: string;
  reasoning: string;
  sources_used: string[];
  confidence: "low" | "medium" | "high";
  data_snapshot: Record<string, Record<string, unknown>>;
}

export interface ToolResponse<T> extends Record<string, unknown> {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: T;
  isError?: boolean;
}
