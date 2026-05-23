export const SERVER_NAME = "living-body-mcp-server";
export const SERVER_VERSION = "0.1.0";
export const NPM_PACKAGE_NAME = "delx-living-body";
export const PINNED_NPM_PACKAGE = `${NPM_PACKAGE_NAME}@${SERVER_VERSION}`;
export const MCP_NAME = "io.github.davidmosiah/delx-living-body";

export const CONTEXT_CONTRACT_VERSION = "delx-wellness-context/v1";
export const DEFAULT_CHILD_TIMEOUT_MS = 30_000;
export const DEFAULT_DETECT_TTL_SECONDS = 60;
export const DEFAULT_RESPONSE_TTL_SECONDS = 300;

export type ConnectorAuthShape =
  | "tokens.json"
  | "config.json"
  | "export-path"
  | "stateless";

export interface KnownConnector {
  /** Stable id used in tool args, registry */
  id: string;
  /** npm package name */
  package: string;
  /** Friendly name */
  display_name: string;
  /** Local home dir under HOME (~/.<vendor>-mcp/) */
  home_dir: string;
  /** Tool name on the child server that returns wellness_context */
  context_tool: string | null;
  /** Tool name on the child server that returns daily_summary */
  daily_summary_tool: string | null;
  /** Shape of credential storage */
  auth_shape: ConnectorAuthShape;
  /** Optional env var that points at an export file (apple/samsung) */
  export_env_var?: string;
  /** Optional default export path under HOME */
  default_export_path?: string;
  /** Category — used by synthesizer to weight inputs */
  category:
    | "recovery"
    | "sleep"
    | "training"
    | "nutrition"
    | "cycle"
    | "environment"
    | "glucose"
    | "multi";
  /** Stateless connectors don't require local files to be considered available */
  stateless?: boolean;
}

export const KNOWN_CONNECTORS: KnownConnector[] = [
  {
    id: "whoop",
    package: "whoop-mcp-unofficial",
    display_name: "WHOOP",
    home_dir: ".whoop-mcp",
    context_tool: "whoop_wellness_context",
    daily_summary_tool: "whoop_daily_summary",
    auth_shape: "tokens.json",
    category: "recovery"
  },
  {
    id: "oura",
    package: "oura-mcp-unofficial",
    display_name: "Oura",
    home_dir: ".oura-mcp",
    context_tool: "oura_wellness_context",
    daily_summary_tool: "oura_daily_summary",
    auth_shape: "tokens.json",
    category: "sleep"
  },
  {
    id: "garmin",
    package: "garmin-mcp-unofficial",
    display_name: "Garmin",
    home_dir: ".garmin-mcp",
    context_tool: "garmin_wellness_context",
    daily_summary_tool: "garmin_daily_summary",
    auth_shape: "tokens.json",
    category: "recovery"
  },
  {
    id: "strava",
    package: "strava-mcp-unofficial",
    display_name: "Strava",
    home_dir: ".strava-mcp",
    context_tool: "strava_training_context",
    daily_summary_tool: "strava_daily_summary",
    auth_shape: "tokens.json",
    category: "training"
  },
  {
    id: "fitbit",
    package: "fitbit-mcp-unofficial",
    display_name: "Fitbit",
    home_dir: ".fitbit-mcp",
    context_tool: "fitbit_wellness_context",
    daily_summary_tool: "fitbit_daily_summary",
    auth_shape: "tokens.json",
    category: "recovery"
  },
  {
    id: "google_health",
    package: "google-health-mcp-unofficial",
    display_name: "Google Health Connect",
    home_dir: ".google-health-mcp",
    context_tool: "google_health_wellness_context",
    daily_summary_tool: "google_health_daily_summary",
    auth_shape: "tokens.json",
    category: "multi"
  },
  {
    id: "withings",
    package: "withings-mcp-unofficial",
    display_name: "Withings",
    home_dir: ".withings-mcp",
    context_tool: "withings_wellness_context",
    daily_summary_tool: "withings_daily_summary",
    auth_shape: "tokens.json",
    category: "multi"
  },
  {
    id: "apple_health",
    package: "apple-health-mcp-unofficial",
    display_name: "Apple Health",
    home_dir: ".apple-health-mcp",
    context_tool: "apple_health_wellness_context",
    daily_summary_tool: "apple_health_daily_summary",
    auth_shape: "export-path",
    export_env_var: "APPLE_HEALTH_EXPORT_PATH",
    default_export_path: ".apple-health-mcp/export.xml",
    category: "multi"
  },
  {
    id: "samsung_health",
    package: "samsung-health-mcp-unofficial",
    display_name: "Samsung Health",
    home_dir: ".samsung-health-mcp",
    context_tool: "samsung_health_wellness_context",
    daily_summary_tool: "samsung_health_daily_summary",
    auth_shape: "export-path",
    export_env_var: "SAMSUNG_HEALTH_EXPORT_PATH",
    default_export_path: ".samsung-health-mcp/export.zip",
    category: "multi"
  },
  {
    id: "polar",
    package: "polar-mcp-unofficial",
    display_name: "Polar",
    home_dir: ".polar-mcp",
    context_tool: "polar_wellness_context",
    daily_summary_tool: "polar_daily_summary",
    auth_shape: "tokens.json",
    category: "training"
  },
  {
    id: "eight_sleep",
    package: "eight-sleep-mcp-unofficial",
    display_name: "Eight Sleep",
    home_dir: ".eight-sleep-mcp",
    context_tool: "eight_sleep_wellness_context",
    daily_summary_tool: "eight_sleep_daily_summary",
    auth_shape: "config.json",
    category: "sleep"
  },
  {
    id: "nourish",
    package: "wellness-nourish",
    display_name: "Nourish (nutrition)",
    home_dir: ".wellness-nourish",
    context_tool: "nourish_wellness_context",
    daily_summary_tool: "nourish_daily_summary",
    auth_shape: "config.json",
    category: "nutrition"
  },
  {
    id: "air",
    package: "wellness-air",
    display_name: "Air (environment)",
    home_dir: ".wellness-air",
    context_tool: "air_wellness_context",
    daily_summary_tool: "air_daily_summary",
    auth_shape: "config.json",
    category: "environment"
  },
  {
    id: "cycle_coach",
    package: "wellness-cycle-coach",
    display_name: "Cycle Coach",
    home_dir: ".wellness-cycle-coach",
    context_tool: "cycle_wellness_context",
    daily_summary_tool: "cycle_daily_summary",
    auth_shape: "stateless",
    category: "cycle",
    stateless: true
  },
  {
    id: "cgm",
    package: "wellness-cgm-mcp",
    display_name: "Continuous Glucose Monitor",
    home_dir: ".wellness-cgm-mcp",
    context_tool: "cgm_wellness_context",
    daily_summary_tool: "cgm_daily_summary",
    auth_shape: "tokens.json",
    category: "glucose"
  }
];

export const CONNECTOR_BY_ID: Record<string, KnownConnector> = Object.fromEntries(
  KNOWN_CONNECTORS.map((c) => [c.id, c])
);

export const PROFILE_PATH_REL = ".delx-wellness/profile.json";
