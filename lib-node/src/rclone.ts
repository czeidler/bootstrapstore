import util from "node:util";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { exec as execRaw } from "child_process";
import JSZip from "jszip";
import { Agent } from "node:https";
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

export async function rclone(command: string, args: string[]) {
  const rcloneBin = await findOrDownloadRclone();
  if (rcloneBin === undefined) {
    throw Error("rclone not found");
  }
  try {
    const result = await exec(
      `${rcloneBin} ${command}${args.length > 0 ? " " : ""}${args.join(" ")}`
    );
    console.log(result);
  } catch (e) {
    console.error(e);
  }
}
