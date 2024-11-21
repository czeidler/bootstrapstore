import { Link } from "react-router-dom";
import { SessionUser, useSessionStore } from "./session-store";
import { trpc } from "./trpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getManifest, Manifest, mutateFiles } from "./storage";
import { useState } from "react";

function useManifest(user: SessionUser | undefined) {
  const utils = trpc.useUtils();
  return useQuery({
    enabled: user !== undefined,
    queryKey: ["manifest"],
    queryFn: () => {
      if (!user) {
        return undefined;
      }
      return getManifest(utils.client, user);
    },
  });
}

function useMutateFiles() {
  const utils = trpc.useUtils();
  const queryClient = useQueryClient();
  return useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manifest"] });
    },
    mutationFn: ({
      user,
      manifest,
      updates,
      deleteNames,
    }: {
      user: SessionUser;
      manifest: Manifest;
      updates: Record<string, Uint8Array>;
      deleteNames: string[];
    }) => {
      return mutateFiles(utils.client, user, manifest, updates, deleteNames);
    },
  });
}

export const Files = () => {
  const { user, setUser } = useSessionStore();
  const { data: manifest } = useManifest(user);
  const [newFileName, setNewFileName] = useState<string | null>();
  const { mutate: mutateFiles, isPending } = useMutateFiles();
  return (
    <>
      <h1>Hello {user?.email ? user?.email : ""}</h1>
      <Link to="/" onClick={() => setUser(undefined)}>
        Logout
      </Link>

      <h2>Files</h2>
      {Object.entries(manifest?.files ?? {}).map(([name]) => (
        <div key={name}>{name}</div>
      ))}

      <h2>Uploads</h2>
      <div>
        Name:
        <input
          value={newFileName ?? ""}
          onChange={(e) => setNewFileName(e.target.value)}
        />
      </div>
      <button
        disabled={
          isPending ||
          user == undefined ||
          manifest === undefined ||
          !newFileName
        }
        onClick={async () =>
          mutateFiles({
            user: user!,
            manifest: manifest!,
            updates: { [newFileName!]: Buffer.from("dummy content", "base64") },
            deleteNames: [],
          })
        }
      >
        Upload
      </button>
    </>
  );
};
