import * as vscode from 'vscode';
import { generateFullSpec, generateSpecContent } from './specGenerator.js';
import { loadSpec } from '../specManager.js';
import { readTextFile, fileExists, requirementsUri, designUri, tasksUri } from '../utils/fileSystem.js';
import { stripFrontmatter } from '../utils/frontmatter.js';

interface ParsedCommand {
  action: 'create' | 'regenerate' | 'help';
  specName?: string;
  fileGlob?: string;
  section?: 'requirements' | 'design' | 'tasks';
}

function parseCommand(prompt: string): ParsedCommand {
  // @spec create <name> for <glob>
  const createMatch = prompt.match(/^create\s+["']?([^"']+?)["']?\s+(?:for\s+)?([^\s]+)\s*$/i);
  if (createMatch) {
    return { action: 'create', specName: createMatch[1].trim(), fileGlob: createMatch[2].trim() };
  }

  // @spec create <name>
  const createSimple = prompt.match(/^create\s+["']?([^"']+?)["']?\s*$/i);
  if (createSimple) {
    return { action: 'create', specName: createSimple[1].trim() };
  }

  // @spec regenerate <spec> requirements|design|tasks
  const regenMatch = prompt.match(/^regenerate\s+(\S+)\s+(requirements|design|tasks)\s*$/i);
  if (regenMatch) {
    return {
      action: 'regenerate',
      specName: regenMatch[1].trim(),
      section: regenMatch[2].toLowerCase() as 'requirements' | 'design' | 'tasks',
    };
  }

  return { action: 'help' };
}

export function registerChatParticipant(
  context: vscode.ExtensionContext
): void {
  const participant = vscode.chat.createChatParticipant(
    'copilot-specs.spec',
    async (request, _chatContext, stream, _token) => {
      const parsed = parseCommand(request.prompt);

      if (parsed.action === 'help') {
        stream.markdown(
          `## Copilot Specs\n\n` +
          `I help you create and manage feature specs with requirements, design docs, and task lists.\n\n` +
          `**Commands:**\n\n` +
          `- \`@spec create <name> for <glob>\` — Create a new spec with Copilot-generated content\n` +
          `  *Example: \`@spec create auth for src/auth/**\`*\n\n` +
          `- \`@spec create <name>\` — Create a spec (you'll be prompted for the file glob)\n\n` +
          `- \`@spec regenerate <spec-name> requirements|design|tasks\` — Regenerate a section\n`
        );
        return;
      }

      if (parsed.action === 'create') {
        const fileGlob = parsed.fileGlob ?? `src/${parsed.specName!.toLowerCase().replace(/\s+/g, '-')}/**`;

        if (!parsed.fileGlob) {
          stream.markdown(`Creating spec **${parsed.specName}**...\n\n`);
          stream.markdown(`Using file glob: \`${fileGlob}\` (you can change this in the generated files)\n\n`);
        }

        await generateFullSpec(parsed.specName!, fileGlob, stream);
        return;
      }

      if (parsed.action === 'regenerate' && parsed.specName && parsed.section) {
        const spec = await loadSpec(parsed.specName);
        if (!spec) {
          stream.markdown(`> Spec **${parsed.specName}** not found. Use \`@spec create ${parsed.specName}\` to create it.\n`);
          return;
        }

        stream.markdown(`## Regenerating **${parsed.section}** for spec: ${parsed.specName}\n\n`);

        // Load existing context from other sections
        let existingContext = '';
        try {
          const rUri = requirementsUri(parsed.specName);
          const dUri = designUri(parsed.specName);
          if (rUri && await fileExists(rUri)) {
            existingContext += `Requirements:\n${stripFrontmatter(await readTextFile(rUri))}\n\n`;
          }
          if (dUri && await fileExists(dUri)) {
            existingContext += `Design:\n${stripFrontmatter(await readTextFile(dUri))}\n\n`;
          }
        } catch {
          // Use empty context
        }

        const newContent = await generateSpecContent(
          parsed.specName, spec.fileGlob, existingContext, parsed.section, stream
        );

        if (newContent) {
          const { writeTextFile } = await import('../utils/fileSystem.js');
          const { serializeFrontmatter } = await import('../utils/frontmatter.js');
          
          let uri: vscode.Uri | undefined;
          let fm: Record<string, string> = {};

          if (parsed.section === 'requirements') {
            uri = requirementsUri(parsed.specName);
            fm = { name: `${parsed.specName} Requirements`, applyTo: spec.fileGlob };
          } else if (parsed.section === 'design') {
            uri = designUri(parsed.specName);
            fm = { name: `${parsed.specName} Design`, applyTo: spec.fileGlob };
          } else {
            uri = tasksUri(parsed.specName);
          }

          if (uri) {
            const fileContent = parsed.section === 'tasks'
              ? newContent
              : serializeFrontmatter(fm, newContent);
            await writeTextFile(uri, fileContent);
            stream.markdown(`\n\n✅ ${parsed.section} file updated.\n`);
            stream.button({ command: 'copilot-specs.openSpecPanel', arguments: [parsed.specName], title: 'Open Spec Panel' });
          }
        }

        return;
      }
    }
  );

  participant.iconPath = new vscode.ThemeIcon('tasklist');
  context.subscriptions.push(participant);
}
