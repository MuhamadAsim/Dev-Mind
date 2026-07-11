import { listConnectedRepositories, getRepository } from '../repos/repositoryService';
import { updateSessionRepository } from './sessionService';
import type { IWhatsappSession } from '../db/models/WhatsappSession';

export async function handleCommand(
  messageBody: string,
  session: IWhatsappSession
): Promise<string> {
  const parts = messageBody.trim().split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);

  switch (command) {
    case '/repos':
      return await handleReposCommand();
    case '/repo':
      return await handleRepoSelectCommand(args.join(' '), session);
    case '/current':
      return await handleCurrentCommand(session);
    case '/help':
      return getHelpText();
    default:
      return `Unknown command: *${command}*\nType /help to see all available commands.`;
  }
}

function getHelpText(): string {
  return `*Available Commands:*
- \`/repos\` — List all connected repositories
- \`/repo <name>\` — Switch the active repository for this session
- \`/current\` — Show the active repository for this session
- \`/help\` — Show this help menu`;
}

async function handleReposCommand(): Promise<string> {
  try {
    const repos = await listConnectedRepositories();
    if (repos.length === 0) {
      return 'No repositories connected. Connect a repository via the Web UI repository panel.';
    }

    const repoList = repos.map((r) => `- *${r.name}* (${r.type})`).join('\n');
    return `*Connected Repositories:*\n${repoList}\n\nTo select a repository, run \`/repo <name>\`.`;
  } catch (err: any) {
    return `Failed to list repositories: ${err.message || String(err)}`;
  }
}

async function handleRepoSelectCommand(
  nameQuery: string,
  session: IWhatsappSession
): Promise<string> {
  const query = nameQuery.trim();
  if (!query) {
    return 'Please specify a repository name, e.g. \`/repo my-project\`.';
  }

  try {
    const repos = await listConnectedRepositories();
    const matches = repos.filter((r) =>
      r.name.toLowerCase().includes(query.toLowerCase())
    );

    if (matches.length === 0) {
      return `No repository found matching: *${query}*\nRun \`/repos\` to see connected repositories.`;
    }

    if (matches.length > 1) {
      // Check for an exact name match first
      const exactMatch = matches.find((r) => r.name.toLowerCase() === query.toLowerCase());
      if (exactMatch) {
        await updateSessionRepository(session.phoneNumber, exactMatch.id);
        return `Active repository switched to *${exactMatch.name}*.`;
      }

      const matchNames = matches.map((r) => `- *${r.name}*`).join('\n');
      return `Multiple repositories matched "${query}":\n${matchNames}\n\nPlease be more specific.`;
    }

    const repo = matches[0];
    await updateSessionRepository(session.phoneNumber, repo.id);
    return `Active repository switched to *${repo.name}*.`;
  } catch (err: any) {
    return `Failed to switch repository: ${err.message || String(err)}`;
  }
}

async function handleCurrentCommand(session: IWhatsappSession): Promise<string> {
  if (!session.activeRepositoryId) {
    return 'No repository selected. Run \`/repos\` and \`/repo <name>\` to enable codebase context.';
  }

  try {
    const repo = await getRepository(session.activeRepositoryId);
    if (!repo) {
      return 'Selected repository could not be found. It may have been disconnected. Run \`/repos\` to see connected repositories.';
    }
    return `Current active repository is *${repo.name}* (${repo.type}).`;
  } catch (err: any) {
    return `Failed to retrieve current repository: ${err.message || String(err)}`;
  }
}
