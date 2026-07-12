'use client';

import type { DocumentStatus } from '@/server/knowledge/types';

interface DocumentStatusBadgeProps {
  status: DocumentStatus;
  className?: string;
}

const STATUS_CONFIG: Record<
  DocumentStatus,
  { label: string; bg: string; text: string; dot: string; pulse: boolean }
> = {
  pending: {
    label: 'Pending',
    bg: 'rgba(100, 116, 139, 0.15)',
    text: '#94a3b8',
    dot: '#64748b',
    pulse: false,
  },
  processing: {
    label: 'Processing',
    bg: 'rgba(245, 158, 11, 0.15)',
    text: '#f59e0b',
    dot: '#f59e0b',
    pulse: true,
  },
  ready: {
    label: 'Ready',
    bg: 'rgba(34, 197, 94, 0.15)',
    text: '#22c55e',
    dot: '#22c55e',
    pulse: false,
  },
  error: {
    label: 'Error',
    bg: 'rgba(239, 68, 68, 0.15)',
    text: '#ef4444',
    dot: '#ef4444',
    pulse: false,
  },
};

export function DocumentStatusBadge({ status, className = '' }: DocumentStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${className}`}
      style={{ background: config.bg, color: config.text }}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full shrink-0 ${config.pulse ? 'animate-pulse' : ''}`}
        style={{ background: config.dot }}
      />
      {config.label}
    </span>
  );
}
