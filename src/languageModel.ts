import * as vscode from "vscode";
import {
  ConfiguredLanguageModelSelector,
  describeLanguageModelSelection as formatLanguageModelSelection,
  normalizeLanguageModelSelector,
  pickLanguageModel,
} from "./languageModelSelector.js";

const LANGUAGE_MODEL_SELECTOR_SETTING = "languageModelSelector";

export function getConfiguredLanguageModelSelector():
  | ConfiguredLanguageModelSelector
  | undefined {
  const configured = vscode.workspace
    .getConfiguration("copilot-specs")
    .get<unknown>(LANGUAGE_MODEL_SELECTOR_SETTING);
  return normalizeLanguageModelSelector(configured);
}

export async function selectLanguageModel():
  Promise<vscode.LanguageModelChat | undefined> {
  const selector = getConfiguredLanguageModelSelector();
  if (selector) {
    const configuredModels = await vscode.lm.selectChatModels(selector);
    const configuredModel = pickLanguageModel(configuredModels, selector);
    if (configuredModel) {
      return configuredModel;
    }
  }

  const models = await vscode.lm.selectChatModels();
  return pickLanguageModel(models);
}

export function describeLanguageModelSelection(): string {
  return formatLanguageModelSelection(getConfiguredLanguageModelSelector());
}
