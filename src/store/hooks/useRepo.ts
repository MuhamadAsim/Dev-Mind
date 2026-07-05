// ============================================================
// Repository Selector Hooks
// Domain-specific hooks components never import useStore directly.
// ============================================================
import { useStore } from '../index';

// -- State selectors ------------------------------------------

export const useConnectedRepos = () => useStore((s) => s.connectedRepos);
export const useActiveRepoId = () => useStore((s) => s.activeRepoId);
export const useActiveRepoMetadata = () => useStore((s) => s.activeRepoMetadata);
export const useIsLoadingRepos = () => useStore((s) => s.isLoadingRepos);
export const useIsLoadingRepoFiles = () => useStore((s) => s.isLoadingFiles);

/** Returns cached files for a given directory path ('' = root) */
export const useRepoFilesCache = () => useStore((s) => s.filesCache);
export const useExpandedFolders = () => useStore((s) => s.expandedFolders);
export const useSelectedFilePath = () => useStore((s) => s.selectedFilePath);
export const useSelectedFileContent = () => useStore((s) => s.selectedFileContent);
export const useSearchQuery = () => useStore((s) => s.searchQuery);
export const useSearchResults = () => useStore((s) => s.searchResults);

// -- Action selectors -----------------------------------------

export const useFetchConnectedRepos = () => useStore((s) => s.fetchConnectedRepos);
export const useConnectRepo = () => useStore((s) => s.connectRepo);
export const useDisconnectRepo = () => useStore((s) => s.disconnectRepo);
export const useSetActiveRepoId = () => useStore((s) => s.setActiveRepoId);
export const useFetchDirectoryFiles = () => useStore((s) => s.fetchDirectoryFiles);
export const useToggleFolderExpanded = () => useStore((s) => s.toggleFolderExpanded);
export const useFetchFileContent = () => useStore((s) => s.fetchFileContent);
export const useCloseFilePreview = () => useStore((s) => s.closeFilePreview);
export const useSearchRepoFiles = () => useStore((s) => s.searchRepoFiles);
export const useSetSearchQuery = () => useStore((s) => s.setSearchQuery);
