import { type JsonValue } from "@narrative-engine/core";

import { type ValidatedContentGraph } from "../content-loader/content-loader-types.js";
import { type EngineStateSnapshot } from "../engine-state/engine-state.js";
import { type ValidationDiagnostic } from "../validation-diagnostic/validation-diagnostic.js";

export const RUNTIME_HOST_STATUSES = ["committed", "rejected", "blocked", "error"] as const;

export type RuntimeHostStatus = (typeof RUNTIME_HOST_STATUSES)[number];

export type RuntimeHostMetadataSource = "test" | "memory" | "runtime" | "unknown";

export type RuntimeCommandRequest = {
  readonly commandId: string;
  readonly actorId?: string;
  readonly targetId?: string;
  readonly payload?: JsonValue;
};

export type RuntimeHostInputMetadata = {
  readonly requestId?: string;
  readonly deterministic?: true;
  readonly source?: RuntimeHostMetadataSource;
};

export type RuntimeHostContext = {
  readonly requestId?: string;
  readonly correlationId?: string;
  readonly deterministic: true;
  readonly source?: RuntimeHostMetadataSource;
};

export type RuntimeHostInput = {
  readonly request: RuntimeCommandRequest;
  readonly currentState: EngineStateSnapshot;
  readonly validatedContentGraph: ValidatedContentGraph;
  readonly context?: RuntimeHostContext;
  readonly metadata?: RuntimeHostInputMetadata;
};

export type RuntimeCommandPlanSummary = {
  readonly commandId: string;
  readonly status: string;
  readonly diagnosticsCount: number;
};

export type RuntimeTransactionSummary = {
  readonly status: string;
  readonly previousRevision?: number;
  readonly nextRevision?: number;
};

export type RuntimeDomainEventSummary = {
  readonly count: number;
  readonly eventTypes: readonly string[];
};

export type RuntimeDomainEventReturnValueMetadata = {
  readonly deterministic: true;
  readonly persistence: "none";
  readonly source: "runtime-host";
};

export type RuntimeDomainEventReturnValue = {
  readonly eventId: string;
  readonly eventType: string;
  readonly sourceCommandId: string;
  readonly payload?: JsonValue;
  readonly metadata: RuntimeDomainEventReturnValueMetadata;
};

export type RuntimeHostResultMetadata = {
  readonly deterministic: true;
  readonly runtimeHostVersion?: string;
};

export type RuntimeHostResult = {
  readonly status: RuntimeHostStatus;
  readonly nextState?: EngineStateSnapshot;
  readonly diagnostics: readonly ValidationDiagnostic[];
  readonly commandPlan?: RuntimeCommandPlanSummary;
  readonly transaction?: RuntimeTransactionSummary;
  readonly domainEvents?: RuntimeDomainEventSummary;
  readonly runtimeDomainEventValues?: readonly RuntimeDomainEventReturnValue[];
  readonly metadata: RuntimeHostResultMetadata;
};

export function isRuntimeHostStatus(value: unknown): value is RuntimeHostStatus {
  return typeof value === "string" && RUNTIME_HOST_STATUSES.includes(value as RuntimeHostStatus);
}
