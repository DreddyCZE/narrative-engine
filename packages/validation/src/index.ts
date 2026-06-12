export type ValidationResult = {
  readonly ok: boolean;
  readonly errors: readonly string[];
};

export const pass = (): ValidationResult => ({ ok: true, errors: [] });

