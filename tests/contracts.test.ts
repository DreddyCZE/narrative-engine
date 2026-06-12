import { describe, expect, it } from "vitest";

import { initialContracts } from "../packages/engine-contracts/src/index.js";

describe("initial contract inventory seed", () => {
  it("contains the required public contract placeholders", () => {
    expect(initialContracts.map((contract) => contract.id)).toEqual([
      "game-data-schema",
      "engine-state-api",
      "command-api",
      "event-api",
      "view-model-api",
      "save-schema",
      "plugin-api",
      "theme-api",
      "localization-api"
    ]);
  });
});

