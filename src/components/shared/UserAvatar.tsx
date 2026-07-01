'use client';

import { LogOut, Settings, User, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCurrentUser, useLogout } from '@/store/hooks/useAuth';
import { ROUTES } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface UserAvatarProps {
  collapsed?: boolean;
}

export function UserAvatar({ collapsed = false }: UserAvatarProps) {
  const user = useCurrentUser();
  const logout = useLogout();
  const router = useRouter();

  if (!user) return null;

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleLogout = () => {
    logout();
    router.push(ROUTES.LOGIN);
  };

  return (
    <DropdownMenu>
      {/* FIX: motion.button passed via `render`, not as a child — stops
          DropdownMenuTrigger from rendering a second nested <button>. */}
      <DropdownMenuTrigger
        render={
          <motion.button
            type="button"
            className={cn(
              'flex items-center gap-2.5 rounded-lg p-1.5 w-full cursor-pointer',
              'focus-visible:outline-none text-left'
            )}
            style={{
              border: '1px solid transparent',
              color: 'var(--color-text-secondary)',
            }}
            whileHover={{
              background: 'var(--color-bg-hover)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.15 }}
            aria-label="User menu"
          >
            {/* Avatar */}
            <div
              className="relative h-7 w-7 rounded-full overflow-hidden shrink-0 ring-1"
              style={{ '--tw-ring-color': 'var(--color-accent-border)' } as React.CSSProperties}
            >
              {user.avatarUrl ? (
                <Image
                  src={user.avatarUrl}
                  alt={user.name}
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div
                  className="h-full w-full flex items-center justify-center text-xs font-semibold text-white"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                >
                  {initials}
                </div>
              )}
            </div>

            {!collapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                    {user.name}
                  </p>
                  <p className="text-[10px] truncate" style={{ color: 'var(--color-text-muted)' }}>
                    {user.githubUsername ? `@${user.githubUsername}` : user.email}
                  </p>
                </div>
                <ChevronDown size={12} className="shrink-0" />
              </>
            )}
          </motion.button>
        }
      />

      <DropdownMenuContent
        side="top"
        align="start"
        className="w-52"
        style={{
          background: 'var(--color-bg-elevated)',
          border: '1px solid var(--color-border)',
        }}
      >
        <DropdownMenuLabel className="font-normal py-2">
          <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
            {user.name}
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {user.email}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator style={{ background: 'var(--color-border)' }} />
        <DropdownMenuItem className="gap-2 cursor-pointer" style={{ color: 'var(--color-text-secondary)' }}>
          <User size={13} />
          <span>Profile</span>
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2 cursor-pointer" style={{ color: 'var(--color-text-secondary)' }}>
          <Settings size={13} />
          <span>Settings</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator style={{ background: 'var(--color-border)' }} />
        <DropdownMenuItem
          className="gap-2 cursor-pointer"
          style={{ color: 'var(--color-error)' }}
          onClick={handleLogout}
        >
          <LogOut size={13} />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}