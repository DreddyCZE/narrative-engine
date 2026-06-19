import { assertJsonSafe, type JsonValue } from "./json-safe.js";

function stringifyCanonicalValue(value: JsonValue): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }

  if (typeof value === "number") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    const arrayValue = value as readonly JsonValue[];
    return `[${arrayValue.map((entry) => stringifyCanonicalValue(entry)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, JsonValue>) as Array<
    readonly [string, JsonValue]
  >;
  entries.sort(([left], [right]) => left.localeCompare(right));

  return `{${entries
    .map(([key, entry]) => `${JSON.stringify(key)}:${stringifyCanonicalValue(entry)}`)
    .join(",")}}`;
}

export function canonicalizeJson(value: JsonValue): string {
  assertJsonSafe(value);
  return stringifyCanonicalValue(value);
}
