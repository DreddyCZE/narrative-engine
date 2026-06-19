import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  assertEntityIdentity,
  inspectEntityIdentity,
  isEntityIdentity
} from "../packages/engine-contracts/src/index.js";

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function parseJson(text: string): unknown {
  return JSON.parse(text) as unknown;
}

describe("Entity Identity validator", () => {
  it("accepts a valid minimal identity", () => {
    const value = readJson("tests/fixtures/contracts/entity-identity/valid/minimal.json");

    expect(isEntityIdentity(value)).toBe(true);
    expect(inspectEntityIdentity(value)).toEqual([]);
  });

  it("accepts a valid identity with optional blocks", () => {
    const provenance = readJson("tests/fixtures/contracts/entity-identity/valid/with-provenance.json");
    const alias = readJson("tests/fixtures/contracts/entity-identity/valid/with-alias.json");
    const tags = readJson("tests/fixtures/contracts/entity-identity/valid/with-tags.json");

    expect(isEntityIdentity(provenance)).toBe(true);
    expect(isEntityIdentity(alias)).toBe(true);
    expect(isEntityIdentity(tags)).toBe(true);
  });

  it("rejects a missing id with a stable diagnostic path", () => {
    const value = {
      contractVersion: "entity-identity@0.1.0",
      entityType: "room",
      namespace: "demo",
      schemaVersion: 1
    };

    const issues = inspectEntityIdentity(value);

    expect(issues[0]?.code).toBe("ENTITY_IDENTITY_MISSING_ID");
    expect(issues[0]?.path).toEqual(["id"]);
    expect(isEntityIdentity(value)).toBe(false);
  });

  it("rejects an invalid id type and empty id values", () => {
    const invalidType = {
      contractVersion: "entity-identity@0.1.0",
      id: 42,
      entityType: "room",
      namespace: "demo",
      schemaVersion: 1
    };
    const emptyId = {
      contractVersion: "entity-identity@0.1.0",
      id: "",
      entityType: "room",
      namespace: "demo",
      schemaVersion: 1
    };

    expect(inspectEntityIdentity(invalidType).some((issue) => issue.code === "ENTITY_IDENTITY_INVALID_ID")).toBe(true);
    expect(inspectEntityIdentity(emptyId).some((issue) => issue.code === "ENTITY_IDENTITY_INVALID_ID")).toBe(true);
  });

  it("rejects missing type, namespace, and schemaVersion values", () => {
    const value = {
      contractVersion: "entity-identity@0.1.0",
      id: "room.demo.start"
    };

    const issues = inspectEntityIdentity(value);

    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "ENTITY_IDENTITY_MISSING_TYPE",
        "ENTITY_IDENTITY_MISSING_NAMESPACE",
        "ENTITY_IDENTITY_MISSING_SCHEMA_VERSION"
      ])
    );
  });

  it("rejects prefix mismatches", () => {
    const value = readJson("tests/fixtures/contracts/entity-identity/invalid/type-prefix-mismatch.json");
    const issues = inspectEntityIdentity(value);

    expect(issues.some((issue) => issue.code === "ENTITY_IDENTITY_TYPE_MISMATCH")).toBe(true);
  });

  it("rejects forbidden keys, non-JSON values, and cycles", () => {
    const forbidden = parseJson('{ "contractVersion": "entity-identity@0.1.0", "id": "room.demo.start", "__proto__": 1, "entityType": "room", "namespace": "demo", "schemaVersion": 1 }');
    const nonJson = {
      contractVersion: "entity-identity@0.1.0",
      id: "room.demo.start",
      entityType: "room",
      namespace: "demo",
      schemaVersion: 1,
      provenance: new Date()
    };
    const cycle: Record<string, unknown> = {
      contractVersion: "entity-identity@0.1.0",
      id: "room.demo.start",
      entityType: "room",
      namespace: "demo",
      schemaVersion: 1
    };
    cycle.self = cycle;

    expect(inspectEntityIdentity(forbidden).some((issue) => issue.code === "ENTITY_IDENTITY_FORBIDDEN_KEY")).toBe(true);
    expect(inspectEntityIdentity(nonJson).some((issue) => issue.code === "ENTITY_IDENTITY_NON_JSON_VALUE")).toBe(true);
    expect(inspectEntityIdentity(cycle).some((issue) => issue.code === "ENTITY_IDENTITY_NON_JSON_VALUE")).toBe(true);
  });

  it("rejects invalid provenance and change blocks", () => {
    const value = {
      contractVersion: "entity-identity@0.1.0",
      id: "dialogue.demo.greeting",
      entityType: "dialogue",
      namespace: "demo",
      schemaVersion: 1,
      provenance: {
        sourceFile: "/absolute/path.json",
        sourceEntityId: "dialogue.demo.greeting",
        taskId: "TASK-004"
      },
      change: {
        revision: 1,
        createdBy: "author.content",
        updatedBy: "Invalid Actor"
      }
    };

    const issues = inspectEntityIdentity(value);

    expect(issues.some((issue) => issue.code === "ENTITY_IDENTITY_INVALID_PROVENANCE")).toBe(true);
    expect(issues.some((issue) => issue.code === "ENTITY_IDENTITY_INVALID_CHANGE")).toBe(true);
    expect(issues.some((issue) => issue.path[0] === "provenance" && issue.path[1] === "sourceFile")).toBe(true);
  });

  it("is deterministic and does not mutate input", () => {
    const value = {
      contractVersion: "entity-identity@0.1.0",
      id: "fact.demo.first-clue",
      entityType: "fact",
      namespace: "demo",
      schemaVersion: 1,
      tags: ["intro", "required"]
    };
    const before = JSON.stringify(value);

    const first = inspectEntityIdentity(value);
    const second = inspectEntityIdentity(value);

    expect(first).toEqual(second);
    expect(JSON.stringify(value)).toBe(before);
  });

  it("supports assertions", () => {
    const value = readJson("tests/fixtures/contracts/entity-identity/valid/minimal.json");

    expect(() => {
      assertEntityIdentity(value);
    }).not.toThrow();
    expect(() =>
      {
        assertEntityIdentity({
          contractVersion: "entity-identity@0.1.0",
          id: "room.demo.start",
          entityType: "scene",
          namespace: "demo",
          schemaVersion: 1
        });
      }
    ).toThrowError();
  });
});
