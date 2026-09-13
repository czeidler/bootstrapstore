import util from "node:util";
import { exec as execRaw } from "child_process";
import { SSHConnectionInfo } from "lib";

const exec = util.promisify(execRaw);

export class Restic {
  static async backup(
    connection: Omit<SSHConnectionInfo, "id">,
    resticTargetRepoPath: string,
    paths: string[],
  ): Promise<boolean> {
    try {
      await exec(
        `restic -r sftp:${connection.user}@${connection.host}:${resticTargetRepoPath} --ignore-inode --verbose backup ${paths.join(" ")}`,
      );

      return true;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      return false;
    }
  }
}
