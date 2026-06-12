export type StateVersion = {
  readonly schema: "engine-state";
  readonly version: 0;
};

export const initialStateVersion: StateVersion = {
  schema: "engine-state",
  version: 0
};

