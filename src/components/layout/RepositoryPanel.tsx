'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  FolderOpen,
  GitBranch,
  GitPullRequest,
  FileCode,
  Plus,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useIsRepoPanelOpen, useToggleRepoPanel } from '@/store/hooks/useUI';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const REPO_PANEL_W = 280;

// Mock repository data — replace with real GitHub API data later.
// TODO: once wired to a real API, replace this inferred typing with an
// explicit `RepoFile` interface (name, type: 'file' | 'folder', children?: number).
const MOCK_FILES = [
  { name: 'src/', type: 'folder', children: 8 },
  { name: 'components/', type: 'folder', children: 12 },
  { name: 'app/', type: 'folder', children: 6 },
  { name: 'lib/', type: 'folder', children: 4 },
  { name: 'package.json', type: 'file' },
  { name: 'tsconfig.json', type: 'file' },
  { name: 'README.md', type: 'file' },
];

const MOCK_BRANCHES = [
  { name: 'main', isCurrent: true },
  { name: 'feat/ai-chat', isCurrent: false },
  { name: 'feat/github-oauth', isCurrent: false },
];

const MOCK_PRS = [
  { number: 12, title: 'Add AI chat interface', status: 'open' },
  { number: 11, title: 'Fix sidebar animation', status: 'merged' },
];

export function RepositoryPanel() {
  const isOpen = useIsRepoPanelOpen();
  const toggleRepoPanel = useToggleRepoPanel();

  return (
    <motion.aside
      id="repo-panel"
      initial={false}
      animate={{ width: isOpen ? REPO_PANEL_W : 0, opacity: isOpen ? 1 : 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      className="relative flex flex-col h-full overflow-hidden shrink-0"
      style={{
        background: 'var(--color-bg-surface)',
        borderLeft: '1px solid var(--color-border)',
      }}
      aria-label="Repository panel"
    >
      <div style={{ width: REPO_PANEL_W }} className="flex flex-col h-full">
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 shrink-0"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <div className="flex items-center gap-2">
            <FolderOpen size={14} style={{ color: 'var(--color-accent)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              Repository
            </span>
            <Badge
              variant="secondary"
              className="text-[9px] px-1.5 py-0"
              style={{ background: 'var(--color-accent-muted)', color: 'var(--color-accent)' }}
            >
              Soon
            </Badge>
          </div>

          {/* FIX: motion.button passed via `render`, not as a child — stops
              TooltipTrigger from rendering a second nested <button>. */}
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

        {/* Connect CTA */}
        <div className="px-3 py-2 shrink-0">
          <motion.button
            type="button"
            className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-xs cursor-pointer"
            style={{
              background: 'var(--color-bg-elevated)',
              border: '1px dashed var(--color-border)',
              color: 'var(--color-text-muted)',
            }}
            whileHover={{
              borderColor: 'var(--color-accent-border)',
              color: 'var(--color-accent)',
              background: 'var(--color-accent-muted)',
            }}
            whileTap={{ scale: 0.98 }}
          >
            <Plus size={12} />
            Connect GitHub repository
          </motion.button>
        </div>

        <ScrollArea className="flex-1 px-3 py-2">
          {/* Files Section */}
          <Section
            title="Files"
            icon={<FileCode size={12} style={{ color: 'var(--color-accent)' }} />}
          >
            {MOCK_FILES.map((file) => (
              <FileItem key={file.name} file={file} />
            ))}
          </Section>

          {/* Branches Section */}
          <Section
            title="Branches"
            icon={<GitBranch size={12} style={{ color: 'var(--color-accent)' }} />}
          >
            {MOCK_BRANCHES.map((branch) => (
              <BranchItem key={branch.name} branch={branch} />
            ))}
          </Section>

          {/* Pull Requests */}
          <Section
            title="Pull Requests"
            icon={<GitPullRequest size={12} style={{ color: 'var(--color-accent)' }} />}
          >
            {MOCK_PRS.map((pr) => (
              <PRItem key={pr.number} pr={pr} />
            ))}
          </Section>
        </ScrollArea>
      </div>
    </motion.aside>
  );
}

/* ── Sub-components ──────────────────────────────────────── */
interface SectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function Section({ title, icon, children }: SectionProps) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-1.5 mb-2">
        {icon}
        <span
          className="text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {title}
        </span>
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function FileItem({ file }: { file: typeof MOCK_FILES[0] }) {
  return (
    <motion.div
      className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-xs"
      style={{ color: 'var(--color-text-secondary)' }}
      whileHover={{ background: 'var(--color-bg-hover)', color: 'var(--color-text-primary)' }}
    >
      {file.type === 'folder' ? (
        <FolderOpen size={12} style={{ color: 'var(--color-accent)', opacity: 0.7 }} />
      ) : (
        <FileCode size={12} style={{ color: 'var(--color-text-muted)' }} />
      )}
      <span className="flex-1 truncate">{file.name}</span>
      {file.children && (
        <span style={{ color: 'var(--color-text-muted)', fontSize: 10 }}>{file.children}</span>
      )}
    </motion.div>
  );
}

function BranchItem({ branch }: { branch: typeof MOCK_BRANCHES[0] }) {
  return (
    <motion.div
      className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-xs"
      style={{ color: branch.isCurrent ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}
      whileHover={{ background: 'var(--color-bg-hover)', color: 'var(--color-text-primary)' }}
    >
      <GitBranch size={11} />
      <span className="flex-1 truncate">{branch.name}</span>
      {branch.isCurrent && (
        <div
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: 'var(--color-success)' }}
        />
      )}
    </motion.div>
  );
}

function PRItem({ pr }: { pr: typeof MOCK_PRS[0] }) {
  const statusColor = pr.status === 'open' ? 'var(--color-success)' : '#8b5cf6';
  return (
    <motion.div
      className="flex items-start gap-2 px-2 py-2 rounded-md cursor-pointer text-xs"
      style={{ color: 'var(--color-text-secondary)' }}
      whileHover={{ background: 'var(--color-bg-hover)', color: 'var(--color-text-primary)' }}
    >
      {/* FIX: `shrink` is not a real CSS property — it was silently doing nothing.
          The correct property is `flexShrink`. No `as React.CSSProperties` cast
          needed once the object is actually valid. */}
      <GitPullRequest size={11} style={{ color: statusColor, marginTop: 1, flexShrink: 0 }} />
      <div className="flex-1 min-w-0">
        <p className="truncate" style={{ color: 'var(--color-text-primary)' }}>
          {pr.title}
        </p>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 10 }}>#{pr.number} · {pr.status}</p>
      </div>
    </motion.div>
  );
}