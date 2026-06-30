import { canonicalizeJson, type JsonValue } from "@narrative-engine/core";

import {
  createValidationDiagnostic,
  sortValidationDiagnostics,
  type ContentLoaderInput,
  type ValidationDiagnostic
} from "@narrative-engine/engine-contracts";

export type ContentM2PrimitiveBindingValidationOptions = {
  readonly allowUnsupportedBindingKinds?: boolean;
};

export type ContentM2PrimitiveBindingValidationResult = {
  readonly diagnostics: readonly ValidationDiagnostic[];
};

type ContentPackageShape = {
  readonly manifest?: {
    readonly declaredSections?: readonly string[];
  };
  readonly sections?: Record<string, unknown>;
};

type ConditionRecord = Record<string, unknown>;
type EffectRecord = Record<string, unknown>;
type CommandRecord = Record<string, unknown>;
type EventMappingRecord = Record<string, unknown>;

const CONTENT_LOADER_BOUNDARY_VERSION = "content-loader-boundary@0.1.0" as const;
const VALIDATION_SOURCE = {
  kind: "content-loader",
  id: "m2-primitive-binding-validator"
} as const;

const CONDITION_TYPES = new Set([
  "all",
  "any",
  "not",
  "constant",
  "exists",
  "compare",
  "contains",
  "entity-is",
  "domain-exists",
  "condition-ref"
]);

const EFFECT_TYPES = new Set([
  "set",
  "set-field",
  "unset",
  "increment",
  "append",
  "remove-at",
  "add-unique",
  "remove-value"
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStableId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u.test(value);
}

function isNamespacedTypeKey(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[a-z0-9]+(?:[._-][a-z0-9]+)*(?:\.[a-z0-9]+(?:[._-][a-z0-9]+)*)+$/u.test(value)
  );
}

function isSupportedVersion(value: unknown): value is 1 {
  return value === 1;
}

function cloneJson<T extends JsonValue>(value: T): T {
  return JSON.parse(canonicalizeJson(value)) as T;
}

function createContentDiagnostic(
  code:
    | "CONTENT_BINDING_INVALID_COMMAND"
    | "CONTENT_BINDING_INVALID_CONDITION"
    | "CONTENT_BINDING_INVALID_EFFECT"
    | "CONTENT_BINDING_INVALID_EVENT_MAPPING"
    | "CONTENT_BINDING_REQUIRED_FIELD_MISSING"
    | "CONTENT_BINDING_UNSUPPORTED_KIND",
  path: readonly (string | number)[],
  message: string,
  details?: JsonValue
): ValidationDiagnostic {
  return createValidationDiagnostic({
    ownerContract: CONTENT_LOADER_BOUNDARY_VERSION,
    code,
    severity: "error",
    category: "validation",
    phase: "semantic-validation",
    path,
    message,
    source: VALIDATION_SOURCE,
    ...(details === undefined ? {} : { details })
  });
}

function getSectionOrder(packageShape: ContentPackageShape): readonly string[] {
  const sections = isRecord(packageShape.sections) ? packageShape.sections : {};
  const declared = Array.isArray(packageShape.manifest?.declaredSections)
    ? packageShape.manifest.declaredSections.filter(isNonEmptyString)
    : [];
  const extras = Object.keys(sections)
    .filter((section) => !declared.includes(section))
    .sort();
  return [...declared, ...extras];
}

function pushMissingField(
  diagnostics: ValidationDiagnostic[],
  path: readonly (string | number)[],
  field: string,
  message: string
): void {
  diagnostics.push(
    createContentDiagnostic(
      "CONTENT_BINDING_REQUIRED_FIELD_MISSING",
      path,
      message,
      cloneJson({ field })
    )
  );
}

function pushInvalid(
  diagnostics: ValidationDiagnostic[],
  code:
    | "CONTENT_BINDING_INVALID_COMMAND"
    | "CONTENT_BINDING_INVALID_CONDITION"
    | "CONTENT_BINDING_INVALID_EFFECT"
    | "CONTENT_BINDING_INVALID_EVENT_MAPPING",
  path: readonly (string | number)[],
  field: string,
  message: string,
  expected: string
): void {
  diagnostics.push(
    createContentDiagnostic(
      code,
      path,
      message,
      cloneJson({
        field,
        expected
      })
    )
  );
}

function pushUnsupportedKind(
  diagnostics: ValidationDiagnostic[],
  path: readonly (string | number)[],
  field: string,
  actual: unknown,
  options: ContentM2PrimitiveBindingValidationOptions
): void {
  if (options.allowUnsupportedBindingKinds === true) {
    return;
  }

  diagnostics.push(
    createContentDiagnostic(
      "CONTENT_BINDING_UNSUPPORTED_KIND",
      path,
      `Binding field "${field}" uses an unsupported content binding kind.`,
      cloneJson({
        field,
        actualKind: Array.isArray(actual) ? "array" : typeof actual
      })
    )
  );
}
function validateCanonicalConditionEnvelope(
  diagnostics: ValidationDiagnostic[],
  condition: ConditionRecord,
  itemPath: readonly (string | number)[],
  options: ContentM2PrimitiveBindingValidationOptions
): void {
  if (!("contractVersion" in condition)) {
    pushMissingField(
      diagnostics,
      [...itemPath, "contractVersion"],
      "contractVersion",
      "Condition binding must define contractVersion."
    );
  } else if (condition.contractVersion !== "condition@0.1.0") {
    pushInvalid(
      diagnostics,
      "CONTENT_BINDING_INVALID_CONDITION",
      [...itemPath, "contractVersion"],
      "contractVersion",
      "Condition binding contractVersion must be condition@0.1.0.",
      "condition@0.1.0"
    );
  }

  if (!("schemaId" in condition)) {
    pushMissingField(
      diagnostics,
      [...itemPath, "schemaId"],
      "schemaId",
      "Condition binding must define schemaId."
    );
  } else if (condition.schemaId !== "condition") {
    pushInvalid(
      diagnostics,
      "CONTENT_BINDING_INVALID_CONDITION",
      [...itemPath, "schemaId"],
      "schemaId",
      "Condition binding schemaId must be condition.",
      "condition"
    );
  }

  if (!("schemaVersion" in condition)) {
    pushMissingField(
      diagnostics,
      [...itemPath, "schemaVersion"],
      "schemaVersion",
      "Condition binding must define schemaVersion."
    );
  } else if (!isSupportedVersion(condition.schemaVersion)) {
    pushInvalid(
      diagnostics,
      "CONTENT_BINDING_INVALID_CONDITION",
      [...itemPath, "schemaVersion"],
      "schemaVersion",
      "Condition binding schemaVersion must be 1.",
      "1"
    );
  }

  if (!("conditionId" in condition)) {
    pushMissingField(
      diagnostics,
      [...itemPath, "conditionId"],
      "conditionId",
      "Condition binding must define conditionId."
    );
  } else if (!isStableId(condition.conditionId)) {
    pushInvalid(
      diagnostics,
      "CONTENT_BINDING_INVALID_CONDITION",
      [...itemPath, "conditionId"],
      "conditionId",
      "Condition binding conditionId must be a stable identifier.",
      "stable content ID"
    );
  }

  if (!("type" in condition)) {
    pushMissingField(diagnostics, [...itemPath, "type"], "type", "Condition binding must define type.");
    return;
  }

  if (!isNonEmptyString(condition.type)) {
    pushInvalid(
      diagnostics,
      "CONTENT_BINDING_INVALID_CONDITION",
      [...itemPath, "type"],
      "type",
      "Condition binding type must be a non-empty string.",
      "supported condition type"
    );
    return;
  }

  if (!CONDITION_TYPES.has(condition.type)) {
    pushUnsupportedKind(diagnostics, [...itemPath, "type"], "type", condition.type, options);
    return;
  }

  switch (condition.type) {
    case "constant":
      if (typeof condition.value !== "boolean") {
        pushInvalid(
          diagnostics,
          "CONTENT_BINDING_INVALID_CONDITION",
          [...itemPath, "value"],
          "value",
          'Condition binding type "constant" must define boolean value.',
          "boolean"
        );
      }
      return;
    case "all":
    case "any":
      if (!Array.isArray(condition.operands)) {
        pushInvalid(
          diagnostics,
          "CONTENT_BINDING_INVALID_CONDITION",
          [...itemPath, "operands"],
          "operands",
          `Condition binding type "${condition.type}" must define operand array.`,
          "array"
        );
      }
      return;
    case "not":
      if (!Array.isArray(condition.operands) || condition.operands.length !== 1) {
        pushInvalid(
          diagnostics,
          "CONTENT_BINDING_INVALID_CONDITION",
          [...itemPath, "operands"],
          "operands",
          'Condition binding type "not" must define exactly one operand.',
          "single-item array"
        );
      }
      return;
    case "condition-ref":
      if (!isStableId(condition.targetConditionId)) {
        pushInvalid(
          diagnostics,
          "CONTENT_BINDING_INVALID_CONDITION",
          [...itemPath, "targetConditionId"],
          "targetConditionId",
          'Condition binding type "condition-ref" must define targetConditionId.',
          "stable content ID"
        );
      }
      return;
    case "domain-exists":
      if (!isStableId(condition.domainId)) {
        pushInvalid(
          diagnostics,
          "CONTENT_BINDING_INVALID_CONDITION",
          [...itemPath, "domainId"],
          "domainId",
          'Condition binding type "domain-exists" must define domainId.',
          "stable domain ID"
        );
      }
      return;
    case "exists":
      if (!isRecord(condition.selector) || !isStableId(condition.selector.domainId) || !isNonEmptyString(condition.selector.path)) {
        pushInvalid(
          diagnostics,
          "CONTENT_BINDING_INVALID_CONDITION",
          [...itemPath, "selector"],
          "selector",
          'Condition binding type "exists" must define selector with domainId and path.',
          "selector"
        );
      }
      return;
    case "compare":
      if (!Array.isArray(condition.operands) || condition.operands.length !== 2) {
        pushInvalid(
          diagnostics,
          "CONTENT_BINDING_INVALID_CONDITION",
          [...itemPath, "operands"],
          "operands",
          'Condition binding type "compare" must define two operands.',
          "two-item array"
        );
      }
      if (!isNonEmptyString(condition.operator)) {
        pushInvalid(
          diagnostics,
          "CONTENT_BINDING_INVALID_CONDITION",
          [...itemPath, "operator"],
          "operator",
          'Condition binding type "compare" must define operator.',
          "comparison operator"
        );
      }
      return;
    case "contains":
    case "entity-is":
      if (!Array.isArray(condition.operands) || condition.operands.length !== 2) {
        pushInvalid(
          diagnostics,
          "CONTENT_BINDING_INVALID_CONDITION",
          [...itemPath, "operands"],
          "operands",
          `Condition binding type "${condition.type}" must define two operands.`,
          "two-item array"
        );
      }
      return;
    default:
      return;
  }
}

function validateCanonicalEffectEnvelope(
  diagnostics: ValidationDiagnostic[],
  effect: EffectRecord,
  itemPath: readonly (string | number)[],
  options: ContentM2PrimitiveBindingValidationOptions
): void {
  if (!("contractVersion" in effect)) {
    pushMissingField(diagnostics, [...itemPath, "contractVersion"], "contractVersion", "Effect binding must define contractVersion.");
  } else if (effect.contractVersion !== "effect@0.1.0") {
    pushInvalid(diagnostics, "CONTENT_BINDING_INVALID_EFFECT", [...itemPath, "contractVersion"], "contractVersion", "Effect binding contractVersion must be effect@0.1.0.", "effect@0.1.0");
  }

  if (!("schemaId" in effect)) {
    pushMissingField(diagnostics, [...itemPath, "schemaId"], "schemaId", "Effect binding must define schemaId.");
  } else if (effect.schemaId !== "effect") {
    pushInvalid(diagnostics, "CONTENT_BINDING_INVALID_EFFECT", [...itemPath, "schemaId"], "schemaId", "Effect binding schemaId must be effect.", "effect");
  }

  if (!("schemaVersion" in effect)) {
    pushMissingField(diagnostics, [...itemPath, "schemaVersion"], "schemaVersion", "Effect binding must define schemaVersion.");
  } else if (!isSupportedVersion(effect.schemaVersion)) {
    pushInvalid(diagnostics, "CONTENT_BINDING_INVALID_EFFECT", [...itemPath, "schemaVersion"], "schemaVersion", "Effect binding schemaVersion must be 1.", "1");
  }

  if (!("effectId" in effect)) {
    pushMissingField(diagnostics, [...itemPath, "effectId"], "effectId", "Effect binding must define effectId.");
  } else if (!isStableId(effect.effectId)) {
    pushInvalid(diagnostics, "CONTENT_BINDING_INVALID_EFFECT", [...itemPath, "effectId"], "effectId", "Effect binding effectId must be a stable identifier.", "stable content ID");
  }

  if (!("type" in effect)) {
    pushMissingField(diagnostics, [...itemPath, "type"], "type", "Effect binding must define type.");
    return;
  }

  if (!isNonEmptyString(effect.type)) {
    pushInvalid(diagnostics, "CONTENT_BINDING_INVALID_EFFECT", [...itemPath, "type"], "type", "Effect binding type must be a non-empty string.", "supported effect type");
    return;
  }

  if (!EFFECT_TYPES.has(effect.type)) {
    pushUnsupportedKind(diagnostics, [...itemPath, "type"], "type", effect.type, options);
    return;
  }

  if (!isRecord(effect.target) || !isNonEmptyString(effect.target.path)) {
    pushInvalid(diagnostics, "CONTENT_BINDING_INVALID_EFFECT", [...itemPath, "target"], "target", "Effect binding must define target.path.", "target with path");
    return;
  }

  if (!effect.target.path.startsWith("/")) {
    pushInvalid(diagnostics, "CONTENT_BINDING_INVALID_EFFECT", [...itemPath, "target", "path"], "target.path", "Effect binding target.path must start with '/'.", "JSON pointer-like path");
  }

  switch (effect.type) {
    case "set":
    case "set-field":
    case "append":
    case "add-unique":
    case "remove-value":
      if (!("value" in effect)) {
        pushMissingField(diagnostics, [...itemPath, "value"], "value", `Effect binding type "${effect.type}" must define value.`);
      }
      return;
    case "increment":
      if (typeof effect.delta !== "number" || !Number.isFinite(effect.delta)) {
        pushInvalid(diagnostics, "CONTENT_BINDING_INVALID_EFFECT", [...itemPath, "delta"], "delta", 'Effect binding type "increment" must define finite numeric delta.', "finite number");
      }
      return;
    case "remove-at":
      if (typeof effect.index !== "number" || !Number.isInteger(effect.index) || effect.index < 0) {
        pushInvalid(diagnostics, "CONTENT_BINDING_INVALID_EFFECT", [...itemPath, "index"], "index", 'Effect binding type "remove-at" must define non-negative integer index.', "non-negative integer");
      }
      return;
    case "unset":
      return;
    default:
      return;
  }
}

function validateCommandBinding(
  diagnostics: ValidationDiagnostic[],
  command: CommandRecord,
  itemPath: readonly (string | number)[],
  options: ContentM2PrimitiveBindingValidationOptions
): void {
  if (!isStableId(command.id)) {
    if (!("id" in command)) {
      pushMissingField(diagnostics, [...itemPath, "id"], "id", "Command binding must define id.");
    } else {
      pushInvalid(diagnostics, "CONTENT_BINDING_INVALID_COMMAND", [...itemPath, "id"], "id", "Command binding id must be a stable identifier.", "stable content ID");
    }
  }

  if (!("commandType" in command)) {
    pushMissingField(diagnostics, [...itemPath, "commandType"], "commandType", "Command binding must define commandType.");
  } else if (!isNamespacedTypeKey(command.commandType)) {
    pushInvalid(diagnostics, "CONTENT_BINDING_INVALID_COMMAND", [...itemPath, "commandType"], "commandType", "Command binding commandType must be a lowercase namespaced key.", "lowercase namespaced key");
  }

  if (!("conditionRefs" in command)) {
    pushMissingField(diagnostics, [...itemPath, "conditionRefs"], "conditionRefs", "Command binding must define conditionRefs explicitly.");
  } else if (!Array.isArray(command.conditionRefs)) {
    pushUnsupportedKind(diagnostics, [...itemPath, "conditionRefs"], "conditionRefs", command.conditionRefs, options);
  } else {
    for (let index = 0; index < command.conditionRefs.length; index += 1) {
      if (!isStableId(command.conditionRefs[index])) {
        pushInvalid(diagnostics, "CONTENT_BINDING_INVALID_COMMAND", [...itemPath, "conditionRefs", index], "conditionRefs", "Command binding conditionRefs entries must be stable identifiers.", "stable content ID");
      }
    }
  }

  if (!("effectRefs" in command)) {
    pushMissingField(diagnostics, [...itemPath, "effectRefs"], "effectRefs", "Command binding must define effectRefs explicitly.");
  } else if (!Array.isArray(command.effectRefs)) {
    pushUnsupportedKind(diagnostics, [...itemPath, "effectRefs"], "effectRefs", command.effectRefs, options);
  } else {
    for (let index = 0; index < command.effectRefs.length; index += 1) {
      if (!isStableId(command.effectRefs[index])) {
        pushInvalid(diagnostics, "CONTENT_BINDING_INVALID_COMMAND", [...itemPath, "effectRefs", index], "effectRefs", "Command binding effectRefs entries must be stable identifiers.", "stable content ID");
      }
    }
  }
}

function validateEventMappingBinding(
  diagnostics: ValidationDiagnostic[],
  eventMapping: EventMappingRecord,
  itemPath: readonly (string | number)[]
): void {
  if (!isStableId(eventMapping.id)) {
    if (!("id" in eventMapping)) {
      pushMissingField(diagnostics, [...itemPath, "id"], "id", "Event mapping binding must define id.");
    } else {
      pushInvalid(diagnostics, "CONTENT_BINDING_INVALID_EVENT_MAPPING", [...itemPath, "id"], "id", "Event mapping binding id must be a stable identifier.", "stable content ID");
    }
  }

  if (!("eventType" in eventMapping)) {
    pushMissingField(diagnostics, [...itemPath, "eventType"], "eventType", "Event mapping binding must define eventType.");
  } else if (!isNamespacedTypeKey(eventMapping.eventType)) {
    pushInvalid(diagnostics, "CONTENT_BINDING_INVALID_EVENT_MAPPING", [...itemPath, "eventType"], "eventType", "Event mapping binding eventType must be a lowercase namespaced key.", "lowercase namespaced key");
  }

  const hasCommandId = isStableId(eventMapping.commandId);
  const hasTransactionId = isStableId(eventMapping.transactionId);
  if (!hasCommandId && !hasTransactionId) {
    if ("commandId" in eventMapping || "transactionId" in eventMapping) {
      pushInvalid(diagnostics, "CONTENT_BINDING_INVALID_EVENT_MAPPING", [...itemPath, "commandId"], "commandId|transactionId", "Event mapping binding must expose stable commandId or transactionId source.", "stable content ID");
    } else {
      pushMissingField(diagnostics, [...itemPath, "commandId"], "commandId|transactionId", "Event mapping binding must define commandId or transactionId source.");
    }
  }
}

function validateSectionBindings(
  diagnostics: ValidationDiagnostic[],
  sectionName: string,
  sectionValue: unknown,
  options: ContentM2PrimitiveBindingValidationOptions
): void {
  if (!Array.isArray(sectionValue)) {
    return;
  }

  for (let itemIndex = 0; itemIndex < sectionValue.length; itemIndex += 1) {
    const item: unknown = sectionValue[itemIndex];
    const itemPath = ["sections", sectionName, itemIndex] as const;

    if (!isRecord(item)) {
      pushUnsupportedKind(diagnostics, itemPath, sectionName, item, options);
      continue;
    }

    switch (sectionName) {
      case "conditions":
        validateCanonicalConditionEnvelope(diagnostics, item, itemPath, options);
        break;
      case "effects":
        validateCanonicalEffectEnvelope(diagnostics, item, itemPath, options);
        break;
      case "commands":
        validateCommandBinding(diagnostics, item, itemPath, options);
        break;
      case "eventMappings":
        validateEventMappingBinding(diagnostics, item, itemPath);
        break;
      default:
        break;
    }
  }
}

export function validateContentM2PrimitiveBindings(
  input: ContentLoaderInput,
  options: ContentM2PrimitiveBindingValidationOptions = {}
): ContentM2PrimitiveBindingValidationResult {
  if (!isRecord(input.rawPackage)) {
    return {
      diagnostics: sortValidationDiagnostics([
        createContentDiagnostic(
          "CONTENT_BINDING_UNSUPPORTED_KIND",
          ["rawPackage"],
          "Content loader rawPackage must be a JSON object before M2 primitive binding validation."
        )
      ])
    };
  }

  const packageShape = input.rawPackage as ContentPackageShape;
  const sections = isRecord(packageShape.sections) ? packageShape.sections : {};
  const diagnostics: ValidationDiagnostic[] = [];
  const sectionOrder = getSectionOrder(packageShape);

  for (const sectionName of sectionOrder) {
    validateSectionBindings(diagnostics, sectionName, sections[sectionName], options);
  }

  return {
    diagnostics: sortValidationDiagnostics(diagnostics)
  };
}

