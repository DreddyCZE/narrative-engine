export type RuntimeInvalidCase = {
  name: string;
  value: unknown;
};

export const runtimeInvalidCases: readonly RuntimeInvalidCase[] = [
  {
    name: "function",
    value: () => true
  },
  {
    name: "date",
    value: new Date("2026-06-13T00:00:00.000Z")
  },
  {
    name: "map",
    value: new Map([["key", "value"]])
  },
  {
    name: "set",
    value: new Set(["value"])
  },
  {
    name: "nan",
    value: Number.NaN
  },
  {
    name: "infinity",
    value: Number.POSITIVE_INFINITY
  },
  {
    name: "cyclic",
    value: (() => {
      const record: Record<string, unknown> = { name: "cycle" };
      record.self = record;
      return record;
    })()
  },
  {
    name: "forbidden-nested-key",
    value: {
      nested: {
        constructor: "nope"
      }
    }
  }
];
