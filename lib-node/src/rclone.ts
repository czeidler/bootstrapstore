import util from "node:util";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { exec as execRaw } from "child_process";
import JSZip from "jszip";
import { Agent } from "node:https";
import { ChildProcess, spawn } from "node:child_process";
import { shortId } from "lib/src/utils";

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
      getRcloneTarget() === "windows" ? "rclone.exe" : "rclone"
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
    }
  );

  runningRClone = new Promise((res, rej) => {
    const timeout = setTimeout(() => {
      process.kill("SIGKILL");
      runningRClone = undefined;
      rej(Error("Timeout starting rclone server"));
    }, 10000);
    process.stdio[2].on("data", (data: Buffer) => {
      const line = data.toString();
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

export async function rclone(command: string, args: string[]): Promise<string> {
  const rcloneBin = await findOrDownloadRclone();
  if (rcloneBin === undefined) {
    throw Error("rclone not found");
  }
  const rCloneServer = await startServer(rcloneBin);
  try {
    const start = Date.now();
    const result = await exec(
      //`${rcloneBin} ${command}${args.length > 0 ? " " : ""}${args.join(" ")}`
      `${rcloneBin} rc core/command --json '${JSON.stringify({
        command,
        arg: args,
      })}' --rc-user ${rCloneServer.user} --rc-pass ${
        rCloneServer.password
      } --rc-addr ${rCloneServer.host}`
    );
    console.log(`> rclone command finished in ${Date.now() - start}ms`);
    console.log(result);
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
