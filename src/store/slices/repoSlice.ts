// ============================================================
// Repository Slice — manages connected and active repositories
// ============================================================
import { StateCreator } from 'zustand';
import type { RootStore } from '../index';
import type { RepoFile, RepositoryMetadata } from '@/server/repos/types';

export interface Repo {
  id: string;
  name: string;
  type: 'github' | 'local';
  config: Record<string, string>;
  owner?: string;
  description?: string;
  defaultBranch?: string;
  primaryLanguage?: string;
  stars?: number;
  lastUpdated?: string;
  createdAt: string;
}

export interface RepoSlice {
  // State
  connectedRepos: Repo[];
  activeRepoId: string | null;
  activeRepoMetadata: RepositoryMetadata | null;
  isLoadingRepos: boolean;
  isLoadingFiles: boolean;
  filesCache: Record<string, RepoFile[]>; // path -> files
  expandedFolders: Record<string, boolean>; // path -> boolean
  selectedFilePath: string | null;
  selectedFileContent: string | null;
  searchQuery: string;
  searchResults: RepoFile[];

  // Actions
  fetchConnectedRepos: () => Promise<void>;
  connectRepo: (type: 'github' | 'local', config: Record<string, string>) => Promise<Repo>;
  disconnectRepo: (id: string) => Promise<void>;
  setActiveRepoId: (id: string | null) => Promise<void>;
  fetchDirectoryFiles: (dirPath: string) => Promise<void>;
  toggleFolderExpanded: (folderPath: string) => Promise<void>;
  fetchFileContent: (filePath: string) => Promise<void>;
  closeFilePreview: () => void;
  searchRepoFiles: (query: string) => Promise<void>;
  setSearchQuery: (query: string) => void;
}

export const createRepoSlice: StateCreator<RootStore, [], [], RepoSlice> = (set, get) => ({
  // State defaults
  connectedRepos: [],
  activeRepoId: null,
  activeRepoMetadata: null,
  isLoadingRepos: false,
  isLoadingFiles: false,
  filesCache: {},
  expandedFolders: {},
  selectedFilePath: null,
  selectedFileContent: null,
  searchQuery: '',
  searchResults: [],

  // Actions
  fetchConnectedRepos: async () => {
    set({ isLoadingRepos: true });
    try {
      const res = await fetch('/api/repos');
      if (res.ok) {
        const data = (await res.json()) as { repos: Repo[] };
        set({ connectedRepos: data.repos });
      }
    } catch (err) {
      console.error('Failed to fetch connected repositories:', err);
    } finally {
      set({ isLoadingRepos: false });
    }
  },

  connectRepo: async (type, config) => {
    set({ isLoadingRepos: true });
    try {
      const res = await fetch('/api/repos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, config }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to connect repository.');
      }
      const data = (await res.json()) as { repo: Repo };
      await get().fetchConnectedRepos();
      return data.repo;
    } finally {
      set({ isLoadingRepos: false });
    }
  },

  disconnectRepo: async (id) => {
    set({ isLoadingRepos: true });
    try {
      const res = await fetch(`/api/repos/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (get().activeRepoId === id) {
          set({
            activeRepoId: null,
            activeRepoMetadata: null,
            filesCache: {},
            expandedFolders: {},
            selectedFilePath: null,
            selectedFileContent: null,
          });
        }
        await get().fetchConnectedRepos();
      }
    } catch (err) {
      console.error('Failed to disconnect repository:', err);
    } finally {
      set({ isLoadingRepos: false });
    }
  },

  setActiveRepoId: async (id) => {
    if (!id) {
      set({
        activeRepoId: null,
        activeRepoMetadata: null,
        filesCache: {},
        expandedFolders: {},
        selectedFilePath: null,
        selectedFileContent: null,
      });
      return;
    }

    set({
      activeRepoId: id,
      isLoadingFiles: true,
      filesCache: {},
      expandedFolders: {},
      selectedFilePath: null,
      selectedFileContent: null,
      searchResults: [],
      searchQuery: '',
    });

    try {
      // Find repo details from connectedRepos local list or fetch
      const repo = get().connectedRepos.find((r) => r.id === id);
      if (repo) {
        set({
          activeRepoMetadata: {
            name: repo.name,
            type: repo.type,
            config: repo.config,
            owner: repo.owner,
            description: repo.description,
            defaultBranch: repo.defaultBranch || 'main',
            primaryLanguage: repo.primaryLanguage || 'Unknown',
            stars: repo.stars || 0,
            lastUpdated: repo.lastUpdated ? new Date(repo.lastUpdated) : undefined,
            currentBranch: repo.defaultBranch || 'main',
            gitStatus: repo.type === 'local' ? 'clean' : 'synced',
          },
        });
      }

      // Load root files
      await get().fetchDirectoryFiles('');
    } catch (err) {
      console.error('Failed to activate repository:', err);
    } finally {
      set({ isLoadingFiles: false });
    }
  },

  fetchDirectoryFiles: async (dirPath) => {
    const repoId = get().activeRepoId;
    if (!repoId) return;

    set({ isLoadingFiles: true });
    try {
      const res = await fetch(`/api/repos/${repoId}/files?path=${encodeURIComponent(dirPath)}`);
      if (res.ok) {
        const data = (await res.json()) as { files: RepoFile[] };
        set((s) => ({
          filesCache: {
            ...s.filesCache,
            [dirPath]: data.files,
          },
        }));
      }
    } catch (err) {
      console.error(`Failed to fetch files for directory "${dirPath}":`, err);
    } finally {
      set({ isLoadingFiles: false });
    }
  },

  toggleFolderExpanded: async (folderPath) => {
    const isCurrentlyExpanded = !!get().expandedFolders[folderPath];
    set((s) => ({
      expandedFolders: {
        ...s.expandedFolders,
        [folderPath]: !isCurrentlyExpanded,
      },
    }));

    // If it is expanding and has no files loaded, fetch them
    if (!isCurrentlyExpanded && !get().filesCache[folderPath]) {
      await get().fetchDirectoryFiles(folderPath);
    }
  },

  fetchFileContent: async (filePath) => {
    const repoId = get().activeRepoId;
    if (!repoId) return;

    set({ isLoadingFiles: true });
    try {
      const res = await fetch(`/api/repos/${repoId}/file-content?path=${encodeURIComponent(filePath)}`);
      if (res.ok) {
        const data = (await res.json()) as { content: string };
        set({
          selectedFilePath: filePath,
          selectedFileContent: data.content,
        });
      }
    } catch (err) {
      console.error(`Failed to fetch file content for "${filePath}":`, err);
    } finally {
      set({ isLoadingFiles: false });
    }
  },

  closeFilePreview: () => {
    set({ selectedFilePath: null, selectedFileContent: null });
  },

  searchRepoFiles: async (query) => {
    const repoId = get().activeRepoId;
    if (!repoId) return;

    if (!query.trim()) {
      set({ searchResults: [] });
      return;
    }

    set({ isLoadingFiles: true });
    try {
      // In this phase, we use the provider search (Local recurse or GitHub code search)
      const res = await fetch(
        `/api/repos/${repoId}/files?path=&search=${encodeURIComponent(query)}` // Let's check how the provider search is called
      );
      // Wait, we didn't hook up a separate search query parameter in files/route.ts. Let's make sure it handles search!
      // Ah! We can easily modify files/route.ts or create a separate route, or let files/route.ts handle ?search=query parameter!
      // Let's implement ?search query parameter in files/route.ts:
      // If ?search query is present, it will run searchRepositoryFiles instead of listRepositoryDirectory.
      // This is extremely elegant and saves routes!
      const finalRes = await fetch(
        `/api/repos/${repoId}/files?search=${encodeURIComponent(query)}`
      );
      if (finalRes.ok) {
        const data = (await finalRes.json()) as { files: RepoFile[] };
        set({ searchResults: data.files });
      }
    } catch (err) {
      console.error('Failed to search files:', err);
    } finally {
      set({ isLoadingFiles: false });
    }
  },

  setSearchQuery: (query) => set({ searchQuery: query }),
});
