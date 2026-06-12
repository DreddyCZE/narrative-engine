export type ContractId =
  | "game-data-schema"
  | "engine-state-api"
  | "command-api"
  | "event-api"
  | "view-model-api"
  | "save-schema"
  | "plugin-api"
  | "theme-api"
  | "localization-api";

export type ContractDescriptor = {
  readonly id: ContractId;
  readonly owner: "engine" | "game-data" | "ux" | "editor" | "tooling";
  readonly stability: "draft" | "reviewed" | "stable";
};

export const initialContracts: readonly ContractDescriptor[] = [
  { id: "game-data-schema", owner: "game-data", stability: "draft" },
  { id: "engine-state-api", owner: "engine", stability: "draft" },
  { id: "command-api", owner: "engine", stability: "draft" },
  { id: "event-api", owner: "engine", stability: "draft" },
  { id: "view-model-api", owner: "ux", stability: "draft" },
  { id: "save-schema", owner: "engine", stability: "draft" },
  { id: "plugin-api", owner: "tooling", stability: "draft" },
  { id: "theme-api", owner: "ux", stability: "draft" },
  { id: "localization-api", owner: "game-data", stability: "draft" }
];

