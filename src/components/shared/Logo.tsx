'use client';

import { motion } from 'framer-motion';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

const sizes = {
  sm: { icon: 20, text: 'text-sm' },
  md: { icon: 24, text: 'text-base' },
  lg: { icon: 32, text: 'text-xl' },
};

export function Logo({ size = 'md', showText = true }: LogoProps) {
  const { icon, text } = sizes[size];

  return (
    <div className="flex items-center gap-2.5 select-none">
      {/* Animated Icon Mark */}
      <motion.div
        className="relative flex items-center justify-center rounded-lg shrink-0"
        style={{
          width: icon + 8,
          height: icon + 8,
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          boxShadow: '0 0 16px rgba(99,102,241,0.4)',
        }}
        whileHover={{ scale: 1.05, boxShadow: '0 0 24px rgba(99,102,241,0.6)' }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      >
        {/* D letter mark */}
        <svg
          width={icon * 0.65}
          height={icon * 0.65}
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M2 2h5c3.314 0 6 2.686 6 6s-2.686 6-6 6H2V2z"
            fill="white"
            fillOpacity="0.95"
          />
          <path
            d="M5.5 5.5h1.5c1.657 0 3 1.343 3 3s-1.343 3-3 3H5.5V5.5z"
            fill="white"
            fillOpacity="0.3"
          />
        </svg>

        {/* Animated pulse ring */}
        <motion.div
          className="absolute inset-0 rounded-lg"
          style={{ border: '1px solid rgba(139,92,246,0.5)' }}
          animate={{ opacity: [0.5, 0, 0.5], scale: [1, 1.15, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>

      {showText && (
        <div className="flex flex-col leading-none">
          <span
            className={`font-semibold tracking-tight ${text}`}
            style={{ color: 'var(--color-text-primary)' }}
          >
            DevMind{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, #6366f1, #a78bfa)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              AI
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
