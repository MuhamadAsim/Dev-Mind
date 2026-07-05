'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GitFork, FolderOpen, X, Loader2, AlertCircle, CheckCircle2, Link } from 'lucide-react';
import { useConnectRepo, useSetActiveRepoId } from '@/store/hooks/useRepo';

interface ConnectRepoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'github' | 'local';

export function ConnectRepoModal({ isOpen, onClose }: ConnectRepoModalProps) {
  const connectRepo = useConnectRepo();
  const setActiveRepoId = useSetActiveRepoId();

  const [activeTab, setActiveTab] = useState<Tab>('github');
  const [githubInput, setGithubInput] = useState('');
  const [localPath, setLocalPath] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function reset() {
    setGithubInput('');
    setLocalPath('');
    setError(null);
    setSuccess(false);
    setIsLoading(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleConnect() {
    setError(null);
    setSuccess(false);
    setIsLoading(true);

    try {
      if (activeTab === 'github') {
        if (!githubInput.trim()) throw new Error('Enter a GitHub repo (owner/repo) or URL.');
        let owner = '';
        let repo = '';

        const input = githubInput.trim();
        // Try URL first: github.com/owner/repo
        const urlMatch = input.match(/github\.com\/([^/\s]+)\/([^/\s]+)/);
        if (urlMatch) {
          owner = urlMatch[1];
          repo = urlMatch[2].replace(/\.git$/, '');
        } else {
          // Try owner/repo format
          const parts = input.split('/');
          if (parts.length === 2 && parts[0] && parts[1]) {
            owner = parts[0];
            repo = parts[1].replace(/\.git$/, '');
          } else {
            throw new Error('Enter a valid owner/repo or GitHub URL.');
          }
        }

        const newRepo = await connectRepo('github', { owner, repo });
        setSuccess(true);
        setTimeout(() => {
          setActiveRepoId(newRepo.id);
          handleClose();
        }, 800);
      } else {
        if (!localPath.trim()) throw new Error('Enter an absolute local path.');
        const newRepo = await connectRepo('local', { localPath: localPath.trim() });
        setSuccess(true);
        setTimeout(() => {
          setActiveRepoId(newRepo.id);
          handleClose();
        }, 800);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to connect repository.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        // Backdrop is now the centering context (flex + items-center + justify-center).
        // Previously the dialog used `top-1/2 left-1/2` + `transform: translate(-50%,-50%)`
        // in `style`, but Framer Motion overwrites the `transform` CSS property whenever
        // you animate x/y/scale/rotate — so the manual translate was silently dropped,
        // and the dialog's top-left corner (not its center) landed at the viewport center,
        // pushing the whole modal toward the bottom-right.
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
        >
          {/* Dialog */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Connect a repository"
            className="w-full max-w-md"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            onClick={(e) => e.stopPropagation()} // prevent inside clicks from bubbling to backdrop close
          >
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: 'var(--color-bg-elevated)',
                border: '1px solid var(--color-border)',
                boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
              }}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between px-6 py-4"
                style={{ borderBottom: '1px solid var(--color-border)' }}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="flex items-center justify-center h-8 w-8 rounded-lg"
                    style={{ background: 'var(--color-accent-muted)' }}
                  >
                    <Link size={14} style={{ color: 'var(--color-accent-hover)' }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                      Connect Repository
                    </p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      GitHub or local filesystem
                    </p>
                  </div>
                </div>
                <motion.button
                  type="button"
                  onClick={handleClose}
                  className="flex items-center justify-center h-7 w-7 rounded-lg cursor-pointer"
                  style={{ color: 'var(--color-text-muted)' }}
                  whileHover={{ background: 'var(--color-bg-hover)', color: 'var(--color-text-primary)' }}
                  whileTap={{ scale: 0.92 }}
                  aria-label="Close dialog"
                >
                  <X size={14} />
                </motion.button>
              </div>

              {/* Tab selector */}
              <div className="flex px-6 pt-4 gap-2">
                {(['github', 'local'] as Tab[]).map((tab) => (
                  <motion.button
                    key={tab}
                    type="button"
                    onClick={() => { setActiveTab(tab); setError(null); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                    style={{
                      background: activeTab === tab ? 'var(--color-accent-muted)' : 'transparent',
                      color: activeTab === tab ? 'var(--color-accent-hover)' : 'var(--color-text-muted)',
                      border: `1px solid ${activeTab === tab ? 'var(--color-accent-border)' : 'transparent'}`,
                    }}
                    whileTap={{ scale: 0.96 }}
                  >
                    {tab === 'github' ? <GitFork size={12} /> : <FolderOpen size={12} />}
                    {tab === 'github' ? 'GitHub' : 'Local Path'}
                  </motion.button>
                ))}
              </div>

              {/* Body */}
              <div className="px-6 py-4 space-y-3">
                <AnimatePresence mode="wait">
                  {activeTab === 'github' ? (
                    <motion.div
                      key="github"
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 6 }}
                      transition={{ duration: 0.15 }}
                      className="space-y-2"
                    >
                      <label
                        htmlFor="github-repo-input"
                        className="text-xs font-medium"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        Repository
                      </label>
                      <input
                        id="github-repo-input"
                        type="text"
                        value={githubInput}
                        onChange={(e) => setGithubInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                        placeholder="owner/repo or https://github.com/owner/repo"
                        className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-colors"
                        style={{
                          background: 'var(--color-bg-surface)',
                          border: '1px solid var(--color-border)',
                          color: 'var(--color-text-primary)',
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = 'var(--color-accent)';
                          e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-accent-muted)';
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = 'var(--color-border)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      />
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        Example: <span style={{ color: 'var(--color-text-secondary)' }}>vercel/next.js</span> or a full GitHub URL
                      </p>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="local"
                      initial={{ opacity: 0, x: 6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -6 }}
                      transition={{ duration: 0.15 }}
                      className="space-y-2"
                    >
                      <label
                        htmlFor="local-path-input"
                        className="text-xs font-medium"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        Absolute Path
                      </label>
                      <input
                        id="local-path-input"
                        type="text"
                        value={localPath}
                        onChange={(e) => setLocalPath(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                        placeholder="/Users/you/projects/my-app or C:\projects\my-app"
                        className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-colors font-mono"
                        style={{
                          background: 'var(--color-bg-surface)',
                          border: '1px solid var(--color-border)',
                          color: 'var(--color-text-primary)',
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = 'var(--color-accent)';
                          e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-accent-muted)';
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = 'var(--color-border)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      />
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        The server must have read access to this path.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Error / Success feedback */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-start gap-2 rounded-lg px-3 py-2.5"
                      style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
                    >
                      <AlertCircle size={13} className="mt-0.5 shrink-0" style={{ color: '#ef4444' }} />
                      <p className="text-xs" style={{ color: '#fca5a5' }}>{error}</p>
                    </motion.div>
                  )}
                  {success && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="flex items-center gap-2 rounded-lg px-3 py-2.5"
                      style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}
                    >
                      <CheckCircle2 size={13} style={{ color: '#22c55e' }} />
                      <p className="text-xs" style={{ color: '#86efac' }}>Repository connected! Loading files…</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer */}
              <div
                className="flex items-center justify-end gap-2 px-6 py-4"
                style={{ borderTop: '1px solid var(--color-border)' }}
              >
                <motion.button
                  type="button"
                  onClick={handleClose}
                  disabled={isLoading}
                  className="px-4 py-2 rounded-lg text-sm cursor-pointer"
                  style={{
                    color: 'var(--color-text-muted)',
                    border: '1px solid var(--color-border)',
                    background: 'transparent',
                  }}
                  whileHover={{ background: 'var(--color-bg-hover)', color: 'var(--color-text-primary)' }}
                  whileTap={{ scale: 0.96 }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  type="button"
                  onClick={handleConnect}
                  disabled={isLoading || success}
                  id="connect-repo-btn"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
                  style={{
                    background: 'var(--color-accent)',
                    color: '#fff',
                    opacity: isLoading || success ? 0.7 : 1,
                  }}
                  whileHover={!isLoading && !success ? { background: 'var(--color-accent-hover)' } : {}}
                  whileTap={!isLoading && !success ? { scale: 0.96 } : {}}
                >
                  {isLoading && <Loader2 size={13} className="animate-spin" />}
                  {isLoading ? 'Connecting…' : success ? 'Connected!' : 'Connect'}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}