import { type JsonValue } from "@narrative-engine/core";

import { type ValidationDiagnostic } from "../validation-diagnostic/validation-diagnostic.js";

export const CONTENT_LOAD_STATUSES = ["valid", "invalid", "partial", "blocked"] as const;

export type ContentLoadStatus = (typeof CONTENT_LOAD_STATUSES)[number];

export type ContentLoaderSourceKind = "memory" | "test-fixture" | "provided-object" | "unknown";

export type ContentLoaderSourceMetadata = {
  readonly sourceId?: string;
  readonly sourceKind?: ContentLoaderSourceKind;
  readonly packageId?: string;
  readonly description?: string;
};

export type ContentLoaderInput = {
  readonly rawPackage: unknown;
  readonly source?: ContentLoaderSourceMetadata;
  readonly expectedSchemaVersion?: number | string;
  readonly expectedContractVersion?: string;
  readonly dependencyPackages?: readonly unknown[];
};

export type ValidatedContentManifest = Readonly<Record<string, JsonValue>>;

export type ValidatedContentSections = Readonly<Record<string, JsonValue>>;

export type ValidatedContentReferenceIndex = Readonly<Record<string, readonly string[]>>;

export type ValidatedContentGraph = {
  readonly packageId: string;
  readonly manifest: ValidatedContentManifest;
  readonly sections: ValidatedContentSections;
  readonly referenceIndex: ValidatedContentReferenceIndex;
  readonly dependencySummary: readonly JsonValue[];
  readonly primitiveBindingSummary: readonly JsonValue[];
  readonly localizationKeyIndex: readonly string[];
  readonly assetReferenceIndex: readonly string[];
  readonly diagnosticsSummary: JsonValue;
};

export type ContentLoaderResultMetadata = {
  readonly deterministic: true;
  readonly loaderVersion?: string;
};

export type ContentLoaderResult = {
  readonly status: ContentLoadStatus;
  readonly graph?: ValidatedContentGraph;
  readonly diagnostics: readonly ValidationDiagnostic[];
  readonly metadata: ContentLoaderResultMetadata;
};

export function isContentLoadStatus(value: unknown): value is ContentLoadStatus {
  return typeof value === "string" && CONTENT_LOAD_STATUSES.includes(value as ContentLoadStatus);
}
