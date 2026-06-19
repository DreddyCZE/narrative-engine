import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  assertSchemaVersionDescriptor,
  checkSchemaCompatibility,
  compareSchemaVersions,
  inspectSchemaVersionDescriptor,
  isSchemaVersionDescriptor
} from "../packages/engine-contracts/src/index.js";

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function parseJson(text: string): unknown {
  return JSON.parse(text) as unknown;
}

describe("Schema Versioning compatibility helper", () => {
  it("accepts a valid exact descriptor and returns an exact compatibility result", () => {
    const descriptor = readJson("tests/fixtures/contracts/schema-versioning/valid/reader-exact.json");

    expect(isSchemaVersionDescriptor(descriptor)).toBe(true);
    expect(inspectSchemaVersionDescriptor(descriptor)).toEqual([]);
    expect(checkSchemaCompatibility(descriptor, 1)).toEqual({ status: "EXACT", issues: [] });
  });

  it("reports readable and migration-required outcomes", () => {
    const readable = readJson("tests/fixtures/contracts/schema-versioning/valid/reader-range.json");
    const migratable = {
      contractVersion: "schema-versioning@0.1.0",
      schemaId: "migratable-schema",
      owningPackage: "@narrative-engine/engine-contracts",
      contract: {
        id: "migratable-schema",
        version: "migratable-schema@0.1.0"
      },
      versions: [
        {
          schemaVersion: 1,
          status: "accepted",
          jsonSchema: "schemas/migratable-schema.v1.schema.json"
        },
        {
          schemaVersion: 2,
          status: "accepted",
          jsonSchema: "schemas/migratable-schema.schema.json"
        }
      ],
      readerSupport: {
        minVersion: 2,
        maxVersion: 2
      },
      writerVersion: 2,
      migrations: [
        {
          migrationId: "migratable-schema.1-to-2",
          schemaId: "migratable-schema",
          fromVersion: 1,
          toVersion: 2,
          direction: "upgrade",
          deterministic: true,
          lossy: false,
          requiresContext: false
        }
      ]
    } as const;

    expect(checkSchemaCompatibility(readable, 2).status).toBe("READABLE");
    expect(checkSchemaCompatibility(migratable, 1).status).toBe("MIGRATION_REQUIRED");
  });

  it("reports unsupported newer and older outcomes", () => {
    const newer = {
      contractVersion: "schema-versioning@0.1.0",
      schemaId: "future-schema",
      owningPackage: "@narrative-engine/engine-contracts",
      contract: {
        id: "future-schema",
        version: "future-schema@0.1.0"
      },
      versions: [
        {
          schemaVersion: 1,
          status: "accepted",
          jsonSchema: "schemas/future-schema.v1.schema.json"
        },
        {
          schemaVersion: 2,
          status: "accepted",
          jsonSchema: "schemas/future-schema.schema.json"
        }
      ],
      readerSupport: {
        minVersion: 1,
        maxVersion: 2
      },
      writerVersion: 2
    } as const;
    const older = {
      contractVersion: "schema-versioning@0.1.0",
      schemaId: "legacy-schema",
      owningPackage: "@narrative-engine/engine-contracts",
      contract: {
        id: "legacy-schema",
        version: "legacy-schema@0.1.0"
      },
      versions: [
        {
          schemaVersion: 2,
          status: "accepted",
          jsonSchema: "schemas/legacy-schema.schema.json"
        }
      ],
      readerSupport: {
        minVersion: 2,
        maxVersion: 2
      },
      writerVersion: 2
    } as const;

    expect(checkSchemaCompatibility(newer, 3).status).toBe("UNSUPPORTED_NEWER");
    expect(checkSchemaCompatibility(older, 1).status).toBe("UNSUPPORTED_OLDER");
  });

  it("reports missing schema and invalid version inputs", () => {
    const descriptor = readJson("tests/fixtures/contracts/schema-versioning/valid/reader-exact.json");

    expect(checkSchemaCompatibility(undefined, 1).status).toBe("MISSING_SCHEMA");
    expect(checkSchemaCompatibility(descriptor, "1").status).toBe("INVALID_VERSION");
  });

  it("rejects malformed descriptors with stable diagnostics", () => {
    const malformed = parseJson(
      '{ "contractVersion": "schema-versioning@0.1.0", "schemaId": "game-manifest", "owningPackage": "@narrative-engine/engine-contracts", "contract": { "id": "game-manifest", "version": "game-manifest@0.1.0" }, "versions": [{ "schemaVersion": 1, "status": "accepted", "jsonSchema": "schemas/game-manifest.schema.json" }], "readerSupport": { "minVersion": 1, "maxVersion": 1 }, "writerVersion": 1, "__proto__": 1 }'
    );
    const cyclic: Record<string, unknown> = {
      contractVersion: "schema-versioning@0.1.0",
      schemaId: "game-manifest",
      owningPackage: "@narrative-engine/engine-contracts",
      contract: {
        id: "game-manifest",
        version: "game-manifest@0.1.0"
      },
      versions: [
        {
          schemaVersion: 1,
          status: "accepted",
          jsonSchema: "schemas/game-manifest.schema.json"
        }
      ],
      readerSupport: {
        minVersion: 1,
        maxVersion: 1
      },
      writerVersion: 1
    };
    cyclic.self = cyclic;

    const missingSchemaId = {
      contractVersion: "schema-versioning@0.1.0",
      owningPackage: "@narrative-engine/engine-contracts",
      contract: {
        id: "game-manifest",
        version: "game-manifest@0.1.0"
      },
      versions: [
        {
          schemaVersion: 1,
          status: "accepted",
          jsonSchema: "schemas/game-manifest.schema.json"
        }
      ],
      readerSupport: {
        minVersion: 1,
        maxVersion: 1
      },
      writerVersion: 1
    };

    const first = inspectSchemaVersionDescriptor(malformed);
    const second = inspectSchemaVersionDescriptor(malformed);

    expect(first).toEqual(second);
    expect(first.some((issue) => issue.code === "SCHEMA_VERSIONING_FORBIDDEN_KEY")).toBe(true);
    expect(inspectSchemaVersionDescriptor(cyclic).some((issue) => issue.code === "SCHEMA_VERSIONING_NON_JSON_VALUE")).toBe(true);
    expect(inspectSchemaVersionDescriptor(missingSchemaId).some((issue) => issue.path[0] === "schemaId")).toBe(true);
  });

  it("supports assertions and preserves input", () => {
    const descriptor = readJson("tests/fixtures/contracts/schema-versioning/valid/writer-current.json");
    const before = JSON.stringify(descriptor);

    expect(() => {
      assertSchemaVersionDescriptor(descriptor);
    }).not.toThrow();

    expect(() =>
      {
        assertSchemaVersionDescriptor({
          contractVersion: "schema-versioning@0.1.0",
          schemaId: "game-manifest",
          owningPackage: "@narrative-engine/engine-contracts",
          contract: {
            id: "game-manifest",
            version: "game-manifest@0.1.0"
          },
          versions: [
            {
              schemaVersion: 1,
              status: "accepted",
              jsonSchema: "schemas/game-manifest.schema.json"
            }
          ],
          readerSupport: {
            minVersion: 1,
            maxVersion: 1
          },
          writerVersion: 2
        });
      }
    ).toThrowError();

    expect(JSON.stringify(descriptor)).toBe(before);
  });

  it("compares versions deterministically", () => {
    expect(compareSchemaVersions(1, 1)).toBe(0);
    expect(compareSchemaVersions(1, 2)).toBe(-1);
    expect(compareSchemaVersions(10, 2)).toBe(1);
  });

  it("does not mutate descriptor inputs or execute migrations", () => {
    const descriptor = {
      contractVersion: "schema-versioning@0.1.0",
      schemaId: "migratable-schema",
      owningPackage: "@narrative-engine/engine-contracts",
      contract: {
        id: "migratable-schema",
        version: "migratable-schema@0.1.0"
      },
      versions: [
        {
          schemaVersion: 1,
          status: "accepted",
          jsonSchema: "schemas/migratable-schema.v1.schema.json"
        },
        {
          schemaVersion: 2,
          status: "accepted",
          jsonSchema: "schemas/migratable-schema.schema.json"
        }
      ],
      readerSupport: {
        minVersion: 2,
        maxVersion: 2
      },
      writerVersion: 2,
      migrations: [
        {
          migrationId: "migratable-schema.1-to-2",
          schemaId: "migratable-schema",
          fromVersion: 1,
          toVersion: 2,
          direction: "upgrade",
          deterministic: true,
          lossy: false,
          requiresContext: false
        }
      ]
    } as const;
    const before = JSON.stringify(descriptor);

    expect(checkSchemaCompatibility(descriptor, 1)).toEqual({
      status: "MIGRATION_REQUIRED",
      issues: [
        {
          code: "SCHEMA_VERSIONING_MIGRATION_REQUIRED",
          path: ["schemaVersion"],
          message: "Schema version 1 requires migration to 2."
        }
      ]
    });
    expect(JSON.stringify(descriptor)).toBe(before);
  });
});
