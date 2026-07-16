import * as assert from "node:assert/strict";
import {
  describeLanguageModelSelection,
  normalizeLanguageModelSelector,
  pickLanguageModel,
} from "../../languageModelSelector.js";

type ModelStub = {
  id: string;
  vendor: string;
  family: string;
};

suite("languageModel", () => {
  suite("normalizeLanguageModelSelector", () => {
    test("returns undefined for missing or invalid values", () => {
      assert.equal(normalizeLanguageModelSelector(undefined), undefined);
      assert.equal(normalizeLanguageModelSelector(null), undefined);
      assert.equal(normalizeLanguageModelSelector("gpt-4o"), undefined);
      assert.equal(normalizeLanguageModelSelector([]), undefined);
    });

    test("keeps only trimmed string selector fields", () => {
      const selector = normalizeLanguageModelSelector({
        id: "  provider.model  ",
        vendor: "  custom  ",
        family: "  llama  ",
        version: "  1  ",
        ignored: true,
      });

      assert.deepEqual(selector, {
        id: "provider.model",
        vendor: "custom",
        family: "llama",
        version: "1",
      });
    });

    test("returns undefined when no usable selector fields remain", () => {
      const selector = normalizeLanguageModelSelector({
        id: "   ",
        vendor: 1,
      });

      assert.equal(selector, undefined);
    });
  });

  suite("pickLanguageModel", () => {
    const models: ModelStub[] = [
      { id: "custom.fast", vendor: "custom", family: "llama" },
      { id: "copilot.gpt-4o", vendor: "copilot", family: "gpt-4o" },
      { id: "custom.smart", vendor: "custom", family: "mixtral" },
    ];

    test("prefers configured model id when provided", () => {
      const selected = pickLanguageModel(models, { id: "custom.smart" });
      assert.equal(selected?.id, "custom.smart");
    });

    test("uses first configured match set when selector has no id", () => {
      const selected = pickLanguageModel(models, { vendor: "custom" });
      assert.equal(selected?.id, "custom.fast");
    });

    test("prefers Copilot gpt-4o by default when available", () => {
      const selected = pickLanguageModel(models);
      assert.equal(selected?.id, "copilot.gpt-4o");
    });

    test("falls back to the first available model when Copilot gpt-4o is absent", () => {
      const selected = pickLanguageModel([
        { id: "custom.fast", vendor: "custom", family: "llama" },
        { id: "custom.smart", vendor: "custom", family: "mixtral" },
      ]);

      assert.equal(selected?.id, "custom.fast");
    });

    test("returns undefined when no models are available", () => {
      assert.equal(pickLanguageModel([]), undefined);
    });
  });

  suite("describeLanguageModelSelection", () => {
    test("describes auto-selection when selector is empty", () => {
      assert.equal(
        describeLanguageModelSelection(undefined),
        "an available VS Code chat model",
      );
    });

    test("describes configured selector fields", () => {
      assert.equal(
        describeLanguageModelSelection({
          vendor: "custom",
          family: "llama",
          version: "1.0",
        }),
        'a VS Code chat model matching vendor "custom", family "llama", version "1.0"',
      );
    });
  });
});
