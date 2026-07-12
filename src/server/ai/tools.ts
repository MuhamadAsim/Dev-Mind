import { z } from 'zod';
import { tool } from 'ai';
import {
  readFile,
  listDirectory,
  getRepositoryMetadata,
  getCurrentBranch,
  getGitStatus,
  listRepositoryFiles,
  searchFiles,
  listAllConnectedRepos,
  getRepoById,
} from '../repos/repositoryTools';
import type { ChatSession } from './types';
import { contextService } from '../context/contextService';
import { McpGraphClient } from '../context/graphClient';
import { connectDB } from '../db/mongoose';
import { KnowledgeBaseModel, KbDocumentModel } from '../db/models';
import {
  listKnowledgeBases,
  createKnowledgeBase,
  renameKnowledgeBase,
  deleteKnowledgeBase,
} from '../knowledge/knowledgeBaseService';
import {
  listDocuments,
  deleteDocument,
  getDocumentContent,
} from '../knowledge/kbDocumentService';
import mongoose from 'mongoose';

const NO_REPO_ERROR = {
  error:
    'No repository is currently active. Call listConnectedRepos to see what\'s connected, then selectRepo to activate one before reading files.',
};

async function findRepoByName(nameQuery: string) {
  const repos = await listAllConnectedRepos();
  const lower = nameQuery.trim().toLowerCase();
  return repos.find((r) => r.name.toLowerCase().includes(lower)) ?? null;
}

export function createRepositoryTools(session: ChatSession) {
  return {
    // ── Repo management ──

    listConnectedRepos: tool({
      description:
        'List every repository the user has connected (GitHub and local). Call this whenever the user asks about "the repo" / "my project" but no repository is currently active.',
      inputSchema: z.object({}),
      execute: async () => {
        const repos = await listAllConnectedRepos();
        return {
          repos: repos.map((r) => ({ id: r.id, name: r.name, type: r.type })),
          activeRepoId: session.activeRepoId,
        };
      },
    }),

    selectRepo: tool({
      description:
        'Activate a connected repository by name so file/read/search/write tools operate on it. If you don\'t know the exact name, call listConnectedRepos first.',
      inputSchema: z.object({
        repoName: z.string().describe('Name (or partial name) of the repo to activate.'),
      }),
      execute: async ({ repoName }) => {
        const repo = await findRepoByName(repoName);
        if (!repo) {
          return { error: `No connected repository matches "${repoName}". Call listConnectedRepos to see available options.` };
        }
        session.activeRepoId = repo.id;
        return { success: true, activeRepoId: repo.id, name: repo.name };
      },
    }),

    // NOTE: This is a SESSION-ONLY deactivation. It clears which repo the
    // AI is currently pointed at for this conversation — it does NOT
    // delete the repository connection. The repo stays in the user's
    // connected list and can be reselected later via selectRepo, or from
    // the Repository panel in the UI. Permanent removal (deleting the DB
    // record) is only ever done through the trash-icon button in
    // RepositoryPanel.tsx — never from chat.
    disconnectRepo: tool({
      description:
        'Deactivate the currently active repository for this conversation, so file tools no longer target it. This does NOT delete or remove the repository connection — it stays available and can be reselected later with selectRepo, or from the Repository panel in the app. Only use this when the user asks to "stop working on" / "unset" / "disconnect from" the current repo in this chat.',
      inputSchema: z.object({}),
      execute: async () => {
        if (!session.activeRepoId) {
          return { error: 'No repository is currently active in this conversation.' };
        }

        const repo = await getRepoById(session.activeRepoId);
        const deactivatedName = repo?.name ?? 'the active repository';
        session.activeRepoId = null;

        return {
          success: true,
          deactivatedName,
          note: 'The repository connection itself was NOT removed — it is still available and can be reselected.',
        };
      },
    }),

    // ── Repo content — read ──

    readFile: tool({
      description: 'Read the text content of a file from the active repository.',
      inputSchema: z.object({
        filePath: z.string().describe('Path relative to the repository root.'),
      }),
      execute: async ({ filePath }) => {
        if (!session.activeRepoId) return NO_REPO_ERROR;
        try {
          return { content: await readFile(session.activeRepoId, filePath) };
        } catch (error: any) {
          return { error: error.message || String(error) };
        }
      },
    }),

    listDirectory: tool({
      description: 'List files and subdirectories in a directory of the active repository.',
      inputSchema: z.object({
        dirPath: z.string().describe('Path relative to repo root. Use "" for root.'),
      }),
      execute: async ({ dirPath }) => {
        if (!session.activeRepoId) return NO_REPO_ERROR;
        try {
          return { files: await listDirectory(session.activeRepoId, dirPath) };
        } catch (error: any) {
          return { error: error.message || String(error) };
        }
      },
    }),

    searchFiles: tool({
      description: 'Search for files in the active repository by name or path.',
      inputSchema: z.object({
        query: z.string().describe('Search query, e.g. "README" or "ts".'),
      }),
      execute: async ({ query }) => {
        if (!session.activeRepoId) return NO_REPO_ERROR;
        try {
          return { files: await searchFiles(session.activeRepoId, query) };
        } catch (error: any) {
          return { error: error.message || String(error) };
        }
      },
    }),

    getRepositoryMetadata: tool({
      description: 'Get metadata of the active repository (description, stars, branch, language).',
      inputSchema: z.object({}),
      execute: async () => {
        if (!session.activeRepoId) return NO_REPO_ERROR;
        try {
          return { metadata: await getRepositoryMetadata(session.activeRepoId) };
        } catch (error: any) {
          return { error: error.message || String(error) };
        }
      },
    }),

    getCurrentBranch: tool({
      description: 'Get the active git branch name of the active repository.',
      inputSchema: z.object({}),
      execute: async () => {
        if (!session.activeRepoId) return NO_REPO_ERROR;
        try {
          return { branch: await getCurrentBranch(session.activeRepoId) };
        } catch (error: any) {
          return { error: error.message || String(error) };
        }
      },
    }),

    getGitStatus: tool({
      description: 'Get the git status (clean/modified/synced) of the active repository.',
      inputSchema: z.object({}),
      execute: async () => {
        if (!session.activeRepoId) return NO_REPO_ERROR;
        try {
          return { status: await getGitStatus(session.activeRepoId) };
        } catch (error: any) {
          return { error: error.message || String(error) };
        }
      },
    }),

    listRepositoryFiles: tool({
      description: 'List all files across the entire active repository, recursively.',
      inputSchema: z.object({}),
      execute: async () => {
        if (!session.activeRepoId) return NO_REPO_ERROR;
        try {
          return { files: await listRepositoryFiles(session.activeRepoId) };
        } catch (error: any) {
          return { error: error.message || String(error) };
        }
      },
    }),

    // ── Repo content — write (PROPOSE ONLY — never writes directly) ──

    proposeFileWrite: tool({
      description:
        'Propose writing content to a file (creating or overwriting it) in the active repository. This does NOT write anything — it only stages a proposal. You MUST show the user the exact file path and content, and explicitly ask them to reply "yes" to confirm or "no" to cancel, before this takes effect. Never tell the user the file has been written — it has not, until they confirm.',
      inputSchema: z.object({
        filePath: z.string().describe('Path relative to repo root, e.g. "src/utils/helpers.ts".'),
        content: z.string().describe('Full file content to write.'),
        commitMessage: z
          .string()
          .optional()
          .describe('Git commit message. Only used for GitHub repos; ignored for local repos.'),
      }),
      execute: async ({ filePath, content, commitMessage }) => {
        console.log('[proposeFileWrite] raw content:', JSON.stringify(content).slice(0, 200));

        if (!session.activeRepoId) return NO_REPO_ERROR;
        const repo = await getRepoById(session.activeRepoId);
        if (!repo) return { error: 'Active repository no longer exists.' };

        session.pendingWrite = {
          action: 'writeFile',
          repoId: session.activeRepoId,
          repoName: repo.name,
          path: filePath,
          content,
          commitMessage,
          proposedAt: new Date().toISOString(),
        };

        return {
          proposed: true,
          filePath,
          repoName: repo.name,
          preview: content.length > 500 ? content.slice(0, 500) + '\n…(truncated)' : content,
          instructions:
            'Show this file path and content to the user now, and ask them to reply "yes" to confirm or "no" to cancel. Do not assume approval and do not say it has been written.',
        };
      },
    }),

    proposeCreateDirectory: tool({
      description:
        'Propose creating a new directory in the active repository. This does NOT create anything — the user must confirm with "yes" in their next message.',
      inputSchema: z.object({
        dirPath: z.string().describe('Directory path relative to repo root, e.g. "src/components/widgets".'),
      }),
      execute: async ({ dirPath }) => {
        if (!session.activeRepoId) return NO_REPO_ERROR;
        const repo = await getRepoById(session.activeRepoId);
        if (!repo) return { error: 'Active repository no longer exists.' };

        session.pendingWrite = {
          action: 'createDirectory',
          repoId: session.activeRepoId,
          repoName: repo.name,
          path: dirPath,
          proposedAt: new Date().toISOString(),
        };

        return {
          proposed: true,
          dirPath,
          repoName: repo.name,
          instructions: 'Ask the user to confirm ("yes") or cancel ("no") before this directory is actually created.',
        };
      },
    }),
  };
}

function jsonSchemaToZod(schema: any): z.ZodTypeAny {
  if (!schema) return z.object({});

  if (schema.type === 'object') {
    const shape: Record<string, z.ZodTypeAny> = {};
    const properties = schema.properties || {};
    const required = schema.required || [];

    for (const key of Object.keys(properties)) {
      const prop = properties[key];
      let fieldSchema: z.ZodTypeAny;

      if (prop.type === 'string') {
        fieldSchema = z.string();
      } else if (prop.type === 'number' || prop.type === 'integer') {
        fieldSchema = z.number();
      } else if (prop.type === 'boolean') {
        fieldSchema = z.boolean();
      } else if (prop.type === 'array') {
        const itemsSchema = prop.items ? jsonSchemaToZod(prop.items) : z.any();
        fieldSchema = z.array(itemsSchema);
      } else {
        fieldSchema = z.any();
      }

      if (prop.description) {
        fieldSchema = fieldSchema.describe(prop.description);
      }

      if (!required.includes(key)) {
        fieldSchema = fieldSchema.optional();
      }

      shape[key] = fieldSchema;
    }

    return z.object(shape);
  }

  return z.any();
}

export async function createContextTools(session: ChatSession): Promise<Record<string, any>> {
  if (!session.activeRepoId) return {};

  const isSupported = await contextService.supportsGraphify(session.activeRepoId);
  if (!isSupported) return {};

  // Check if Graphify is indexed and online
  const statusResult = await contextService.getGraph().getGraphStatus(session.activeRepoId);
  if (statusResult.status !== 'indexed') {
    console.log(`[createContextTools] Graphify is not available for active repo: status is ${statusResult.status} (${statusResult.message || ''})`);
    return {};
  }

  try {
    const client = new McpGraphClient();
    await client.connect();

    const toolsResult = await client.listTools();
    await client.close();

    const mcpTools = toolsResult.tools || [];
    const registeredTools: Record<string, any> = {};

    for (const mcpTool of mcpTools) {
      registeredTools[mcpTool.name] = tool({
        description: mcpTool.description || `Exposed by Graphify MCP server.`,
        inputSchema: jsonSchemaToZod(mcpTool.inputSchema),
        execute: async (args: any) => {
          const runClient = new McpGraphClient();
          try {
            await runClient.connect();
            const res = await runClient.callTool(mcpTool.name, args as Record<string, unknown>);
            return {
              result: res.content?.[0]?.text || '',
            };
          } catch (err: any) {
            return {
              error: err.message || String(err),
            };
          } finally {
            await runClient.close();
          }
        },
      });
    }

    return registeredTools;
  } catch (error) {
    console.warn('[createContextTools] Failed to load tools from Graphify MCP server:', error);
    return {};
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

async function resolveKnowledgeBaseId(nameOrId: string): Promise<string | null> {
  await connectDB();
  if (mongoose.Types.ObjectId.isValid(nameOrId)) {
    const exists = await KnowledgeBaseModel.findById(nameOrId).lean();
    if (exists) return exists._id.toString();
  }
  const exactMatch = await KnowledgeBaseModel.findOne({
    name: { $regex: new RegExp('^' + escapeRegex(nameOrId) + '$', 'i') },
  }).lean();
  if (exactMatch) return exactMatch._id.toString();

  const partialMatch = await KnowledgeBaseModel.findOne({
    name: { $regex: new RegExp(escapeRegex(nameOrId), 'i') },
  }).lean();
  if (partialMatch) return partialMatch._id.toString();

  return null;
}

async function resolveDocumentId(kbId: string, nameOrId: string): Promise<string | null> {
  await connectDB();
  const kbObjectId = new mongoose.Types.ObjectId(kbId);
  if (mongoose.Types.ObjectId.isValid(nameOrId)) {
    const exists = await KbDocumentModel.findOne({ _id: nameOrId, knowledgeBaseId: kbObjectId }).lean();
    if (exists) return exists._id.toString();
  }
  const exactMatch = await KbDocumentModel.findOne({
    knowledgeBaseId: kbObjectId,
    filename: { $regex: new RegExp('^' + escapeRegex(nameOrId) + '$', 'i') },
  }).lean();
  if (exactMatch) return exactMatch._id.toString();

  const partialMatch = await KbDocumentModel.findOne({
    knowledgeBaseId: kbObjectId,
    filename: { $regex: new RegExp(escapeRegex(nameOrId), 'i') },
  }).lean();
  if (partialMatch) return partialMatch._id.toString();

  return null;
}

export function createKnowledgeTools(session: ChatSession) {
  return {
    listKnowledgeBases: tool({
      description: 'List all existing Knowledge Bases.',
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const kbs = await listKnowledgeBases();
          return { success: true, knowledgeBases: kbs };
        } catch (err: any) {
          return { error: err.message || 'Failed to list knowledge bases.' };
        }
      },
    }),

    createKnowledgeBase: tool({
      description: 'Create a new Knowledge Base.',
      inputSchema: z.object({
        name: z.string().describe('The name of the Knowledge Base (e.g. "University").'),
        description: z.string().optional().describe('An optional brief description of the Knowledge Base.'),
      }),
      execute: async ({ name, description }) => {
        try {
          const kb = await createKnowledgeBase(name, description);
          return { success: true, knowledgeBase: kb };
        } catch (err: any) {
          return { error: err.message || 'Failed to create knowledge base.' };
        }
      },
    }),

    renameKnowledgeBase: tool({
      description: 'Rename an existing Knowledge Base.',
      inputSchema: z.object({
        nameOrId: z.string().describe('The name or MongoDB ID of the Knowledge Base to rename.'),
        newName: z.string().describe('The new name for the Knowledge Base.'),
      }),
      execute: async ({ nameOrId, newName }) => {
        try {
          const kbId = await resolveKnowledgeBaseId(nameOrId);
          if (!kbId) {
            return { error: `No knowledge base matches "${nameOrId}".` };
          }
          const updated = await renameKnowledgeBase(kbId, newName);
          if (!updated) {
            return { error: `Failed to rename knowledge base with ID ${kbId}.` };
          }
          return { success: true, knowledgeBase: updated };
        } catch (err: any) {
          return { error: err.message || 'Failed to rename knowledge base.' };
        }
      },
    }),

    deleteKnowledgeBase: tool({
      description: 'Delete a Knowledge Base and all its documents and chunks permanently.',
      inputSchema: z.object({
        nameOrId: z.string().describe('The name or MongoDB ID of the Knowledge Base to delete.'),
      }),
      execute: async ({ nameOrId }) => {
        try {
          const kbId = await resolveKnowledgeBaseId(nameOrId);
          if (!kbId) {
            return { error: `No knowledge base matches "${nameOrId}".` };
          }
          const success = await deleteKnowledgeBase(kbId);
          if (!success) {
            return { error: `Failed to delete knowledge base with ID ${kbId}.` };
          }
          return { success: true, message: `Knowledge base "${nameOrId}" and its documents have been deleted.` };
        } catch (err: any) {
          return { error: err.message || 'Failed to delete knowledge base.' };
        }
      },
    }),

    listDocuments: tool({
      description: 'List all documents uploaded to a specific Knowledge Base.',
      inputSchema: z.object({
        knowledgeBaseNameOrId: z.string().describe('The name or MongoDB ID of the parent Knowledge Base.'),
      }),
      execute: async ({ knowledgeBaseNameOrId }) => {
        try {
          const kbId = await resolveKnowledgeBaseId(knowledgeBaseNameOrId);
          if (!kbId) {
            return { error: `No knowledge base matches "${knowledgeBaseNameOrId}".` };
          }
          const docs = await listDocuments(kbId);
          return { success: true, documents: docs };
        } catch (err: any) {
          return { error: err.message || 'Failed to list documents.' };
        }
      },
    }),
    getDocumentContent: tool({
      description:
        'Get the full extracted text content of a document in a Knowledge Base, so you can answer questions about what it contains. Use this — NOT readFile — for any document that came from listDocuments. readFile only works on connected code repositories, not Knowledge Base documents, and will fail or (worse) silently read the wrong file.',
      inputSchema: z.object({
        nameOrId: z.string().describe('The filename (e.g. "resume.pdf") or MongoDB ID of the document.'),
        knowledgeBaseNameOrId: z.string().describe('The name or MongoDB ID of the parent Knowledge Base.'),
      }),
      execute: async ({ nameOrId, knowledgeBaseNameOrId }) => {
        try {
          const kbId = await resolveKnowledgeBaseId(knowledgeBaseNameOrId);
          if (!kbId) {
            return { error: `No knowledge base matches "${knowledgeBaseNameOrId}".` };
          }
          const docId = await resolveDocumentId(kbId, nameOrId);
          if (!docId) {
            return { error: `No document matches "${nameOrId}" in the knowledge base "${knowledgeBaseNameOrId}".` };
          }
          const content = await getDocumentContent(docId);
          return { success: true, content };
        } catch (err: any) {
          return { error: err.message || 'Failed to get document content.' };
        }
      },
    }),

    deleteDocument: tool({
      description: 'Delete a specific document and its text chunks from a Knowledge Base.',
      inputSchema: z.object({
        nameOrId: z.string().describe('The filename (e.g. "resume.pdf") or MongoDB ID of the document to delete.'),
        knowledgeBaseNameOrId: z.string().describe('The name or MongoDB ID of the parent Knowledge Base.'),
      }),
      execute: async ({ nameOrId, knowledgeBaseNameOrId }) => {
        try {
          const kbId = await resolveKnowledgeBaseId(knowledgeBaseNameOrId);
          if (!kbId) {
            return { error: `No knowledge base matches "${knowledgeBaseNameOrId}".` };
          }
          const docId = await resolveDocumentId(kbId, nameOrId);
          if (!docId) {
            return { error: `No document matches "${nameOrId}" in the knowledge base "${knowledgeBaseNameOrId}".` };
          }
          const success = await deleteDocument(docId);
          if (!success) {
            return { error: `Failed to delete document with ID ${docId}.` };
          }
          return { success: true, message: `Document "${nameOrId}" has been deleted.` };
        } catch (err: any) {
          return { error: err.message || 'Failed to delete document.' };
        }
      },
    }),
  };
}