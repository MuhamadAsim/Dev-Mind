import type { Metadata } from 'next';
import { WorkspaceShell } from '@/components/layout/WorkspaceShell';
import { APP_META } from '@/lib/constants';

export const metadata: Metadata = {
  title: `Workspace — ${APP_META.NAME}`,
  description: 'Your personal AI engineering workspace',
};

export default function WorkspacePage() {
  return <WorkspaceShell />;
}
//