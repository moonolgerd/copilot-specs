import * as assert from "node:assert/strict";
import {
  describeLanguageModelSelection,
  matchesLanguageModelSelector,
  normalizeLanguageModelSelector,
  pickLanguageModel,
} from "../../languageModelSelector.js";

type ModelStub = {
  id: string;
  vendor: string;
  family: string;
  version?: string;
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
      {
        id: "custom.fast",
        vendor: "custom",
        family: "llama",
        version: "1.0",
      },
      {
        id: "copilot.gpt-4o",
        vendor: "copilot",
        family: "gpt-4o",
        version: "1.0",
      },
      {
        id: "custom.smart",
        vendor: "custom",
        family: "mixtral",
        version: "2.0",
      },
    ];

    test("prefers configured model id when provided", () => {
      const selected = pickLanguageModel(models, { id: "custom.smart" });
      assert.equal(selected?.id, "custom.smart");
    });

    test("matches configured selector fields when id is not provided", () => {
      const selected = pickLanguageModel(models, {
        vendor: "custom",
        family: "mixtral",
        version: "2.0",
      });
      assert.equal(selected?.id, "custom.smart");
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

    test("returns undefined when the configured selector does not match", () => {
      assert.equal(
        pickLanguageModel(models, { id: "missing", family: "gpt-4o" }),
        undefined,
      );
    });
  });

  suite("matchesLanguageModelSelector", () => {
    test("requires every provided selector field to match", () => {
      assert.equal(
        matchesLanguageModelSelector(
          {
            id: "custom.fast",
            vendor: "custom",
            family: "llama",
            version: "1.0",
          },
          {
            vendor: "custom",
            family: "llama",
            version: "1.0",
          },
        ),
        true,
      );
    });

    test("returns false when any selector field differs", () => {
      assert.equal(
        matchesLanguageModelSelector(
          {
            id: "custom.fast",
            vendor: "custom",
            family: "llama",
            version: "1.0",
          },
          {
            vendor: "custom",
            family: "mixtral",
          },
        ),
        false,
      );
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
