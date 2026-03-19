import type { WorkerJob } from "@ggez/workers";
import { Loader2Icon, MoonStarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type JobStatusProps = {
  jobs: WorkerJob[];
};

export function JobStatus({ jobs }: JobStatusProps) {
  const activeJobs = jobs.filter((job) => job.status !== "completed");
  const hasActiveJobs = activeJobs.length > 0;

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            className={cn(
              "pointer-events-auto inline-flex h-6 items-center gap-1.5 rounded-full px-2 text-[10px] tracking-[0.08em] transition-colors",
              hasActiveJobs ? "text-foreground/70 hover:bg-white/5" : "text-foreground/42 hover:bg-white/5"
            )}
            type="button"
          >
            {hasActiveJobs ? <Loader2Icon className="size-3 animate-spin" /> : <MoonStarIcon className="size-3" />}
            <span>{hasActiveJobs ? `${activeJobs.length} active` : "idle"}</span>
          </button>
        }
      />
      <PopoverContent
        align="end"
        className="w-72 rounded-2xl bg-popover/96 p-2 shadow-[0_18px_48px_rgba(4,12,10,0.46)] backdrop-blur-xl"
        side="top"
      >
        <div className="space-y-2">
          <div className="px-1 text-[10px] font-medium tracking-[0.18em] text-foreground/42 uppercase">Jobs</div>
          {hasActiveJobs ? (
            <div className="space-y-1">
              {activeJobs.map((job) => (
                <div
                  className="flex items-center justify-between rounded-xl bg-white/4 px-2.5 py-2 text-[11px] text-foreground/60"
                  key={job.id}
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-foreground/78">{job.label}</div>
                    <div className="truncate text-[10px] text-foreground/34">
                      {job.task.worker} / {job.task.task}
                    </div>
                  </div>
                  <span className="ml-3 shrink-0 capitalize text-foreground/38">{job.status}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl bg-white/3 px-2.5 py-3 text-[11px] text-foreground/44">No active jobs.</div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
