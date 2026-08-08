'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import NumberFlow from '@number-flow/react';
import { toast } from 'sonner';
import type { SendJob } from '@/lib/types';
import { api, useApp } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { XIcon } from '@/components/icons';

export function SendProgress() {
  const job = useApp((s) => s.job);
  const setJob = useApp((s) => s.setJob);
  const refreshGuests = useApp((s) => s.refreshGuests);
  const [showFailures, setShowFailures] = React.useState(false);

  const jobId = job?.id ?? null;
  const running = job?.status === 'running';

  React.useEffect(() => {
    if (!jobId || !running) return;
    let cancelled = false;

    const timer = setInterval(async () => {
      try {
        const next = await api<SendJob>(`/api/send/${jobId}/progress`);
        if (cancelled) return;
        setJob(next);
        if (next.status === 'done') {
          refreshGuests();
          toast.success(
            next.failed.length === 0
              ? `כל ${next.sent} ההזמנות נשלחו 🎉`
              : `נשלחו ${next.sent} הזמנות, ${next.failed.length} נכשלו`
          );
        }
      } catch {
        /* transient - the next tick retries */
      }
    }, 1500);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [jobId, running, setJob, refreshGuests]);

  const done = job ? job.sent + job.failed.length : 0;
  const percent = job && job.total ? Math.round((done / job.total) * 100) : 0;

  return (
    <AnimatePresence>
      {job && (
        <motion.div
          // Enters and exits along the same path — down and out the way it came.
          initial={{ y: '110%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '110%', opacity: 0 }}
          transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
          className="fixed inset-x-0 bottom-0 z-30 px-3 pb-3"
        >
          <div className="card mx-auto max-w-3xl overflow-hidden border-brand/25 bg-surface/85 p-4 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5 text-sm font-medium">
                  <NumberFlow value={job.sent} className="tabular-nums" />
                  <span className="text-muted">מתוך {job.total} נשלחו</span>
                  {job.failed.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowFailures((v) => !v)}
                      className="text-[0.8125rem] text-bad underline underline-offset-2"
                    >
                      {job.failed.length} נכשלו
                    </button>
                  )}
                </div>
                <p className="truncate text-[0.8125rem] text-muted">
                  {job.status === 'done'
                    ? 'השליחה הסתיימה'
                    : job.current
                      ? `שולח כעת אל ${job.current}…`
                      : 'מתחיל…'}
                </p>
              </div>

              {job.status === 'done' && (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="סגירת סיכום השליחה"
                  onClick={() => setJob(null)}
                >
                  <XIcon className="size-4" />
                </Button>
              )}
            </div>

            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-brand transition-[width] duration-500 ease-snap"
                style={{ width: `${percent}%` }}
              />
            </div>

            <AnimatePresence initial={false}>
              {showFailures && job.failed.length > 0 && (
                <motion.ul
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
                  className="mt-3 max-h-40 overflow-y-auto text-[0.8125rem] text-muted"
                >
                  {job.failed.map((failure, i) => (
                    <li key={`${failure.phone}-${i}`} className="border-t border-line py-1.5">
                      <span className="text-ink">{failure.name}</span>{' '}
                      <span dir="ltr">({failure.phone})</span> — {failure.reason}
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
