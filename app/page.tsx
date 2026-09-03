import { cookies } from 'next/headers';
import { AppShell } from '@/components/app-shell';
import { readSession } from '@/lib/auth';

export default async function Home() {
  const session = await readSession((await cookies()).get('session')?.value);
  return <AppShell username={session?.username ?? ''} />;
}
