export type EngineLayer = "engine";

export const engineLayer: EngineLayer = "engine";

export {
  buildContentIdIndex,
  type ContentIdIndexEntry,
  type ContentIdIndexingOptions,
  type ContentIdIndexingResult
} from "./content-loader/content-id-indexing.js";

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
