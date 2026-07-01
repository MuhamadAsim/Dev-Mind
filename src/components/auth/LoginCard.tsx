'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Sparkles, Zap, Shield } from 'lucide-react';

// Inline GitHub SVG — lucide-react doesn't export Github in this version
function GithubIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}
import { useLogin } from '@/store/hooks/useAuth';
import { Logo } from '@/components/shared/Logo';
import { ROUTES, APP_META } from '@/lib/constants';

const FEATURES = [
  { icon: Sparkles, label: 'AI-powered code assistance' },
  { icon: Zap,      label: 'Instant context understanding' },
  { icon: Shield,   label: 'Private & local-first' },
];

export function LoginCard() {
  const login = useLogin();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    try {
      setIsLoading(true);
      setError(null);
      // Simulate a brief network delay for realistic feel
      await new Promise((r) => setTimeout(r, 800));
      login();
      router.push(ROUTES.WORKSPACE);
    } catch {
      setError('Something went wrong. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      className="relative w-full max-w-md"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Glow behind card */}
      <div
        className="absolute -inset-px rounded-2xl blur-xl opacity-30"
        style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
        aria-hidden="true"
      />

      {/* Card */}
      <div
        className="relative rounded-2xl p-8 space-y-8"
        style={{
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* Header */}
        <div className="space-y-4 text-center">
          <motion.div
            className="flex justify-center"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.4 }}
          >
            <Logo size="lg" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
          >
            <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
              Welcome back
            </h1>
            <p className="mt-1.5 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {APP_META.TAGLINE}
            </p>
          </motion.div>
        </div>

        {/* Feature pills */}
        <motion.div
          className="flex flex-wrap gap-2 justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          {FEATURES.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs"
              style={{
                background: 'var(--color-accent-muted)',
                border: '1px solid var(--color-accent-border)',
                color: 'var(--color-accent)',
              }}
            >
              <Icon size={11} />
              {label}
            </div>
          ))}
        </motion.div>

        {/* Login button */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4 }}
        >
          <motion.button
            id="login-github-btn"
            onClick={handleLogin}
            disabled={isLoading}
            className="relative w-full flex items-center justify-center gap-3 rounded-xl px-5 py-3.5 text-sm font-semibold text-white overflow-hidden cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              boxShadow: '0 4px 24px rgba(99,102,241,0.35)',
            }}
            whileHover={{ scale: 1.02, boxShadow: '0 6px 32px rgba(99,102,241,0.5)' }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          >
            {/* Shimmer effect */}
            <motion.div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
              }}
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear', repeatDelay: 1 }}
            />

            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div
                  key="loading"
                  className="flex items-center gap-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.div
                    className="h-4 w-4 rounded-full border-2 border-white border-t-transparent"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                  />
                  <span>Signing in…</span>
                </motion.div>
              ) : (
                <motion.div
                  key="idle"
                  className="flex items-center gap-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <GithubIcon size={16} />
                  <span>Continue with GitHub</span>
                  <ArrowRight size={14} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>

          {/* Error message */}
          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                className="text-xs text-center"
                style={{ color: 'var(--color-error)' }}
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Footer note */}
        <motion.p
          className="text-center text-xs"
          style={{ color: 'var(--color-text-muted)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          Personal workspace — single account only
        </motion.p>
      </div>
    </motion.div>
  );
}
