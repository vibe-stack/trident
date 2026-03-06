import type { WorkerTask } from "./tasks";

export type WorkerJobStatus = "queued" | "running" | "completed";

export type WorkerJob = {
  id: string;
  label: string;
  status: WorkerJobStatus;
  task: WorkerTask;
};

type Listener = (jobs: WorkerJob[]) => void;

export type WorkerTaskManager = {
  enqueue: (task: WorkerTask, label: string, durationMs?: number) => string;
  getJobs: () => WorkerJob[];
  subscribe: (listener: Listener) => () => void;
};

export function createWorkerTaskManager(): WorkerTaskManager {
  let counter = 0;
  const jobs = new Map<string, WorkerJob>();
  const listeners = new Set<Listener>();

  const emit = () => {
    const snapshot = Array.from(jobs.values());
    listeners.forEach((listener) => {
      listener(snapshot);
    });
  };

  return {
    enqueue(task, label, durationMs = 900) {
      const id = `job:${counter++}`;
      jobs.set(id, {
        id,
        label,
        status: "queued",
        task
      });
      emit();

      queueMicrotask(() => {
        const job = jobs.get(id);

        if (!job) {
          return;
        }

        job.status = "running";
        emit();

        window.setTimeout(() => {
          const runningJob = jobs.get(id);

          if (!runningJob) {
            return;
          }

          runningJob.status = "completed";
          emit();

          window.setTimeout(() => {
            jobs.delete(id);
            emit();
          }, 900);
        }, durationMs);
      });

      return id;
    },
    getJobs() {
      return Array.from(jobs.values());
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(Array.from(jobs.values()));

      return () => {
        listeners.delete(listener);
      };
    }
  };
}
