import { cookies } from 'next/headers';
import { readSession } from '@/lib/auth';
import { isSessionValid } from '@/lib/server/users';
import { bootstrapWorkspaceFromLegacy } from '@/lib/server/dataDir';

/**
 * The middleware protects every application API route. This helper keeps the
 * workspace boundary explicit at the route-to-storage boundary as well, so a
 * route can never accidentally use anonymous shared state.
 */
export async function requireWorkspaceId(): Promise<string> {
  const session = await readSession((await cookies()).get('session')?.value);
  if (!session || !isSessionValid(session.username, session.role, session.issuedAt)) {
    throw new Error('נדרשת התחברות מחדש');
  }
  // The pre-beta install had one shared data directory. Only its administrator
  // can claim that legacy workspace, and the migration is copy-only/idempotent.
  if (session.role === 'admin' && session.username === process.env.ADMIN_USERNAME) {
    bootstrapWorkspaceFromLegacy(session.username);
  }
  return session.username;
}
