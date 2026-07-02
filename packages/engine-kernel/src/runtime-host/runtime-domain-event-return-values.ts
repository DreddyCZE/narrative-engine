import { canonicalizeJson, type JsonValue } from "@narrative-engine/core";

import {
  createValidationDiagnostic,
  sortValidationDiagnostics,
  type RuntimeDomainEventReturnValue,
  type RuntimeDomainEventSummary,
  type RuntimeHostInput,
  type RuntimeTransactionSummary,
  type ValidationDiagnostic
} from "@narrative-engine/engine-contracts";

import { type RuntimeResolvedCommand } from "./runtime-command-request-resolver.js";

const RUNTIME_DOMAIN_EVENT_RETURN_VALUES_VERSION = "runtime-domain-event-return-values@0.1.0" as const;
const EVENT_VALUE_SOURCE = {
  kind: "runtime-host",
  id: "runtime-domain-event-return-values"
} as const;

type GraphSectionsShape = Record<string, unknown>;

type ReturnValueDiagnosticCode =
  | "RUNTIME_DOMAIN_EVENT_GRAPH_INVALID"
  | "RUNTIME_DOMAIN_EVENT_MAPPING_INVALID";

export type RuntimeDomainEventReturnValuesResult = {
  readonly events: readonly RuntimeDomainEventReturnValue[];
  readonly summary: RuntimeDomainEventSummary;
  readonly diagnostics: readonly ValidationDiagnostic[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(canonicalizeJson(value as JsonValue)) as T;
}

function createReturnValueDiagnostic(
  code: ReturnValueDiagnosticCode,
  path: readonly (string | number)[],
  message: string,
  details?: JsonValue
): ValidationDiagnostic {
  return createValidationDiagnostic({
    ownerContract: RUNTIME_DOMAIN_EVENT_RETURN_VALUES_VERSION,
    code,
    severity: "error",
    category: "validation",
    phase: "runtime-execution",
    path,
    message,
    source: EVENT_VALUE_SOURCE,
    ...(details === undefined ? {} : { details })
  });
}

function buildEventId(commandId: string, index: number): string {
  return `runtime-event.${commandId}.${String(index + 1).padStart(2, "0")}`;
}

function buildSummary(events: readonly RuntimeDomainEventReturnValue[]): RuntimeDomainEventSummary {
  return {
    count: events.length,
    eventTypes: Object.freeze(events.map((event) => event.eventType))
  };
}

function findEventMapping(
  eventMappings: readonly unknown[],
  eventMappingId: string
): { readonly eventType: string } | undefined {
  for (const candidate of eventMappings) {
    if (!isRecord(candidate) || candidate.id !== eventMappingId || !isNonEmptyString(candidate.eventType)) {
      continue;
    }

    return {
      eventType: candidate.eventType
    };
  }

  return undefined;
}

export function buildRuntimeDomainEventReturnValues(
  input: RuntimeHostInput,
  resolvedCommand: RuntimeResolvedCommand,
  transaction: RuntimeTransactionSummary
): RuntimeDomainEventReturnValuesResult {
  const sections = isRecord(input.validatedContentGraph.sections)
    ? (input.validatedContentGraph.sections as GraphSectionsShape)
    : undefined;
  if (sections === undefined) {
    return {
      events: Object.freeze([]),
      summary: { count: 0, eventTypes: Object.freeze([]) },
      diagnostics: [
        createReturnValueDiagnostic(
          "RUNTIME_DOMAIN_EVENT_GRAPH_INVALID",
          ["validatedContentGraph", "sections"],
          "Runtime validated content graph sections must be an object."
        )
      ]
    };
  }

  const eventMappings = sections.eventMappings;
  if (eventMappings === undefined) {
    return {
      events: Object.freeze([]),
      summary: { count: 0, eventTypes: Object.freeze([]) },
      diagnostics: Object.freeze([])
    };
  }

  if (!Array.isArray(eventMappings)) {
    return {
      events: Object.freeze([]),
      summary: { count: 0, eventTypes: Object.freeze([]) },
      diagnostics: [
        createReturnValueDiagnostic(
          "RUNTIME_DOMAIN_EVENT_GRAPH_INVALID",
          ["validatedContentGraph", "sections", "eventMappings"],
          'Runtime validated content graph section "eventMappings" must be an array.',
          cloneJson({ section: "eventMappings", expected: "array" })
        )
      ]
    };
  }

  const diagnostics: ValidationDiagnostic[] = [];
  const events: RuntimeDomainEventReturnValue[] = [];

  for (let index = 0; index < resolvedCommand.eventMappingRefs.length; index += 1) {
    const ref = resolvedCommand.eventMappingRefs[index];
    if (ref === undefined) {
      diagnostics.push(
        createReturnValueDiagnostic(
          "RUNTIME_DOMAIN_EVENT_MAPPING_INVALID",
          ["validatedContentGraph", "sections", "eventMappings", index],
          "Runtime domain event mapping reference must be a defined string.",
          cloneJson({ eventMappingId: null })
        )
      );
      continue;
    }

    const mapping = findEventMapping(eventMappings, ref);
    if (mapping === undefined) {
      diagnostics.push(
        createReturnValueDiagnostic(
          "RUNTIME_DOMAIN_EVENT_MAPPING_INVALID",
          ["validatedContentGraph", "sections", "eventMappings", index],
          "Runtime domain event mapping must resolve to an object with eventType.",
          cloneJson({ eventMappingId: ref })
        )
      );
      continue;
    }

    const payload = {
      eventMappingId: ref,
      packageId: input.validatedContentGraph.packageId,
      transactionStatus: transaction.status,
      ...(transaction.nextRevision === undefined ? {} : { revision: transaction.nextRevision })
    } as const;

    events.push({
      eventId: buildEventId(resolvedCommand.commandId, index),
      eventType: mapping.eventType,
      sourceCommandId: resolvedCommand.commandId,
      payload: cloneJson(payload),
      metadata: {
        deterministic: true,
        persistence: "none",
        source: "runtime-host"
      }
    });
  }

  const frozenEvents = Object.freeze(events.map((event) => cloneJson(event)));
  return {
    events: frozenEvents,
    summary: buildSummary(frozenEvents),
    diagnostics: sortValidationDiagnostics(diagnostics)
  };
}
