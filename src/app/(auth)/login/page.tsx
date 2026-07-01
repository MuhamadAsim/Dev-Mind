import type { Metadata } from 'next';
import { AnimatedBackground } from '@/components/shared/AnimatedBackground';
import { LoginCard } from '@/components/auth/LoginCard';
import { APP_META } from '@/lib/constants';

export const metadata: Metadata = {
  title: `Sign in — ${APP_META.NAME}`,
  description: APP_META.TAGLINE,
};

export default function LoginPage() {
  return (
    <main
      id="login-page"
      className="relative min-h-dvh flex items-center justify-center p-4 overflow-hidden"
      style={{ background: 'var(--color-bg-base)' }}
    >
      {/* Animated mesh gradient background */}
      <AnimatedBackground />

      {/* Login card */}
      <div className="relative z-10 w-full flex justify-center">
        <LoginCard />
      </div>
    </main>
  );
}
