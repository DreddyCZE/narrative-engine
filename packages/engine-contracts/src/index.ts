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
  assertReplayInput,
  createReplayPlan,
  createReplayResult,
  formatReplayValidationMessage,
  inspectReplayInput,
  inspectReplayPlan,
  isReplaySourceKind,
  isReplayStatus,
  REPLAY_SOURCE_KINDS,
  REPLAY_STATUSES,
  type ReplayDeterminismPolicy,
  type ReplayDiagnostic,
  type ReplayEventRange,
  type ReplayEventStreamSource,
  type ReplayInput,
  type ReplayMetadata,
  type ReplayPlan,
  type ReplayResult,
  type ReplaySnapshotAndEventsSource,
  type ReplaySnapshotSource,
  type ReplaySourceDescriptor,
  type ReplaySourceKind,
  type ReplayStatus,
  type ReplayStepDescriptor,
  type ReplayStorageAdapterSource,
  type ReplayStorageReference
} from "./replay/replay-types.js";
export {
  createSerializationResult,
  createDeserializationResult,
  formatSerializationValidationMessage,
  inspectSchemaMigrationPlan,
  inspectSerializationEnvelope,
  isSerializationFormat,
  SERIALIZATION_FORMATS,
  type ChecksumMetadata,
  type DeserializationResult,
  type SchemaMigrationDescriptor,
  type SchemaMigrationPlan,
  type SchemaVersion,
  type SerializationDiagnostic,
  type SerializationEnvelope,
  type SerializationFormat,
  type SerializationMetadata,
  type SerializationResult,
  type SerializedPayload
} from "./storage/serialization-schema-types.js";
export {
  createStorageOperationResult,
  formatStorageAdapterValidationMessage,
  inspectStorageAppendEventsInput,
  inspectStorageLoadSnapshotInput,
  inspectStorageReadEventsInput,
  inspectStorageSaveSnapshotInput,
  isStorageAdapterKind,
  isStorageOperationKind,
  isStorageOperationStatus,
  STORAGE_ADAPTER_KINDS,
  STORAGE_OPERATION_KINDS,
  STORAGE_OPERATION_STATUSES,
  type StorageAdapterCapability,
  type StorageAdapterContract,
  type StorageAdapterDiagnostic,
  type StorageAdapterKind,
  type StorageAdapterMetadata,
  type StorageAppendEventsInput,
  type StorageLoadSnapshotInput,
  type StorageOperationKind,
  type StorageOperationResult,
  type StorageOperationStatus,
  type StorageReadEventsInput,
  type StorageSaveSnapshotInput
} from "./storage/storage-adapter-types.js";
export {
  CONTENT_LOAD_STATUSES,
  isContentLoadStatus,
  type ContentLoaderInput,
  type ContentLoaderResult,
  type ContentLoaderResultMetadata,
  type ContentLoaderSourceKind,
  type ContentLoaderSourceMetadata,
  type ContentLoadStatus,
  type ValidatedContentGraph,
  type ValidatedContentManifest,
  type ValidatedContentReferenceIndex,
  type ValidatedContentSections
} from "./content-loader/content-loader-types.js";
export {
  CONTENT_PACKAGE_LOADER_VERSION,
  createValidatedContentGraphFromPackage,
  loadContentPackageFromObject
} from "./content-loader/content-package-loader.js";
export {
  assertContentReadModelInput,
  createContentReadModel,
  formatContentReadModelValidationMessage,
  inspectContentReadModelInput,
  type ContentReadModel,
  type ContentReadModelDiagnostic,
  type ContentReadModelInput
} from "./content-runtime/content-read-model.js";
export {
  assertRuntimePlayerState,
  createInitialRuntimePlayerStateFromContent,
  formatRuntimePlayerStateValidationMessage,
  inspectRuntimePlayerState,
  RUNTIME_PLAYER_STATE_SCHEMA_ID,
  RUNTIME_PLAYER_STATE_SCHEMA_VERSION,
  type CreateInitialRuntimePlayerStateFromContentInput,
  type RuntimePlayerInventoryState,
  type RuntimePlayerProgressState,
  type RuntimePlayerState,
  type RuntimePlayerStateDiagnostic,
  type RuntimePlayerStateMetadata
} from "./content-runtime/runtime-player-state.js";
export {
  assertContentPackage,
  CONTENT_ACTION_AFFORDANCES,
  formatContentPackageValidationMessage,
  inspectContentPackage,
  isContentActionAffordance,
  type ContentActionAffordance,
  type ContentDialogueDescriptor,
  type ContentExitDescriptor,
  type ContentInitialPlayerState,
  type ContentItemDescriptor,
  type ContentLocationDescriptor,
  type ContentNpcDescriptor,
  type ContentPackage,
  type ContentPackageDiagnostic
} from "./content/content-package-types.js";
export {
  createPersistenceResult,
  assertPersistenceEventEnvelope,
  assertPersistenceSnapshotRecord,
  formatPersistenceSnapshotStateMessage,
  formatPersistenceValidationMessage,
  inspectPersistenceEventEnvelope,
  inspectPersistenceEventRecord,
  inspectPersistenceSnapshotEnvelope,
  inspectPersistenceSnapshotRecord,
  isPersistenceStatus,
  validatePersistenceSnapshotState,
  PERSISTENCE_STATUSES,
  type PersistenceAppendEventsInput,
  type PersistenceDiagnostic,
  type PersistenceEventEnvelope,
  type PersistenceEventRange,
  type PersistenceEventRecord,
  type PersistenceEventRecordMetadata,
  type PersistenceLoadSnapshotInput,
  type PersistenceResult,
  type PersistenceResultMetadata,
  type PersistenceSaveSnapshotInput,
  type PersistenceSnapshotEnvelope,
  type PersistenceSnapshotRecord,
  type PersistenceSnapshotRecordMetadata,
  type PersistenceStatus
} from "./persistence/persistence-types.js";
export {
  RUNTIME_HOST_STATUSES,
  isRuntimeHostStatus,
  type RuntimeCommandPlanSummary,
  type RuntimeCommandRequest,
  type RuntimeDomainEventReturnValue,
  type RuntimeDomainEventReturnValueMetadata,
  type RuntimeDomainEventSummary,
  type RuntimeHostContext,
  type RuntimeHostInput,
  type RuntimeHostInputMetadata,
  type RuntimeHostMetadataSource,
  type RuntimeHostResult,
  type RuntimeHostResultMetadata,
  type RuntimeHostStatus,
  type RuntimeTransactionSummary
} from "./runtime-host/runtime-host-types.js";
export {
  assertRuntimeCommandRequest,
  formatRuntimeCommandRequestValidationMessage,
  inspectRuntimeCommandRequest,
  inspectRuntimeCommandRequestAgainstContent,
  RUNTIME_COMMAND_REQUEST_CONTRACT_VERSION,
  type RuntimeCommandRequestDiagnostic,
  type RuntimeCommandRequestValidationInput
} from "./runtime-host/runtime-command-request-validation.js";
export {
  assertRuntimeCommandPlanningInput,
  createRuntimeCommandPlan,
  formatRuntimeCommandPlanningValidationMessage,
  inspectRuntimeCommandPlanningInput,
  RUNTIME_COMMAND_PLAN_STATUSES,
  RUNTIME_COMMAND_PLANNING_CONTRACT_VERSION,
  type RuntimeCommandKind,
  type RuntimeCommandPlan,
  type RuntimeCommandPlanDiagnostic,
  type RuntimeCommandPlanMetadata,
  type RuntimeCommandPlanStatus,
  type RuntimeCommandPlanStep,
  type RuntimeCommandPlanningInput,
  type RuntimeCommandPlanningMetadata
} from "./runtime-host/runtime-command-planning.js";
export {
  assertRuntimeMovementCommandExecutionInput,
  executeRuntimeMovementCommand,
  formatRuntimeMovementCommandExecutionValidationMessage,
  inspectRuntimeMovementCommandExecutionInput,
  RUNTIME_MOVEMENT_COMMAND_EXECUTION_STATUSES,
  RUNTIME_MOVEMENT_COMMAND_EXECUTOR_CONTRACT_VERSION,
  type RuntimeMovementCommandDiagnostic,
  type RuntimeMovementCommandExecutionStatus,
  type RuntimeMovementCommandExecutorInput,
  type RuntimeMovementCommandExecutorResult
} from "./runtime-host/runtime-movement-command-executor.js";
export {
  assertRuntimeLookCommandExecutionInput,
  executeRuntimeLookCommand,
  formatRuntimeLookCommandExecutionValidationMessage,
  inspectRuntimeLookCommandExecutionInput,
  RUNTIME_LOOK_COMMAND_EXECUTION_STATUSES,
  RUNTIME_LOOK_COMMAND_EXECUTOR_CONTRACT_VERSION,
  type RuntimeLookCommandDiagnostic,
  type RuntimeLookCommandExecutionInput,
  type RuntimeLookCommandExecutionMetadata,
  type RuntimeLookCommandExecutionResult,
  type RuntimeLookCommandExecutionResultMetadata,
  type RuntimeLookCommandExecutionStatus,
  type RuntimeLookCommandExitView,
  type RuntimeLookCommandItemView,
  type RuntimeLookCommandNpcView,
  type RuntimeLookCommandView
} from "./runtime-host/runtime-look-command-executor.js";
export {
  assertRuntimeInventoryCommandExecutionInput,
  executeRuntimeInventoryCommand,
  formatRuntimeInventoryCommandExecutionValidationMessage,
  inspectRuntimeInventoryCommandExecutionInput,
  RUNTIME_INVENTORY_COMMAND_EXECUTION_STATUSES,
  RUNTIME_INVENTORY_COMMAND_EXECUTOR_CONTRACT_VERSION,
  type RuntimeInventoryCommandDiagnostic,
  type RuntimeInventoryCommandExecutionInput,
  type RuntimeInventoryCommandExecutionMetadata,
  type RuntimeInventoryCommandExecutionResult,
  type RuntimeInventoryCommandExecutionResultMetadata,
  type RuntimeInventoryCommandExecutionStatus,
  type RuntimeInventoryCommandItemView,
  type RuntimeInventoryCommandView
} from "./runtime-host/runtime-inventory-command-executor.js";
export {
  assertRuntimeReadonlyCommandExecutionInput,
  executeRuntimeReadonlyCommand,
  formatRuntimeReadonlyCommandExecutionValidationMessage,
  inspectRuntimeReadonlyCommandExecutionInput,
  RUNTIME_READONLY_COMMAND_EXECUTION_STATUSES,
  RUNTIME_READONLY_COMMAND_EXECUTOR_CONTRACT_VERSION,
  type RuntimeReadonlyCommandDiagnostic,
  type RuntimeReadonlyCommandExecutionInput,
  type RuntimeReadonlyCommandExecutionMetadata,
  type RuntimeReadonlyCommandExecutionResult,
  type RuntimeReadonlyCommandExecutionResultMetadata,
  type RuntimeReadonlyCommandExecutionStatus,
  type RuntimeReadonlyCommandExecutionView
} from "./runtime-host/runtime-readonly-command-execution-facade.js";
export {
  createReadonlyRuntimeSmokeScenarioPackage,
  runReadonlyRuntimeSmokeScenario,
  READONLY_RUNTIME_SMOKE_SCENARIO_CONTRACT_VERSION,
  type ReadonlyRuntimeSmokeScenarioPackage,
  type ReadonlyRuntimeSmokeScenarioResult,
  type ReadonlyRuntimeSmokeScenarioStep
} from "./runtime-host/runtime-readonly-smoke-scenario.js";
export {
  READONLY_RUNTIME_TRANSCRIPT_SCENARIO_CONTRACT_VERSION,
  runReadonlyRuntimeTranscriptScenario,
  type ReadonlyRuntimeTranscriptLine,
  type ReadonlyRuntimeTranscriptScenarioResult,
  type ReadonlyRuntimeTranscriptStep
} from "./runtime-host/runtime-readonly-transcript-scenario.js";
export {
  createRuntimeReadonlyPresentationModel,
  RUNTIME_READONLY_PRESENTATION_MODEL_CONTRACT_VERSION,
  type RuntimeReadonlyPresentationDiagnostic,
  type RuntimeReadonlyPresentationInventoryPanel,
  type RuntimeReadonlyPresentationLocationPanel,
  type RuntimeReadonlyPresentationModel,
  type RuntimeReadonlyPresentationModelInput,
  type RuntimeReadonlyPresentationPanel,
  type RuntimeReadonlyPresentationTranscriptLine
} from "./runtime-host/runtime-readonly-presentation-model.js";
export {
  READONLY_RUNTIME_PRESENTATION_SNAPSHOT_SCENARIO_CONTRACT_VERSION,
  runReadonlyRuntimePresentationSnapshotScenario,
  type ReadonlyRuntimePresentationSnapshotScenarioResult,
  type ReadonlyRuntimePresentationSnapshotSummary
} from "./runtime-host/runtime-readonly-presentation-snapshot-scenario.js";
export {
  assertRuntimeReadonlyInputRequest,
  formatRuntimeReadonlyInputRequestValidationMessage,
  inspectRuntimeReadonlyInputRequest,
  RUNTIME_READONLY_INPUT_COMMAND_IDS,
  RUNTIME_READONLY_INPUT_REQUEST_CONTRACT_VERSION,
  toRuntimeCommandRequestFromReadonlyInput,
  type RuntimeReadonlyInputCommandId,
  type RuntimeReadonlyInputRequest,
  type RuntimeReadonlyInputRequestDiagnostic
} from "./runtime-host/runtime-readonly-input-request-contract.js";
export {
  assertRuntimeReadonlyInteractionInput,
  executeRuntimeReadonlyInteraction,
  formatRuntimeReadonlyInteractionValidationMessage,
  inspectRuntimeReadonlyInteractionInput,
  RUNTIME_READONLY_INTERACTION_BOUNDARY_CONTRACT_VERSION,
  RUNTIME_READONLY_INTERACTION_STATUSES,
  type RuntimeReadonlyInteractionDiagnostic,
  type RuntimeReadonlyInteractionInput,
  type RuntimeReadonlyInteractionResult,
  type RuntimeReadonlyInteractionStatus
} from "./runtime-host/runtime-readonly-interaction-boundary.js";
export {
  assertRuntimeReadonlyRequestExecutionInput,
  executeRuntimeReadonlyRequest,
  formatRuntimeReadonlyRequestExecutionValidationMessage,
  inspectRuntimeReadonlyRequestExecutionInput,
  RUNTIME_READONLY_REQUEST_EXECUTION_STATUSES,
  RUNTIME_READONLY_REQUEST_EXECUTOR_CONTRACT_VERSION,
  type RuntimeReadonlyRequestDiagnostic,
  type RuntimeReadonlyRequestExecutionInput,
  type RuntimeReadonlyRequestExecutionMetadata,
  type RuntimeReadonlyRequestExecutionResult,
  type RuntimeReadonlyRequestExecutionResultMetadata,
  type RuntimeReadonlyRequestExecutionStatus
} from "./runtime-host/runtime-readonly-request-execution-facade.js";
export {
  CONDITION_CONTRACT_VERSION,
  CONDITION_SCHEMA_ID,
  CONDITION_SCHEMA_VERSION,
  evaluateCondition,
  formatConditionEvaluationIssues,
  inspectCondition,
  type ConditionComparisonOperator,
  type ConditionEvaluationContext,
  type ConditionEvaluationIssue,
  type ConditionEvaluationIssueCode,
  type ConditionEvaluationOptions,
  type ConditionEvaluationResult,
  type ConditionType
} from "./condition/condition.js";
export {
  applyEffect,
  EFFECT_CONTRACT_VERSION,
  EFFECT_SCHEMA_ID,
  EFFECT_SCHEMA_VERSION,
  formatEffectApplicationIssues,
  inspectEffect,
  type EffectApplicationIssue,
  type EffectApplicationIssueCode,
  type EffectApplicationOptions,
  type EffectApplicationResult,
  type EffectApplicationStatus,
  type EffectChange,
  type EffectEnvelope,
  type EffectTarget,
  type EffectType
} from "./effect/effect.js";
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
export {
  adaptEngineStateIssues,
  adaptEntityIdentityIssues,
  adaptJsonSafetyIssues,
  adaptSchemaVersioningIssues,
  assertValidationDiagnostic,
  createValidationDiagnostic,
  formatValidationDiagnostic,
  formatValidationDiagnosticMessage,
  type ValidationDiagnostic,
  type ValidationDiagnosticAdapterOptions,
  type ValidationDiagnosticCategory,
  type ValidationDiagnosticInput,
  type ValidationDiagnosticIssue,
  type ValidationDiagnosticIssueCode,
  type ValidationDiagnosticPhase,
  type ValidationDiagnosticSeverity,
  type ValidationDiagnosticSource,
  VALIDATION_DIAGNOSTIC_CONTRACT_VERSION,
  VALIDATION_DIAGNOSTIC_SCHEMA_ID,
  VALIDATION_DIAGNOSTIC_SCHEMA_VERSION,
  inspectValidationDiagnostic,
  isValidationDiagnostic,
  normalizeValidationDiagnostics,
  sortValidationDiagnostics,
  ValidationDiagnosticValidationError
} from "./validation-diagnostic/validation-diagnostic.js";
