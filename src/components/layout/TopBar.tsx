'use client';

import { forwardRef, useEffect, useState } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { useTheme } from 'next-themes';
import {
  PanelLeftOpen,
  PanelRightOpen,
  Settings,
  Cpu,
  ChevronDown,
} from 'lucide-react';
import { Logo } from '@/components/shared/Logo';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIsSidebarOpen, useToggleSidebar, useIsRepoPanelOpen, useToggleRepoPanel } from '@/store/hooks/useUI';

const PALETTES = {
  dark: {
    bgSurface: '#161b27',
    bgElevated: '#1e2433',
    border: 'rgba(255, 255, 255, 0.10)',
    accent: '#6366f1',
    accentBorder: 'rgba(99, 102, 241, 0.40)',
    accentMuted: 'rgba(99, 102, 241, 0.15)',
    textPrimary: '#ffffff',
    textMuted: '#94a3b8',
  },
  light: {
    bgSurface: '#ffffff',
    bgElevated: '#f8fafc',
    border: 'rgba(0, 0, 0, 0.10)',
    accent: '#6366f1',
    accentBorder: 'rgba(99, 102, 241, 0.40)',
    accentMuted: 'rgba(99, 102, 241, 0.15)',
    textPrimary: '#000000',
    textMuted: '#334155',
  },
};

export function TopBar() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Server and first client render both use the dark palette,
  // so there is nothing for React to diff against on hydration.
  // Only after mount do we know the real theme and can switch.
  const colors = mounted && resolvedTheme === 'light' ? PALETTES.light : PALETTES.dark;

  const isSidebarOpen = useIsSidebarOpen();
  const toggleSidebar = useToggleSidebar();
  const isRepoPanelOpen = useIsRepoPanelOpen();
  const toggleRepoPanel = useToggleRepoPanel();

  return (
    <header
      id="topbar"
      className="flex items-center justify-between px-3 shrink-0"
      style={{
        height: 'var(--topbar-height)',
        background: colors.bgSurface,
        borderBottom: `1px solid ${colors.border}`,
      }}
    >
      {/* Left: sidebar toggle + logo */}
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger
            render={
              <TopBarBtn
                onClick={toggleSidebar}
                active={isSidebarOpen}
                colors={colors}
                label={`${isSidebarOpen ? 'Collapse' : 'Expand'} sidebar (⌘B)`}
              >
                <PanelLeftOpen size={15} />
              </TopBarBtn>
            }
          />
          <TooltipContent side="bottom">
            {isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'} (⌘B)
          </TooltipContent>
        </Tooltip>

        {!isSidebarOpen && <Logo size="sm" />}
      </div>

      {/* Center: Model selector */}
      <motion.button
        type="button"
        className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs cursor-pointer"
        style={{
          background: colors.bgElevated,
          border: `1px solid ${colors.border}`,
          color: colors.textPrimary,
        }}
        whileHover={{
          borderColor: colors.accentBorder,
          color: colors.accent,
          background: colors.accentMuted,
        }}
        whileTap={{ scale: 0.98 }}
        aria-label="Select AI model"
        id="model-selector-btn"
      >
        <Cpu size={12} />
        <span className="font-medium">DevMind v1</span>
        <ChevronDown size={11} />
      </motion.button>

      {/* Right: Controls */}
      <div className="flex items-center gap-1.5">
        <ThemeToggle />

        <Tooltip>
          <TooltipTrigger
            render={
              <TopBarBtn colors={colors} label="Settings">
                <Settings size={15} />
              </TopBarBtn>
            }
          />
          <TooltipContent side="bottom">Settings</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <TopBarBtn
                onClick={toggleRepoPanel}
                active={isRepoPanelOpen}
                colors={colors}
                label={`${isRepoPanelOpen ? 'Close' : 'Open'} repository panel (⌘R)`}
              >
                <PanelRightOpen size={15} />
              </TopBarBtn>
            }
          />
          <TooltipContent side="bottom">
            {isRepoPanelOpen ? 'Close' : 'Open'} repo panel (⌘R)
          </TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}

interface TopBarBtnProps {
  onClick?: () => void;
  active?: boolean;
  label: string;
  children: React.ReactNode;
  colors: typeof PALETTES.dark;
}

type TopBarBtnMotionProps = Omit<HTMLMotionProps<'button'>, 'onClick'>;

const TopBarBtn = forwardRef<HTMLButtonElement, TopBarBtnProps & TopBarBtnMotionProps>((props, ref) => {
  const { onClick, active, label, children, colors, ...rest } = props;

  return (
    <motion.button
      ref={ref}
      type="button"
      onClick={onClick}
      className="flex items-center justify-center h-8 w-8 rounded-lg cursor-pointer"
      style={{
        background: active ? colors.accentMuted : 'transparent',
        border: active ? `1px solid ${colors.accentBorder}` : '1px solid transparent',
        color: active ? colors.accent : colors.textMuted,
      }}
      whileHover={{
        background: active ? colors.accentMuted : colors.bgElevated,
        borderColor: active ? colors.accentBorder : colors.border,
        color: active ? colors.accent : colors.textPrimary,
      }}
      whileTap={{ scale: 0.92 }}
      transition={{ duration: 0.15 }}
      aria-label={label}
      {...rest}
    >
      {children}
    </motion.button>
  );
});
TopBarBtn.displayName = 'TopBarBtn';