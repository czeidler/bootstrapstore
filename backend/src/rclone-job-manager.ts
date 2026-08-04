import {
  FSRemoteConnection,
  RCloneJob,
  RCloneJobStatus,
  RCloneRCCommands,
} from "lib-node/src/rclone";

export class RCloneJobManager {
  // remote to job
  private ongoingJobs: Map<
    string,
    { job: RCloneJob; status?: { finished: boolean } }
  > = new Map();

  private addJob(syncId: string, job: RCloneJob) {
    this.ongoingJobs.set(syncId, { job });
  }

  async syncDir(
    syncId: string,
    from: { path: string; remote?: FSRemoteConnection },
    to: { path: string; remote?: FSRemoteConnection },
  ) {
    const job = await RCloneRCCommands.copyAsync(from, to);
    this.addJob(syncId, job);
  }

  async jobStatus(syncId: string): Promise<RCloneJobStatus | undefined> {
    const existing = this.ongoingJobs.get(syncId);
    if (existing === undefined) {
      return undefined;
    }
    const status = await RCloneRCCommands.jobStatus(existing.job.jobid);
    if (status.finished) {
      this.ongoingJobs.set(syncId, { ...existing, status: { finished: true } });
    }
    return status;
  }
}
