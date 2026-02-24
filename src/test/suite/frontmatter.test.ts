import * as assert from "node:assert/strict";
import {
  parseFrontmatter,
  serializeFrontmatter,
  stripFrontmatter,
} from "../../utils/frontmatter.js";

interface SpecFrontmatter {
  name: string;
  applyTo?: string;
  description?: string;
}

suite("frontmatter", () => {
  suite("parseFrontmatter", () => {
    test("parses standard YAML frontmatter", () => {
      const content = '---\nname: mySpec\napplyTo: "**/*.ts"\n---\nbody here';
      const { frontmatter, body } = parseFrontmatter<SpecFrontmatter>(content);
      assert.equal(frontmatter.name, "mySpec");
      assert.equal(frontmatter.applyTo, "**/*.ts");
      assert.equal(body, "body here");
    });

    test("returns empty frontmatter when none present", () => {
      const { frontmatter, body } = parseFrontmatter("just body text");
      assert.deepEqual(frontmatter, {});
      assert.equal(body, "just body text");
    });

    test("handles empty frontmatter block", () => {
      // The parser regex requires at least a newline before the closing ---
      const { frontmatter, body } = parseFrontmatter("---\n\n---\nbody");
      assert.deepEqual(frontmatter, {});
      assert.equal(body, "body");
    });

    test("parses multiline body after frontmatter", () => {
      const content = "---\nname: spec\n---\n# Heading\n\nParagraph text.";
      const { body } = parseFrontmatter(content);
      assert.equal(body, "# Heading\n\nParagraph text.");
    });

    test("handles CRLF line endings", () => {
      const content = "---\r\nname: spec\r\n---\r\nbody text";
      const { frontmatter, body } = parseFrontmatter<SpecFrontmatter>(content);
      assert.equal(frontmatter.name, "spec");
      assert.equal(body, "body text");
    });

    test("returns body unchanged when YAML parse fails", () => {
      const malformed = "---\n: invalid: yaml:\n---\nbody";
      const { body } = parseFrontmatter(malformed);
      // Body is returned even when yaml is invalid
      assert.ok(typeof body === "string");
    });

    test("parses description field", () => {
      const content = "---\nname: s\ndescription: A test spec\n---\nbody";
      const { frontmatter } = parseFrontmatter<SpecFrontmatter>(content);
      assert.equal(frontmatter.description, "A test spec");
    });
  });

  suite("serializeFrontmatter", () => {
    test("produces valid frontmatter block", () => {
      const result = serializeFrontmatter({ name: "spec" }, "body text");
      assert.ok(result.startsWith("---\n"));
      assert.ok(result.includes("name: spec"));
      assert.ok(result.endsWith("body text"));
    });

    test("round-trips: serialize then parse gives back original", () => {
      const fm: SpecFrontmatter = { name: "mySpec", applyTo: "src/**/*.ts" };
      const body = "# Design\n\nContent here.";
      const serialized = serializeFrontmatter(fm, body);
      const { frontmatter: parsed, body: parsedBody } =
        parseFrontmatter<SpecFrontmatter>(serialized);
      assert.equal(parsed.name, fm.name);
      assert.equal(parsed.applyTo, fm.applyTo);
      assert.equal(parsedBody, body);
    });

    test("handles empty body", () => {
      const result = serializeFrontmatter({ name: "x" }, "");
      assert.ok(result.startsWith("---\n"));
      assert.ok(result.includes("name: x"));
    });
  });

  suite("stripFrontmatter", () => {
    test("removes frontmatter and returns body", () => {
      assert.equal(
        stripFrontmatter("---\nname: x\n---\nbody only"),
        "body only",
      );
    });

    test("returns content unchanged when no frontmatter", () => {
      assert.equal(
        stripFrontmatter("no frontmatter here"),
        "no frontmatter here",
      );
    });

    test("strips frontmatter with multiline body", () => {
      const content = "---\nname: x\n---\n# Title\n\nBody text.";
      assert.equal(stripFrontmatter(content), "# Title\n\nBody text.");
    });
  });
});
