export type EngineLayer = "engine";

export const engineLayer: EngineLayer = "engine";

export {
  appendEventRecords,
  createInMemoryEventStore,
  getEventRecordById,
  listEventRecords,
  type InMemoryEventStore
} from "./persistence/in-memory-event-store.js";

export {
  createInMemorySaveSnapshotStore,
  listSnapshots,
  loadSnapshot,
  saveSnapshot,
  type InMemorySaveSnapshotStore
} from "./persistence/in-memory-save-snapshot-store.js";

export {
  buildRuntimeDomainEventReturnValues,
  type RuntimeDomainEventReturnValuesResult
} from "./runtime-host/runtime-domain-event-return-values.js";

export {
  executeInMemoryCommand,
  type InMemoryCommandExecutionPipelineOptions
} from "./runtime-host/in-memory-command-execution-pipeline.js";

export {
  adaptRuntimeConditionEffectBindings,
  type RuntimeAdaptedConditionBinding,
  type RuntimeAdaptedEffectBinding,
  type RuntimeConditionEffectBindingAdapterResult
} from "./runtime-host/runtime-condition-effect-binding-adapter.js";

export {
  resolveRuntimeCommandRequest,
  type RuntimeCommandRequestResolutionResult,
  type RuntimeResolvedCommand
} from "./runtime-host/runtime-command-request-resolver.js";

export {
  buildContentIdIndex,
  type ContentIdIndexEntry,
  type ContentIdIndexingOptions,
  type ContentIdIndexingResult
} from "./content-loader/content-id-indexing.js";

export {
  buildValidatedContentGraphValue,
  type BuildValidatedContentGraphInput
} from "./content-loader/validated-content-graph-builder.js";

export {
  validateContentM2PrimitiveBindings,
  type ContentM2PrimitiveBindingValidationOptions,
  type ContentM2PrimitiveBindingValidationResult
} from "./content-loader/m2-primitive-binding-validation.js";

export {
  validateContentReferences,
  type ContentReferenceValidationOptions,
  type ContentReferenceValidationResult
} from "./content-loader/reference-validation.js";

export {
  validateContentManifestAndSections,
  type ContentManifestSectionValidationOptions
} from "./content-loader/manifest-section-validation.js";

export {
  COMMAND_CONTRACT_VERSION,
  COMMAND_SCHEMA_ID,
  COMMAND_SCHEMA_VERSION,
  planCommand,
  inspectCommand,
  type CommandPlanningIssue,
  type CommandPlanningIssueCode,
  type CommandPlanningOptions,
  type CommandPlanningPlan,
  type CommandPlanningResult,
  type CommandPlanningStatus,
  type PlanningHistory
} from "./command/command.js";

export {
  TRANSACTION_CONTRACT_VERSION,
  TRANSACTION_SCHEMA_ID,
  TRANSACTION_SCHEMA_VERSION,
  applyTransaction,
  inspectTransaction,
  runCommandTransaction,
  runTransaction,
  type TransactionHistory,
  type TransactionHistoryEntry,
  type TransactionIssue,
  type TransactionIssueCode,
  type TransactionOptions,
  type TransactionResult,
  type TransactionStatus
} from "./transaction/transaction.js";

export {
  DOMAIN_EVENT_CONTRACT_VERSION,
  DOMAIN_EVENT_SCHEMA_ID,
  DOMAIN_EVENT_SCHEMA_VERSION,
  materializeDomainEvents,
  type DomainEventBatch,
  type DomainEventEnvelope,
  type DomainEventMaterializationHistory,
  type DomainEventMaterializationIssue,
  type DomainEventMaterializationIssueCode,
  type DomainEventMaterializationOptions,
  type DomainEventMaterializationResult,
  type DomainEventMaterializationStatus
} from "./domain-event/domain-event.js";
