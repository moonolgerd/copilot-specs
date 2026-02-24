import * as yaml from 'js-yaml';

/**
 * Parses YAML frontmatter from a Markdown string.
 * Returns { frontmatter, body } where body is the content after the frontmatter block.
 */
export function parseFrontmatter<T extends object>(content: string): { frontmatter: T; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {} as T, body: content };
  }
  try {
    const frontmatter = (yaml.load(match[1]) ?? {}) as T;
    return { frontmatter, body: match[2] };
  } catch {
    return { frontmatter: {} as T, body: content };
  }
}

/**
 * Serializes a frontmatter object and body back into a Markdown string.
 */
export function serializeFrontmatter<T extends object>(frontmatter: T, body: string): string {
  const yamlStr = yaml.dump(frontmatter, { lineWidth: -1 }).trimEnd();
  return `---\n${yamlStr}\n---\n${body}`;
}

/**
 * Strips the frontmatter block from Markdown content, returning only the body.
 */
export function stripFrontmatter(content: string): string {
  const { body } = parseFrontmatter(content);
  return body;
}
