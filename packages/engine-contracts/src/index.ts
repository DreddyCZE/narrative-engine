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

export {
  assertEntityIdentity,
  ENTITY_IDENTITY_CONTRACT_VERSION,
  type EntityIdentity,
  type EntityIdentityAlias,
  type EntityIdentityChange,
  type EntityIdentityIssue,
  type EntityIdentityIssueCode,
  type EntityIdentityProvenance,
  EntityIdentityValidationError,
  formatEntityIdentityValidationMessage,
  inspectEntityIdentity,
  isEntityIdentity
} from "./entity/entity-identity.js";
export {
  assertEngineStateSnapshot,
  ENGINE_STATE_CONTRACT_VERSION,
  formatEngineStateValidationMessage,
  type EngineStateDomain,
  type EngineStateDomainAuthority,
  type EngineStateIssue,
  type EngineStateIssueCode,
  type EngineStateMeta,
  type EngineStatePersistence,
  type EngineStateRun,
  type EngineStateSnapshot,
  type EngineStateValidationResult,
  inspectEngineStateSnapshot,
  isEngineStateSnapshot,
  validateEngineStateSnapshot
} from "./engine-state/engine-state.js";
export {
  assertSchemaVersionDescriptor,
  checkSchemaCompatibility,
  compareSchemaVersions,
  formatSchemaVersioningValidationMessage,
  SCHEMA_VERSIONING_CONTRACT_VERSION,
  type SchemaCompatibilityResult,
  type SchemaCompatibilityStatus,
  type SchemaDescriptor,
  type SchemaMigration,
  type SchemaReaderSupport,
  type SchemaVersionEntry,
  type SchemaVersionIssue,
  type SchemaVersionIssueCode,
  type SchemaVersionStatus,
  SchemaVersioningValidationError,
  inspectSchemaVersionDescriptor,
  isSchemaVersionDescriptor
} from "./schema-versioning/schema-versioning.js";
