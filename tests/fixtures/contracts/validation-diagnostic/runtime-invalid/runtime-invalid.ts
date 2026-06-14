const cyclic: Record<string, unknown> = {};
cyclic.self = cyclic;

export const runtimeInvalidCases = [
  { name: "function", value: () => true },
  { name: "date", value: new Date("2026-06-13T00:00:00Z") },
  { name: "map", value: new Map([["key", "value"]]) },
  { name: "set", value: new Set(["value"]) },
  { name: "nan", value: Number.NaN },
  { name: "infinity", value: Number.POSITIVE_INFINITY },
  { name: "cyclic", value: cyclic },
  { name: "forbidden-nested-key", value: JSON.parse('{"payload":{"__proto__":{"polluted":true}}}') as unknown }
] as const;
