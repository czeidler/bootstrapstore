export type VFSEntry =
  | { type: "dir" | "repo"; name: string; content: VFSDir }
  | { type: "file"; name: string; content: VFSFile };

export type VFSDir = {
  list(): Promise<VFSEntry[]>;
};

export type VFSFile = {
  read(): Promise<Uint8Array>;
  stats(): Promise<{
    size: number;
    creationTime: number;
    modificationTime: number;
  }>;
};
