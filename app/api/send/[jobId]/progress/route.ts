import { NextResponse } from 'next/server';
import * as sendJobs from '@/lib/server/sendJobs';
import { requireWorkspaceId } from '@/lib/server/requestWorkspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const workspaceId = await requireWorkspaceId();
  const { jobId } = await params;
  const job = sendJobs.getJob(workspaceId, jobId);
  if (!job) return NextResponse.json({ error: 'לא נמצאה משימת שליחה' }, { status: 404 });
  return NextResponse.json(job);
}
