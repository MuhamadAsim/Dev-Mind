// Root / page — server-side redirect based on session cookie
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { COOKIE_KEYS, ROUTES } from '@/lib/constants';

export default async function RootPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(COOKIE_KEYS.SESSION);

  if (session) {
    redirect(ROUTES.WORKSPACE);
  } else {
    redirect(ROUTES.LOGIN);
  }
}
