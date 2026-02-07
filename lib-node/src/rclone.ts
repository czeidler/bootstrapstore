import util from "node:util";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { exec as execRaw } from "child_process";
import JSZip from "jszip";
import { Agent } from "node:https";
import { ChildProcess, spawn } from "node:child_process";
import {
  ExhaustiveCheckError,
  shortId,
  ConnectionInfo,
  VFSDir,
  VFSEntry,
  VFSFile,
} from "lib";
import { arrayToString } from "lib/src/utils";

const exec = util.promisify(execRaw);

async function isRcloneInstalledOnHost(): Promise<boolean> {
  try {
    await exec("which rclone");
    return true;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (e) {
    return false;
  }
}

const getRcloneTarget = () => {
  switch (process.platform) {
    case "cygwin":
    case "win32":
      return "windows";
    case "linux":
      return "linux";
    case "freebsd":
      return "freebsd";
    case "netbsd":
      return "netbsd";
    case "openbsd":
      return "openbsd";
    case "sunos":
      return "solaris";
    case "darwin":
      return "osx";
  }
  throw Error(`Unsupported rClone platform: ${process.platform}`);
};

const getRcloneArch = () => {
  switch (process.arch) {
    case "arm":
      return "arm";
    case "x64":
      return "amd64";
  }
  throw Error(`Unsupported rClone arch: ${process.arch}`);
};

const rcloneDownloadDir = "rclone";

function findDownloadedRclone() {
  const dir = fs.readdirSync(rcloneDownloadDir);
  for (const entry of dir) {
    const bin = path.join(
      rcloneDownloadDir,
      entry,
      getRcloneTarget() === "windows" ? "rclone.exe" : "rclone",
    );
    if (fs.existsSync(bin)) {
      return bin;
    }
  }
  return undefined;
}
/** Returns path to downloaded  */
async function downloadRclone() {
  const binaryName = `rclone-current-${getRcloneTarget()}-${getRcloneArch()}`;
  const downloadUrl = `https://downloads.rclone.org/${binaryName}.zip`;
  const zipBundle = await fetch(downloadUrl, {
    agent: new Agent({
      family: 4, // Forces IPv4
    }),
  });

  const zip = new JSZip();
  const result = await zip.loadAsync(zipBundle.arrayBuffer());
  for (const filename of Object.keys(result.files)) {
    const file = result.files[filename];
    const fullPath = path.join(rcloneDownloadDir, filename);

    if (file.dir) {
      fs.mkdirSync(fullPath, { recursive: true });
    } else if (/rclone(\.exe)?$/.test(file.name)) {
      const content = await file.async("nodebuffer");
      fs.writeFileSync(fullPath, content);
      fs.chmodSync(fullPath, 755);
      break;
    }
  }
}

let rclonePath: string | undefined;
export const findOrDownloadRclone = async (force?: boolean) => {
  if (rclonePath !== undefined && !force) {
    return rclonePath;
  }
  rclonePath = (await isRcloneInstalledOnHost()) ? "rclone" : undefined;
  if (rclonePath) {
    console.log("> Use pre-installed rclone");
    return rclonePath;
  }

  rclonePath = findDownloadedRclone();
  if (rclonePath !== undefined) {
    console.log(`> Use rclone: ${rclonePath}`);
    return rclonePath;
  }
  console.log("> Download rclone");
  await downloadRclone();
  console.log("> Download finished");
  rclonePath = findDownloadedRclone();
  return rclonePath;
};

type RunningRClone = {
  process: ChildProcess;
  user: string;
  password: string;
  host: string;
};
let runningRClone: Promise<RunningRClone> | undefined;
const startServer = async (rcloneBin: string): Promise<RunningRClone> => {
  if (runningRClone !== undefined) {
    return runningRClone;
  }
  const user = "bsuser";
  const password = shortId();
  console.info(`> Start rclone rcd`);
  const process = spawn(
    rcloneBin,
    ["rcd", "--rc-user", user, "--rc-pass", password],
    {
      stdio: "pipe",
      detached: false,
      windowsHide: true,
    },
  );

  runningRClone = new Promise((res, rej) => {
    const timeout = setTimeout(() => {
      process.kill("SIGKILL");
      runningRClone = undefined;
      rej(Error("Timeout starting rclone server"));
    }, 10000);
    process.stdio[2].on("data", (data: Uint8Array) => {
      const line = arrayToString(data);
      const match = /Serving remote control on (.*)/.exec(line);
      if (match !== null) {
        const address = match[1];
        const url = URL.parse(address);
        if (url?.host === undefined) {
          rej(Error("Unexpected local rclone server url"));
          return;
        }
        clearTimeout(timeout);
        console.info(`> rclone local server started at: ${url.host}`);
        res({
          process,
          user,
          password,
          host: url.host,
        });
      }
    });
    process.on("close", () => {
      runningRClone = undefined;
    });
    process.on("exit", () => {
      runningRClone = undefined;
    });
  });
  return runningRClone;
};

export async function rcloneRC(
  command: string,
  args: string[],
): Promise<string> {
  const rcloneBin = await findOrDownloadRclone();
  if (rcloneBin === undefined) {
    throw Error("rclone not found");
  }
  const rCloneServer = await startServer(rcloneBin);
  try {
    const start = Date.now();
    const result = await exec(
      `${rcloneBin} rc ${command} ${args.join(" ")} --rc-user ${
        rCloneServer.user
      } --rc-pass ${rCloneServer.password} --rc-addr ${rCloneServer.host}`,
    );
    console.log(`> rclone rc ${command} finished in ${Date.now() - start}ms`);
    return result.stdout;
  } catch (e: unknown) {
    if ((e as Error).message.includes("connection failed")) {
      console.warn("Reset rclone server");
      runningRClone = undefined;
    }
    console.error(e);
    throw e;
  }
}

type FSRemoteConnection = Omit<ConnectionInfo, "id">;

function remoteToRClone(connection: FSRemoteConnection | undefined): string {
  if (connection === undefined) {
    return "";
  }
  switch (connection.type) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    case "sftp": {
      const { host, user, keyPem } = connection;
      return `:sftp,host=${host},user=${user},key_pem="${keyPem.replace(
        /\n/g,
        "\\n",
      )}":`;
    }
    default:
      throw new ExhaustiveCheckError(connection.type);
  }
}

type RCloneLsResponse = {
  list: {
    IsDir: boolean;
    MimeType: string;
    ModTime: string;
    Name: string;
    Path: string;
    Size: number;
  }[];
};

type RCloneJob = { jobid: number };

type RCloneJobStats = {
  bytes: number;
  checks: number;
  deletedDirs: number;
  deletes: number;
  elapsedTime: number;
  errors: number;
  eta: number | null;
  fatalError: boolean;
  renames: number;
  retryError: boolean;
  serverSideCopies: number;
  serverSideCopyBytes: number;
  serverSideMoveBytes: number;
  serverSideMoves: number;
  speed: number;
  totalBytes: number;
  totalChecks: number;
  totalTransfers: number;
  transferTime: number;
  transfers: number;
  transferring?: {
    bytes: number;
    /** Destination path */
    dstFs: string;
    eta: number | null;
    group: string;
    /** File name */
    name: string;
    percentage: number;
    size: number;
    speed: number;
    speedAvg: number;
    /** Source path */
    srcFs: string;
  }[];
};

type RCloneCheck = {
  differ: unknown[];
  error: unknown[];
  hashType: "md5";
  // Missing paths
  missingOnDst: string[];
  missingOnSrc: string[];
  status: string;
  success: boolean;
};

type RCloneJobStatus<Output = Record<string, unknown>> = {
  duration: number;
  endTime: string;
  error: string;
  finished: boolean;
  group: `job/${number}`;
  id: number;
  output: Output;
  startTime: string;
  success: boolean;
};

export class RCloneVFSDir implements VFSDir {
  constructor(
    private path: string,
    private remote: FSRemoteConnection | undefined,
  ) {}

  async list(): Promise<VFSEntry[]> {
    const result = await rcloneRC("operations/list", [
      "--config=/dev/null",
      `fs=${remoteToRClone(this.remote)}${this.path}`,
      `remote=""`,
      "--max-depth",
      "1",
    ]);
    const response = JSON.parse(result) as RCloneLsResponse;
    return response.list.map((it) => {
      return it.IsDir
        ? ({
            type: "dir",
            name: it.Name,
            content: new RCloneVFSDir(
              path.join(this.path, it.Name),
              this.remote,
            ),
          } satisfies VFSEntry)
        : ({
            type: "file",
            name: it.Name,
            content: new RCloneVFSFile({
              size: it.Size,
              creationTime: 0,
              modificationTime: new Date(it.ModTime).getTime(),
            }),
          } satisfies VFSEntry);
    });
  }
}

class RCloneVFSFile implements VFSFile {
  constructor(
    private fileStats: {
      size: number;
      creationTime: number;
      modificationTime: number;
    },
  ) {}
  read(): Promise<Uint8Array> {
    throw new Error("Method not implemented.");
  }

  async stats(): Promise<{
    size: number;
    creationTime: number;
    modificationTime: number;
  }> {
    return this.fileStats;
  }
}

export class RCloneFSInterface {
  async operationsCheck(
    src: { path: string; remote: FSRemoteConnection | undefined },
    destination: { path: string; remote: FSRemoteConnection | undefined },
  ) {
    const result = await rcloneRC("operations/check", [
      "--config=/dev/null",
      `srcFs=${remoteToRClone(src.remote)}${src.path}`,
      `srcRemote=""`,
      `dstFs=${remoteToRClone(destination.remote)}${destination.path}`,
      `dstRemote=""`,
    ]);
    return JSON.parse(result) as RCloneCheck;
  }

  async copyAsync(
    src: { path: string; remote: FSRemoteConnection | undefined },
    destination: { path: string; remote: FSRemoteConnection | undefined },
  ): Promise<RCloneJob> {
    const result = await rcloneRC("sync/copy", [
      "--config=/dev/null",
      `srcFs=${remoteToRClone(src.remote)}${src.path}`,
      `srcRemote=""`,
      `dstFs=${remoteToRClone(destination.remote)}${destination.path}`,
      `dstRemote=""`,
      "_async=true",
    ]);
    return JSON.parse(result) as RCloneJob;
  }

  async jobStats(job: number): Promise<RCloneJobStats> {
    const result = await rcloneRC("core/stats", [
      "--config=/dev/null",
      `group=job/${job}`,
    ]);
    return JSON.parse(result) as RCloneJobStats;
  }

  async jobStatus(job: number): Promise<RCloneJobStatus> {
    const result = await rcloneRC("job/status", [
      "--config=/dev/null",
      `jobid=${job}`,
    ]);
    return JSON.parse(result) as RCloneJobStatus;
  }
}
