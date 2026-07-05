'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  ChevronDown,
  FolderOpen,
  Folder,
  FileCode,
  FileText,
  FileJson,
  GitBranch,
  Plus,
  X,
  Search,
  Loader2,
  GitMerge,
  Unlink,
  ArrowLeft,
  Star,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useIsRepoPanelOpen, useToggleRepoPanel } from '@/store/hooks/useUI';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  useConnectedRepos,
  useActiveRepoId,
  useActiveRepoMetadata,
  useIsLoadingRepos,
  useIsLoadingRepoFiles,
  useRepoFilesCache,
  useExpandedFolders,
  useSelectedFilePath,
  useSelectedFileContent,
  useSearchQuery,
  useSearchResults,
  useSetActiveRepoId,
  useDisconnectRepo,
  useToggleFolderExpanded,
  useFetchFileContent,
  useCloseFilePreview,
  useSearchRepoFiles,
  useSetSearchQuery,
  useFetchConnectedRepos,
} from '@/store/hooks/useRepo';
import { ConnectRepoModal } from './ConnectRepoModal';
import type { RepoFile } from '@/server/repos/types';

const REPO_PANEL_W = 300;
// Cap so the panel never forces horizontal overflow / clipping on narrow viewports.
const REPO_PANEL_MAX_W = '85vw';

/** Map file extension -> icon */
function FileIcon({ name, isFolder }: { name: string; isFolder: boolean }) {
  if (isFolder) return <Folder size={12} style={{ color: 'var(--color-accent)', opacity: 0.8 }} />;
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['ts', 'tsx'].includes(ext)) return <FileCode size={12} style={{ color: '#3b82f6' }} />;
  if (['js', 'jsx', 'mjs'].includes(ext)) return <FileCode size={12} style={{ color: '#f59e0b' }} />;
  if (['json'].includes(ext)) return <FileJson size={12} style={{ color: '#10b981' }} />;
  if (['md', 'mdx'].includes(ext)) return <FileText size={12} style={{ color: '#8b5cf6' }} />;
  if (['css', 'scss', 'sass'].includes(ext)) return <FileCode size={12} style={{ color: '#ec4899' }} />;
  return <FileCode size={12} style={{ color: 'var(--color-text-muted)' }} />;
}

/* ── File Tree Item ─────────────────────────────────────── */
function FileTreeItem({ file, depth = 0 }: { file: RepoFile; depth?: number }) {
  const expandedFolders = useExpandedFolders();
  const filesCache = useRepoFilesCache();
  const toggleFolder = useToggleFolderExpanded();
  const fetchFileContent = useFetchFileContent();
  const selectedFilePath = useSelectedFilePath();
  const isLoadingFiles = useIsLoadingRepoFiles();

  const isFolder = file.type === 'folder';
  const isExpanded = expandedFolders[file.path] ?? false;
  const children = filesCache[file.path] ?? [];
  const isSelected = selectedFilePath === file.path;

  const displayName = file.name.replace(/\/$/, '');

  const handleClick = useCallback(() => {
    if (isFolder) {
      toggleFolder(file.path);
    } else {
      fetchFileContent(file.path);
    }
  }, [isFolder, file.path, toggleFolder, fetchFileContent]);

  return (
    <>
      <motion.div
        className="flex items-center gap-1.5 rounded-md cursor-pointer text-xs select-none"
        style={{
          paddingLeft: `${8 + depth * 14}px`,
          paddingRight: 8,
          paddingTop: 5,
          paddingBottom: 5,
          background: isSelected ? 'var(--color-accent-muted)' : 'transparent',
          color: isSelected ? 'var(--color-accent-hover)' : 'var(--color-text-secondary)',
        }}
        whileHover={{ background: isSelected ? 'var(--color-accent-muted)' : 'var(--color-bg-hover)', color: 'var(--color-text-primary)' }}
        onClick={handleClick}
        title={file.path}
      >
        {isFolder && (
          <span style={{ color: 'var(--color-text-muted)', flexShrink: 0, display: 'flex' }}>
            {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          </span>
        )}
        {!isFolder && <span style={{ width: 10, flexShrink: 0 }} />}
        <FileIcon name={displayName} isFolder={isFolder} />
        <span className="flex-1 truncate">{displayName}</span>
        {isFolder && isExpanded && isLoadingFiles && children.length === 0 && (
          <Loader2 size={10} className="animate-spin shrink-0" style={{ color: 'var(--color-text-muted)' }} />
        )}
      </motion.div>
      {/* Render children if expanded */}
      {isFolder && isExpanded && children.map((child) => (
        <FileTreeItem key={child.path} file={child} depth={depth + 1} />
      ))}
    </>
  );
}

/* ── File Preview Panel ───────────────────────────────── */
function FilePreview() {
  const selectedFilePath = useSelectedFilePath();
  const selectedFileContent = useSelectedFileContent();
  const closePreview = useCloseFilePreview();
  const isLoading = useIsLoadingRepoFiles();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!selectedFileContent) return;
    try {
      await navigator.clipboard.writeText(selectedFileContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      // clipboard API requires a secure context (HTTPS/localhost) — fails silently otherwise
      console.error('Copy failed:', err);
    }
  }, [selectedFileContent]);

  if (!selectedFilePath) return null;

  const fileName = selectedFilePath.split('/').pop() ?? selectedFilePath;

  return (
    <div
      className="flex flex-col"
      style={{
        borderTop: '1px solid var(--color-border)',
        background: 'var(--color-bg-base)',
        maxHeight: 260,
      }}
    >
      {/* Preview header */}
      <div
        className="flex items-center justify-between px-3 py-2 shrink-0"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <FileIcon name={fileName} isFolder={false} />
          <span className="text-xs truncate font-mono" style={{ color: 'var(--color-text-primary)' }}>
            {fileName}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Copy button */}
          <Tooltip>
            <TooltipTrigger
              render={
                <motion.button
                  type="button"
                  onClick={handleCopy}
                  disabled={!selectedFileContent || isLoading}
                  className="flex items-center justify-center h-5 w-5 rounded cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ color: copied ? 'var(--color-success)' : 'var(--color-text-muted)' }}
                  whileHover={!copied ? { background: 'var(--color-bg-hover)', color: 'var(--color-text-primary)' } : {}}
                  whileTap={{ scale: 0.9 }}
                  aria-label="Copy file content"
                >
                  {copied ? <Check size={11} /> : <Copy size={11} />}
                </motion.button>
              }
            />
            <TooltipContent side="left">{copied ? 'Copied!' : 'Copy'}</TooltipContent>
          </Tooltip>

          <motion.button
            type="button"
            onClick={closePreview}
            className="flex items-center justify-center h-5 w-5 rounded cursor-pointer shrink-0"
            style={{ color: 'var(--color-text-muted)' }}
            whileHover={{ background: 'var(--color-bg-hover)', color: 'var(--color-text-primary)' }}
            whileTap={{ scale: 0.9 }}
            aria-label="Close file preview"
          >
            <X size={11} />
          </motion.button>
        </div>
      </div>

      {/* Content */}
      <div className="overflow-auto flex-1 p-3">
        {isLoading && !selectedFileContent ? (
          <div className="flex items-center gap-2 py-4" style={{ color: 'var(--color-text-muted)' }}>
            <Loader2 size={13} className="animate-spin" />
            <span className="text-xs">Loading…</span>
          </div>
        ) : (
          <pre
            className="text-xs font-mono leading-relaxed whitespace-pre-wrap break-all"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {selectedFileContent ?? ''}
          </pre>
        )}
      </div>
    </div>
  );
}

/* ── Main Repository Panel ──────────────────────────────── */
export function RepositoryPanel() {
  const isOpen = useIsRepoPanelOpen();
  const toggleRepoPanel = useToggleRepoPanel();

  const connectedRepos = useConnectedRepos();
  const activeRepoId = useActiveRepoId();
  const activeRepoMetadata = useActiveRepoMetadata();
  const isLoadingRepos = useIsLoadingRepos();
  const isLoadingFiles = useIsLoadingRepoFiles();
  const filesCache = useRepoFilesCache();
  const searchQuery = useSearchQuery();
  const searchResults = useSearchResults();

  const setActiveRepoId = useSetActiveRepoId();
  const disconnectRepo = useDisconnectRepo();
  const searchRepoFiles = useSearchRepoFiles();
  const setSearchQuery = useSetSearchQuery();
  const refreshRepos = useFetchConnectedRepos();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showRepoSelector, setShowRepoSelector] = useState(false);

  const rootFiles = filesCache[''] ?? [];
  const isSearching = searchQuery.trim().length > 0;

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (q.trim()) searchRepoFiles(q);
  }, [setSearchQuery, searchRepoFiles]);

  const handleDisconnect = useCallback(async () => {
    if (!activeRepoId) return;
    if (!confirm('Disconnect this repository?')) return;
    await disconnectRepo(activeRepoId);
  }, [activeRepoId, disconnectRepo]);

  return (
    <>
      <ConnectRepoModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

      <motion.aside
        id="repo-panel"
        initial={false}
        animate={{ width: isOpen ? REPO_PANEL_W : 0, opacity: isOpen ? 1 : 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        className="relative flex flex-col h-full overflow-hidden shrink-0"
        style={{
          background: 'var(--color-bg-surface)',
          borderLeft: '1px solid var(--color-border)',
          maxWidth: REPO_PANEL_MAX_W, // prevents forcing horizontal overflow on narrow viewports
        }}
        aria-label="Repository panel"
      >
        <div style={{ width: REPO_PANEL_W, maxWidth: REPO_PANEL_MAX_W }} className="flex flex-col h-full">

          {/* ── Header ── */}
          <div
            className="flex items-center justify-between px-4 py-3 shrink-0"
            style={{ borderBottom: '1px solid var(--color-border)' }}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {activeRepoId && (
                <motion.button
                  type="button"
                  onClick={() => setShowRepoSelector(!showRepoSelector)}
                  className="flex items-center justify-center h-6 w-6 rounded cursor-pointer shrink-0"
                  style={{ color: 'var(--color-text-muted)' }}
                  whileHover={{ background: 'var(--color-bg-hover)', color: 'var(--color-text-primary)' }}
                  whileTap={{ scale: 0.92 }}
                  aria-label="Switch repository"
                  title="Switch repository"
                >
                  <GitMerge size={12} />
                </motion.button>
              )}
              <FolderOpen size={13} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
              <span className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                {activeRepoMetadata ? activeRepoMetadata.name : 'Repository'}
              </span>
              {activeRepoMetadata?.stars != null && activeRepoMetadata.stars > 0 && (
                <span className="flex items-center gap-1 text-[10px] shrink-0" style={{ color: 'var(--color-text-muted)' }}>
                  <Star size={9} />
                  {activeRepoMetadata.stars >= 1000
                    ? `${(activeRepoMetadata.stars / 1000).toFixed(1)}k`
                    : activeRepoMetadata.stars}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {activeRepoId && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <motion.button
                        type="button"
                        onClick={handleDisconnect}
                        className="flex items-center justify-center h-7 w-7 rounded-lg cursor-pointer"
                        style={{ color: 'var(--color-text-muted)', border: '1px solid transparent' }}
                        whileHover={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)', color: '#ef4444' }}
                        whileTap={{ scale: 0.92 }}
                        aria-label="Disconnect repository"
                      >
                        <Unlink size={12} />
                      </motion.button>
                    }
                  />
                  <TooltipContent side="left">Disconnect repository</TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <motion.button
                      type="button"
                      onClick={toggleRepoPanel}
                      className="flex items-center justify-center h-7 w-7 rounded-lg cursor-pointer"
                      style={{ color: 'var(--color-text-muted)', border: '1px solid transparent' }}
                      whileHover={{ background: 'var(--color-bg-hover)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                      whileTap={{ scale: 0.92 }}
                      aria-label="Close repo panel"
                    >
                      <ChevronRight size={14} />
                    </motion.button>
                  }
                />
                <TooltipContent side="left">Close panel (⌘R)</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* ── Repo Selector Dropdown ── */}
          <AnimatePresence>
            {showRepoSelector && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden shrink-0"
                style={{ borderBottom: '1px solid var(--color-border)' }}
              >
                <div className="p-2 space-y-0.5">
                  {connectedRepos.map((repo) => (
                    <motion.button
                      key={repo.id}
                      type="button"
                      onClick={() => {
                        setActiveRepoId(repo.id);
                        setShowRepoSelector(false);
                      }}
                      className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs text-left cursor-pointer"
                      style={{
                        background: repo.id === activeRepoId ? 'var(--color-accent-muted)' : 'transparent',
                        color: repo.id === activeRepoId ? 'var(--color-accent-hover)' : 'var(--color-text-secondary)',
                      }}
                      whileHover={{ background: repo.id === activeRepoId ? 'var(--color-accent-muted)' : 'var(--color-bg-hover)' }}
                    >
                      <FolderOpen size={11} />
                      <span className="flex-1 truncate">{repo.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-text-muted)' }}>
                        {repo.type}
                      </span>
                    </motion.button>
                  ))}
                  <motion.button
                    type="button"
                    onClick={() => { setShowRepoSelector(false); setIsModalOpen(true); }}
                    className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs text-left cursor-pointer"
                    style={{ color: 'var(--color-accent-hover)' }}
                    whileHover={{ background: 'var(--color-accent-muted)' }}
                  >
                    <Plus size={11} />
                    Connect another repository
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Repo Metadata Strip ── */}
          {activeRepoMetadata && (
            <div
              className="flex items-center gap-3 px-4 py-2 shrink-0 text-[10px]"
              style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
            >
              {activeRepoMetadata.currentBranch && (
                <span className="flex items-center gap-1">
                  <GitBranch size={9} />
                  {activeRepoMetadata.currentBranch}
                </span>
              )}
              {activeRepoMetadata.primaryLanguage && activeRepoMetadata.primaryLanguage !== 'Unknown' && (
                <span>{activeRepoMetadata.primaryLanguage}</span>
              )}
              {activeRepoMetadata.gitStatus && (
                <span
                  className="ml-auto px-1.5 py-0.5 rounded"
                  style={{
                    background: activeRepoMetadata.gitStatus === 'synced' || activeRepoMetadata.gitStatus === 'clean'
                      ? 'rgba(34,197,94,0.12)' : 'rgba(251,191,36,0.12)',
                    color: activeRepoMetadata.gitStatus === 'synced' || activeRepoMetadata.gitStatus === 'clean'
                      ? '#22c55e' : '#fbbf24',
                  }}
                >
                  {activeRepoMetadata.gitStatus}
                </span>
              )}
            </div>
          )}

          {/* ── Empty / No-repo State ── */}
          {!activeRepoId && !isLoadingRepos && (
            <div className="flex flex-col items-center justify-center flex-1 px-4 py-8 text-center gap-4">
              <div
                className="flex items-center justify-center h-12 w-12 rounded-2xl"
                style={{ background: 'var(--color-bg-elevated)', border: '1px dashed var(--color-border)' }}
              >
                <FolderOpen size={20} style={{ color: 'var(--color-text-muted)' }} />
              </div>
              <div>
                <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>
                  No repository connected
                </p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  Connect a GitHub repo or local folder to browse files here.
                </p>
              </div>

              {connectedRepos.length > 0 && (
                <div className="w-full space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--color-text-muted)' }}>
                    Previously connected
                  </p>
                  {connectedRepos.map((repo) => (
                    <motion.button
                      key={repo.id}
                      type="button"
                      onClick={() => setActiveRepoId(repo.id)}
                      className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs text-left cursor-pointer"
                      style={{
                        background: 'var(--color-bg-elevated)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text-secondary)',
                      }}
                      whileHover={{ borderColor: 'var(--color-accent-border)', color: 'var(--color-text-primary)' }}
                    >
                      <FolderOpen size={11} style={{ color: 'var(--color-accent)' }} />
                      <span className="flex-1 truncate">{repo.name}</span>
                      <ArrowLeft size={10} style={{ transform: 'rotate(180deg)' }} />
                    </motion.button>
                  ))}
                </div>
              )}

              <motion.button
                type="button"
                id="connect-repo-cta-btn"
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium cursor-pointer w-full justify-center"
                style={{
                  background: 'var(--color-accent-muted)',
                  border: '1px solid var(--color-accent-border)',
                  // was var(--color-accent) — that's ~3.8:1 contrast on this dark bg, below WCAG AA (4.5:1).
                  // --color-accent-hover is lighter (#818cf8) and reads clearly here.
                  color: 'var(--color-accent-hover)',
                }}
                whileHover={{ background: 'var(--color-accent)', color: '#fff' }}
                whileTap={{ scale: 0.97 }}
              >
                <Plus size={14} />
                Connect Repository
              </motion.button>
            </div>
          )}

          {/* ── Loading state (no active repo yet) ── */}
          {isLoadingRepos && !activeRepoId && (
            <div className="flex items-center justify-center flex-1 gap-2" style={{ color: 'var(--color-text-muted)' }}>
              <Loader2 size={15} className="animate-spin" />
              <span className="text-xs">Loading…</span>
            </div>
          )}

          {/* ── Active Repo: Search + File Tree ── */}
          {activeRepoId && (
            <>
              {/* Search bar */}
              <div className="px-3 py-2 shrink-0" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <div
                  className="flex items-center gap-2 rounded-lg px-2.5 py-1.5"
                  style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)' }}
                >
                  {isLoadingFiles && searchQuery ? (
                    <Loader2 size={11} className="animate-spin shrink-0" style={{ color: 'var(--color-text-muted)' }} />
                  ) : (
                    <Search size={11} className="shrink-0" style={{ color: 'var(--color-text-muted)' }} />
                  )}
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    placeholder="Search files…"
                    className="flex-1 bg-transparent text-xs outline-none"
                    style={{ color: 'var(--color-text-primary)' }}
                    id="repo-search-input"
                  />
                  {searchQuery && (
                    <motion.button
                      type="button"
                      onClick={() => { setSearchQuery(''); }}
                      className="cursor-pointer"
                      style={{ color: 'var(--color-text-muted)' }}
                      whileHover={{ color: 'var(--color-text-primary)' }}
                    >
                      <X size={10} />
                    </motion.button>
                  )}
                </div>
              </div>

              {/* Toolbar: connect another + refresh */}
              <div className="flex items-center justify-between px-3 py-1.5 shrink-0">
                <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
                  {isSearching ? 'Search Results' : 'Files'}
                </span>
                <div className="flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <motion.button
                          type="button"
                          onClick={() => refreshRepos()}
                          className="flex items-center justify-center h-5 w-5 rounded cursor-pointer"
                          style={{ color: 'var(--color-text-muted)' }}
                          whileHover={{ background: 'var(--color-bg-hover)', color: 'var(--color-text-primary)' }}
                          whileTap={{ scale: 0.9 }}
                          aria-label="Refresh"
                        >
                          <RefreshCw size={10} />
                        </motion.button>
                      }
                    />
                    <TooltipContent side="left">Refresh</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <motion.button
                          type="button"
                          onClick={() => setIsModalOpen(true)}
                          className="flex items-center justify-center h-5 w-5 rounded cursor-pointer"
                          style={{ color: 'var(--color-text-muted)' }}
                          whileHover={{ background: 'var(--color-bg-hover)', color: 'var(--color-accent-hover)' }}
                          whileTap={{ scale: 0.9 }}
                          aria-label="Connect another repository"
                        >
                          <Plus size={10} />
                        </motion.button>
                      }
                    />
                    <TooltipContent side="left">Connect another repository</TooltipContent>
                  </Tooltip>
                </div>
              </div>

              {/* File Tree / Search results */}
              <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                {/* min-h-0 here is required: without it, flex-1 on ScrollArea's Root
                    resolves min-height to "auto" (content size) instead of 0, so it
                    grows to fit the tree instead of scrolling within available space. */}
                <ScrollArea className="flex-1 min-h-0">
                  <div className="px-1 py-1">
                    {isLoadingFiles && rootFiles.length === 0 && !isSearching ? (
                      <div className="flex items-center gap-2 px-3 py-4" style={{ color: 'var(--color-text-muted)' }}>
                        <Loader2 size={13} className="animate-spin" />
                        <span className="text-xs">Loading files…</span>
                      </div>
                    ) : isSearching ? (
                      searchResults.length === 0 ? (
                        <p className="text-xs px-3 py-3" style={{ color: 'var(--color-text-muted)' }}>
                          {isLoadingFiles ? 'Searching…' : 'No results found.'}
                        </p>
                      ) : (
                        searchResults.map((file) => (
                          <SearchResultItem key={file.path} file={file} />
                        ))
                      )
                    ) : rootFiles.length === 0 ? (
                      <p className="text-xs px-3 py-3" style={{ color: 'var(--color-text-muted)' }}>
                        No files found.
                      </p>
                    ) : (
                      rootFiles.map((file) => (
                        <FileTreeItem key={file.path} file={file} depth={0} />
                      ))
                    )}
                  </div>
                </ScrollArea>

                {/* File preview */}
                <FilePreview />
              </div>
            </>
          )}
        </div>
      </motion.aside>
    </>
  );
}

/* ── Search Result Item ──────────────────────────────────── */
function SearchResultItem({ file }: { file: RepoFile }) {
  const fetchFileContent = useFetchFileContent();
  const selectedFilePath = useSelectedFilePath();
  const isSelected = selectedFilePath === file.path;

  const parts = file.path.split('/');
  const fileName = parts.pop() ?? file.path;
  const dirPath = parts.join('/');

  return (
    <motion.div
      className="flex flex-col gap-0.5 px-3 py-2 rounded-md cursor-pointer text-xs"
      style={{
        background: isSelected ? 'var(--color-accent-muted)' : 'transparent',
        color: isSelected ? 'var(--color-accent-hover)' : 'var(--color-text-secondary)',
      }}
      whileHover={{ background: isSelected ? 'var(--color-accent-muted)' : 'var(--color-bg-hover)', color: 'var(--color-text-primary)' }}
      onClick={() => fetchFileContent(file.path)}
      title={file.path}
    >
      <div className="flex items-center gap-1.5">
        <FileIcon name={fileName} isFolder={false} />
        <span className="font-medium">{fileName}</span>
      </div>
      {dirPath && (
        <span className="text-[10px] pl-5" style={{ color: 'var(--color-text-muted)' }}>
          {dirPath}
        </span>
      )}
    </motion.div>
  );
}//