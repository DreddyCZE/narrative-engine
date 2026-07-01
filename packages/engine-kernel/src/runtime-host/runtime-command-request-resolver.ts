import { canonicalizeJson, type JsonValue } from "@narrative-engine/core";

import {
  createValidationDiagnostic,
  sortValidationDiagnostics,
  type RuntimeHostInput,
  type ValidationDiagnostic
} from "@narrative-engine/engine-contracts";

const RUNTIME_COMMAND_REQUEST_RESOLVER_VERSION = "runtime-command-request-resolver@0.1.0" as const;
const STABLE_ID_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u;
const RESOLVER_SOURCE = {
  kind: "runtime-host",
  id: "runtime-command-request-resolver"
} as const;

type CommandRecord = Record<string, unknown>;
type RuntimeResolvedCommandSection = "commands" | "actions";

export type RuntimeResolvedCommand = {
  readonly commandId: string;
  readonly section: RuntimeResolvedCommandSection;
  readonly path: string;
  readonly commandType?: string;
  readonly commandDefinition: JsonValue;
  readonly conditionRefs: readonly string[];
  readonly effectRefs: readonly string[];
  readonly eventMappingRefs: readonly string[];
};

export type RuntimeCommandRequestResolutionResult = {
  readonly resolved?: RuntimeResolvedCommand;
  readonly diagnostics: readonly ValidationDiagnostic[];
};

type ResolvedCommandCandidate = {
  readonly section: RuntimeResolvedCommandSection;
  readonly path: string;
  readonly record: CommandRecord;
};

type GraphSectionsShape = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStableId(value: unknown): value is string {
  return typeof value === "string" && STABLE_ID_PATTERN.test(value);
}

function cloneJson<T extends JsonValue>(value: T): T {
  return JSON.parse(canonicalizeJson(value)) as T;
}

function createResolverDiagnostic(
  code:
    | "RUNTIME_COMMAND_REQUEST_INVALID"
    | "RUNTIME_COMMAND_ID_MISSING"
    | "RUNTIME_COMMAND_ID_INVALID"
    | "RUNTIME_COMMAND_NOT_FOUND"
    | "RUNTIME_COMMAND_AMBIGUOUS"
    | "RUNTIME_COMMAND_GRAPH_INVALID",
  path: readonly (string | number)[],
  message: string,
  details?: JsonValue
): ValidationDiagnostic {
  return createValidationDiagnostic({
    ownerContract: RUNTIME_COMMAND_REQUEST_RESOLVER_VERSION,
    code,
    severity: "error",
    category: code === "RUNTIME_COMMAND_NOT_FOUND" ? "reference" : "validation",
    phase: "semantic-validation",
    path,
    message,
    source: RESOLVER_SOURCE,
    ...(details === undefined ? {} : { details })
  });
}

function invalidResult(...diagnostics: readonly ValidationDiagnostic[]): RuntimeCommandRequestResolutionResult {
  return {
    diagnostics: sortValidationDiagnostics(diagnostics)
  };
}

function getSections(value: unknown): GraphSectionsShape | undefined {
  return isRecord(value) ? value : undefined;
}

function getArrayItems(value: unknown): readonly unknown[] | undefined {
  return Array.isArray(value) ? value : undefined;
}

function validateSectionArray(
  sections: GraphSectionsShape,
  section: RuntimeResolvedCommandSection
): readonly ValidationDiagnostic[] {
  const sectionValue = sections[section];
  if (sectionValue === undefined) {
    return [];
  }

  if (!Array.isArray(sectionValue)) {
    return [
      createResolverDiagnostic(
        "RUNTIME_COMMAND_GRAPH_INVALID",
        ["validatedContentGraph", "sections", section],
        `Runtime validated content graph section "${section}" must be an array.`,
        cloneJson({ section, expected: "array" })
      )
    ];
  }

  return [];
}

function findMatchingCandidates(
  sections: GraphSectionsShape,
  commandId: string
): readonly ResolvedCommandCandidate[] {
  const candidates: ResolvedCommandCandidate[] = [];

  for (const section of ["commands", "actions"] as const) {
    const sectionItems = getArrayItems(sections[section]);
    if (sectionItems === undefined) {
      continue;
    }

    for (let index = 0; index < sectionItems.length; index += 1) {
      const item = sectionItems[index];
      if (!isRecord(item) || !isNonEmptyString(item.id)) {
        continue;
      }

      if (item.id !== commandId) {
        continue;
      }

      candidates.push({
        section,
        path: `/sections/${section}/${String(index)}`,
        record: item
      });
    }
  }

  return candidates;
}

function collectEventMappingRefs(sections: GraphSectionsShape, commandId: string): readonly string[] {
  const eventMappings = getArrayItems(sections.eventMappings);
  if (eventMappings === undefined) {
    return [];
  }

  const refs: string[] = [];
  for (const item of eventMappings) {
    if (!isRecord(item) || item.commandId !== commandId || !isNonEmptyString(item.id)) {
      continue;
    }

    refs.push(item.id);
  }

  return Object.freeze(refs.slice().sort((left, right) => left.localeCompare(right)));
}

function toStringArray(value: unknown): readonly string[] {
  const items = getArrayItems(value);
  if (items === undefined) {
    return [];
  }

  return Object.freeze(items.filter(isNonEmptyString).slice());
}

function createResolvedCommand(
  candidate: ResolvedCommandCandidate,
  sections: GraphSectionsShape,
  commandId: string
): RuntimeResolvedCommand {
  return {
    commandId,
    section: candidate.section,
    path: candidate.path,
    ...(isNonEmptyString(candidate.record.commandType)
      ? { commandType: candidate.record.commandType }
      : {}),
    commandDefinition: cloneJson(candidate.record as JsonValue),
    conditionRefs: toStringArray(candidate.record.conditionRefs),
    effectRefs: toStringArray(candidate.record.effectRefs),
    eventMappingRefs: collectEventMappingRefs(sections, commandId)
  };
}

export function resolveRuntimeCommandRequest(
  input: RuntimeHostInput
): RuntimeCommandRequestResolutionResult {
  if (!isRecord(input)) {
    return invalidResult(
      createResolverDiagnostic(
        "RUNTIME_COMMAND_REQUEST_INVALID",
        ["request"],
        "Runtime host input must be an object."
      )
    );
  }

  const request = isRecord(input.request) ? input.request : undefined;
  if (request === undefined) {
    return invalidResult(
      createResolverDiagnostic(
        "RUNTIME_COMMAND_REQUEST_INVALID",
        ["request"],
        "Runtime host input request must be an object."
      )
    );
  }

  if (!isNonEmptyString(request.commandId)) {
    return invalidResult(
      createResolverDiagnostic(
        "RUNTIME_COMMAND_ID_MISSING",
        ["request", "commandId"],
        "Runtime command request must define commandId."
      )
    );
  }

  if (!isStableId(request.commandId)) {
    return invalidResult(
      createResolverDiagnostic(
        "RUNTIME_COMMAND_ID_INVALID",
        ["request", "commandId"],
        "Runtime command request commandId must be a stable content identifier.",
        cloneJson({ expected: "stable content ID" })
      )
    );
  }

  const sections = getSections(input.validatedContentGraph.sections);
  if (sections === undefined) {
    return invalidResult(
      createResolverDiagnostic(
        "RUNTIME_COMMAND_GRAPH_INVALID",
        ["validatedContentGraph", "sections"],
        "Runtime validated content graph sections must be an object."
      )
    );
  }

  const sectionDiagnostics = [
    ...validateSectionArray(sections, "commands"),
    ...validateSectionArray(sections, "actions")
  ];
  if (sectionDiagnostics.length > 0) {
    return invalidResult(...sectionDiagnostics);
  }

  const matches = findMatchingCandidates(sections, request.commandId);
  if (matches.length === 0) {
    return invalidResult(
      createResolverDiagnostic(
        "RUNTIME_COMMAND_NOT_FOUND",
        ["request", "commandId"],
        "Runtime command request commandId was not found in the validated content graph.",
        cloneJson({ commandId: request.commandId })
      )
    );
  }

  if (matches.length > 1) {
    return invalidResult(
      createResolverDiagnostic(
        "RUNTIME_COMMAND_AMBIGUOUS",
        ["request", "commandId"],
        "Runtime command request commandId matched multiple content definitions.",
        cloneJson({
          commandId: request.commandId,
          matches: matches.map((match) => match.path)
        })
      )
    );
  }

  const [resolvedMatch] = matches;
  if (resolvedMatch === undefined) {
    return invalidResult(
      createResolverDiagnostic(
        "RUNTIME_COMMAND_NOT_FOUND",
        ["request", "commandId"],
        "Runtime command request commandId was not found in the validated content graph.",
        cloneJson({ commandId: request.commandId })
      )
    );
  }

  return {
    resolved: createResolvedCommand(resolvedMatch, sections, request.commandId),
    diagnostics: Object.freeze([])
  };
}
