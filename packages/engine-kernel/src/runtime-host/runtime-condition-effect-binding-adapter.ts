import { canonicalizeJson, type JsonValue } from "@narrative-engine/core";

import {
  createValidationDiagnostic,
  sortValidationDiagnostics,
  type RuntimeHostInput,
  type ValidationDiagnostic
} from "@narrative-engine/engine-contracts";

import { type RuntimeResolvedCommand } from "./runtime-command-request-resolver.js";

const RUNTIME_CONDITION_EFFECT_BINDING_ADAPTER_VERSION =
  "runtime-condition-effect-binding-adapter@0.1.0" as const;
const STABLE_ID_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u;
const ADAPTER_SOURCE = {
  kind: "runtime-host",
  id: "runtime-condition-effect-binding-adapter"
} as const;

type GraphSectionsShape = Record<string, unknown>;
type GraphRecord = Record<string, unknown>;
type JsonPathSegment = string | number;

type ConditionBindingCode =
  | "RUNTIME_CONDITION_REF_MISSING"
  | "RUNTIME_CONDITION_REF_INVALID"
  | "RUNTIME_CONDITION_NOT_FOUND"
  | "RUNTIME_CONDITION_AMBIGUOUS"
  | "RUNTIME_CONDITION_GRAPH_INVALID";

type EffectBindingCode =
  | "RUNTIME_EFFECT_REF_MISSING"
  | "RUNTIME_EFFECT_REF_INVALID"
  | "RUNTIME_EFFECT_NOT_FOUND"
  | "RUNTIME_EFFECT_AMBIGUOUS"
  | "RUNTIME_EFFECT_GRAPH_INVALID";

export type RuntimeAdaptedConditionBinding = {
  readonly conditionId: string;
  readonly refPath: string;
  readonly path: string;
  readonly conditionDefinition: JsonValue;
};

export type RuntimeAdaptedEffectBinding = {
  readonly effectId: string;
  readonly refPath: string;
  readonly path: string;
  readonly effectDefinition: JsonValue;
};

export type RuntimeConditionEffectBindingAdapterResult = {
  readonly conditions: readonly RuntimeAdaptedConditionBinding[];
  readonly effects: readonly RuntimeAdaptedEffectBinding[];
  readonly diagnostics: readonly ValidationDiagnostic[];
};

type SectionMatch = {
  readonly path: string;
  readonly record: GraphRecord;
};

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

function toStablePath(path: readonly JsonPathSegment[]): string {
  return `/${path.map((segment) => String(segment)).join("/")}`;
}

function parseStablePath(path: string): readonly JsonPathSegment[] {
  if (!path.startsWith("/")) {
    return [];
  }

  return path
    .split("/")
    .slice(1)
    .filter((segment) => segment.length > 0)
    .map((segment) => (/^\d+$/u.test(segment) ? Number(segment) : segment));
}

function createConditionDiagnostic(
  code: ConditionBindingCode,
  path: readonly JsonPathSegment[],
  message: string,
  details?: JsonValue
): ValidationDiagnostic {
  return createValidationDiagnostic({
    ownerContract: RUNTIME_CONDITION_EFFECT_BINDING_ADAPTER_VERSION,
    code,
    severity: "error",
    category:
      code === "RUNTIME_CONDITION_NOT_FOUND" || code === "RUNTIME_CONDITION_AMBIGUOUS"
        ? "reference"
        : "validation",
    phase: "semantic-validation",
    path,
    message,
    source: ADAPTER_SOURCE,
    ...(details === undefined ? {} : { details })
  });
}

function createEffectDiagnostic(
  code: EffectBindingCode,
  path: readonly JsonPathSegment[],
  message: string,
  details?: JsonValue
): ValidationDiagnostic {
  return createValidationDiagnostic({
    ownerContract: RUNTIME_CONDITION_EFFECT_BINDING_ADAPTER_VERSION,
    code,
    severity: "error",
    category:
      code === "RUNTIME_EFFECT_NOT_FOUND" || code === "RUNTIME_EFFECT_AMBIGUOUS"
        ? "reference"
        : "validation",
    phase: "semantic-validation",
    path,
    message,
    source: ADAPTER_SOURCE,
    ...(details === undefined ? {} : { details })
  });
}

function getSections(value: unknown): GraphSectionsShape | undefined {
  return isRecord(value) ? value : undefined;
}

function getSectionItems(
  sections: GraphSectionsShape,
  section: "conditions" | "effects"
): readonly unknown[] | undefined {
  const sectionValue = sections[section];
  if (sectionValue === undefined) {
    return [];
  }

  return Array.isArray(sectionValue) ? sectionValue : undefined;
}

function findSectionMatches(
  sectionItems: readonly unknown[],
  idField: "conditionId" | "effectId",
  refId: string,
  section: "conditions" | "effects"
): readonly SectionMatch[] {
  const matches: SectionMatch[] = [];

  for (let index = 0; index < sectionItems.length; index += 1) {
    const item = sectionItems[index];
    if (!isRecord(item) || !isNonEmptyString(item[idField]) || item[idField] !== refId) {
      continue;
    }

    matches.push({
      path: `/sections/${section}/${String(index)}`,
      record: item
    });
  }

  return matches;
}

function adaptConditions(
  sections: GraphSectionsShape,
  resolvedCommand: RuntimeResolvedCommand
): {
  readonly conditions: readonly RuntimeAdaptedConditionBinding[];
  readonly diagnostics: readonly ValidationDiagnostic[];
} {
  const sectionItems = getSectionItems(sections, "conditions");
  if (sectionItems === undefined) {
    return {
      conditions: Object.freeze([]),
      diagnostics: [
        createConditionDiagnostic(
          "RUNTIME_CONDITION_GRAPH_INVALID",
          ["validatedContentGraph", "sections", "conditions"],
          'Runtime validated content graph section "conditions" must be an array.',
          cloneJson({ section: "conditions", expected: "array" })
        )
      ]
    };
  }

  const bindings: RuntimeAdaptedConditionBinding[] = [];
  const diagnostics: ValidationDiagnostic[] = [];
  const commandPath = parseStablePath(resolvedCommand.path);

  for (let index = 0; index < resolvedCommand.conditionRefs.length; index += 1) {
    const refValue = resolvedCommand.conditionRefs[index] as unknown;
    const refPath = [...commandPath, "conditionRefs", index] as const;

    if (!isNonEmptyString(refValue)) {
      diagnostics.push(
        createConditionDiagnostic(
          "RUNTIME_CONDITION_REF_MISSING",
          refPath,
          "Runtime resolved command conditionRefs entry must define a condition reference."
        )
      );
      continue;
    }

    if (!isStableId(refValue)) {
      diagnostics.push(
        createConditionDiagnostic(
          "RUNTIME_CONDITION_REF_INVALID",
          refPath,
          "Runtime resolved command conditionRefs entry must be a stable content identifier.",
          cloneJson({ expected: "stable content ID" })
        )
      );
      continue;
    }

    const matches = findSectionMatches(sectionItems, "conditionId", refValue, "conditions");
    if (matches.length === 0) {
      diagnostics.push(
        createConditionDiagnostic(
          "RUNTIME_CONDITION_NOT_FOUND",
          refPath,
          "Runtime resolved command condition reference was not found in the validated content graph.",
          cloneJson({ conditionId: refValue })
        )
      );
      continue;
    }

    if (matches.length > 1) {
      diagnostics.push(
        createConditionDiagnostic(
          "RUNTIME_CONDITION_AMBIGUOUS",
          refPath,
          "Runtime resolved command condition reference matched multiple content definitions.",
          cloneJson({
            conditionId: refValue,
            matches: matches.map((match) => match.path)
          })
        )
      );
      continue;
    }

    const [match] = matches;
    if (match === undefined) {
      continue;
    }

    bindings.push({
      conditionId: refValue,
      refPath: toStablePath(refPath),
      path: match.path,
      conditionDefinition: cloneJson(match.record as JsonValue)
    });
  }

  return {
    conditions: Object.freeze(bindings),
    diagnostics: sortValidationDiagnostics(diagnostics)
  };
}

function adaptEffects(
  sections: GraphSectionsShape,
  resolvedCommand: RuntimeResolvedCommand
): {
  readonly effects: readonly RuntimeAdaptedEffectBinding[];
  readonly diagnostics: readonly ValidationDiagnostic[];
} {
  const sectionItems = getSectionItems(sections, "effects");
  if (sectionItems === undefined) {
    return {
      effects: Object.freeze([]),
      diagnostics: [
        createEffectDiagnostic(
          "RUNTIME_EFFECT_GRAPH_INVALID",
          ["validatedContentGraph", "sections", "effects"],
          'Runtime validated content graph section "effects" must be an array.',
          cloneJson({ section: "effects", expected: "array" })
        )
      ]
    };
  }

  const bindings: RuntimeAdaptedEffectBinding[] = [];
  const diagnostics: ValidationDiagnostic[] = [];
  const commandPath = parseStablePath(resolvedCommand.path);

  for (let index = 0; index < resolvedCommand.effectRefs.length; index += 1) {
    const refValue = resolvedCommand.effectRefs[index] as unknown;
    const refPath = [...commandPath, "effectRefs", index] as const;

    if (!isNonEmptyString(refValue)) {
      diagnostics.push(
        createEffectDiagnostic(
          "RUNTIME_EFFECT_REF_MISSING",
          refPath,
          "Runtime resolved command effectRefs entry must define an effect reference."
        )
      );
      continue;
    }

    if (!isStableId(refValue)) {
      diagnostics.push(
        createEffectDiagnostic(
          "RUNTIME_EFFECT_REF_INVALID",
          refPath,
          "Runtime resolved command effectRefs entry must be a stable content identifier.",
          cloneJson({ expected: "stable content ID" })
        )
      );
      continue;
    }

    const matches = findSectionMatches(sectionItems, "effectId", refValue, "effects");
    if (matches.length === 0) {
      diagnostics.push(
        createEffectDiagnostic(
          "RUNTIME_EFFECT_NOT_FOUND",
          refPath,
          "Runtime resolved command effect reference was not found in the validated content graph.",
          cloneJson({ effectId: refValue })
        )
      );
      continue;
    }

    if (matches.length > 1) {
      diagnostics.push(
        createEffectDiagnostic(
          "RUNTIME_EFFECT_AMBIGUOUS",
          refPath,
          "Runtime resolved command effect reference matched multiple content definitions.",
          cloneJson({
            effectId: refValue,
            matches: matches.map((match) => match.path)
          })
        )
      );
      continue;
    }

    const [match] = matches;
    if (match === undefined) {
      continue;
    }

    bindings.push({
      effectId: refValue,
      refPath: toStablePath(refPath),
      path: match.path,
      effectDefinition: cloneJson(match.record as JsonValue)
    });
  }

  return {
    effects: Object.freeze(bindings),
    diagnostics: sortValidationDiagnostics(diagnostics)
  };
}

export function adaptRuntimeConditionEffectBindings(
  input: RuntimeHostInput,
  resolvedCommand: RuntimeResolvedCommand
): RuntimeConditionEffectBindingAdapterResult {
  const sections = getSections(input.validatedContentGraph.sections);
  if (sections === undefined) {
    return {
      conditions: Object.freeze([]),
      effects: Object.freeze([]),
      diagnostics: sortValidationDiagnostics([
        createConditionDiagnostic(
          "RUNTIME_CONDITION_GRAPH_INVALID",
          ["validatedContentGraph", "sections"],
          "Runtime validated content graph sections must be an object."
        ),
        createEffectDiagnostic(
          "RUNTIME_EFFECT_GRAPH_INVALID",
          ["validatedContentGraph", "sections"],
          "Runtime validated content graph sections must be an object."
        )
      ])
    };
  }

  const conditionResult = adaptConditions(sections, resolvedCommand);
  const effectResult = adaptEffects(sections, resolvedCommand);

  return {
    conditions: conditionResult.conditions,
    effects: effectResult.effects,
    diagnostics: sortValidationDiagnostics([
      ...conditionResult.diagnostics,
      ...effectResult.diagnostics
    ])
  };
}
