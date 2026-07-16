type SelectorKey = "id" | "vendor" | "family" | "version";

export type ConfiguredLanguageModelSelector = Partial<
  Record<SelectorKey, string>
>;

export type LanguageModelIdentity = {
  id: string;
  vendor: string;
  family: string;
};

export function normalizeLanguageModelSelector(
  value: unknown,
): ConfiguredLanguageModelSelector | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const raw = value as Record<string, unknown>;
  const selector: ConfiguredLanguageModelSelector = {};

  for (const key of ["id", "vendor", "family", "version"] as const) {
    const candidate = raw[key];
    if (typeof candidate !== "string") {
      continue;
    }

    const trimmed = candidate.trim();
    if (trimmed) {
      selector[key] = trimmed;
    }
  }

  return Object.keys(selector).length > 0 ? selector : undefined;
}

export function pickLanguageModel<T extends LanguageModelIdentity>(
  models: readonly T[],
  selector?: ConfiguredLanguageModelSelector,
): T | undefined {
  if (models.length === 0) {
    return undefined;
  }

  if (selector) {
    if (selector.id) {
      return models.find((model) => model.id === selector.id) ?? models[0];
    }

    return models[0];
  }

  return (
    models.find(
      (model) => model.vendor === "copilot" && model.family === "gpt-4o",
    ) ?? models[0]
  );
}

export function describeLanguageModelSelection(
  selector?: ConfiguredLanguageModelSelector,
): string {
  if (!selector) {
    return "an available VS Code chat model";
  }

  const parts: string[] = [];
  if (selector.id) {
    parts.push(`id "${selector.id}"`);
  }
  if (selector.vendor) {
    parts.push(`vendor "${selector.vendor}"`);
  }
  if (selector.family) {
    parts.push(`family "${selector.family}"`);
  }
  if (selector.version) {
    parts.push(`version "${selector.version}"`);
  }

  return parts.length > 0
    ? `a VS Code chat model matching ${parts.join(", ")}`
    : "an available VS Code chat model";
}
