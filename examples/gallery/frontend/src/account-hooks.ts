import { useMutation, useQuery } from "@tanstack/react-query";
import {
  MetadataRepository,
  RemoteConnection,
  RemoteInfo,
  LocationInfo,
  SyncConfig,
  DirectoryLocationInfo,
} from "lib/src/main-repo";

import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient();

export const useCreateRemote = (metadataRepo: MetadataRepository) =>
  useMutation({
    mutationFn: async (remoteInfo: RemoteInfo) => {
      await metadataRepo.addRemote(remoteInfo);
      await metadataRepo.snapshot();
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["remotes"],
      }),
  });

export const useRemotes = (metadataRepo: MetadataRepository | undefined) =>
  useQuery({
    queryKey: ["remotes"],
    queryFn: async () => {
      const repoList = await metadataRepo?.listRemotes();
      const repos = await Promise.all(
        repoList
          ?.filter((it) => it !== undefined)
          .map((it) => metadataRepo?.getRemote(it.name)) ?? []
      );
      return repos.filter((it): it is RemoteInfo => it !== undefined);
    },
    enabled: metadataRepo !== undefined,
  });

export const useConnections = (
  metadataRepo: MetadataRepository,
  remoteId: string
) =>
  useQuery({
    queryKey: ["remotes", remoteId, "connections"],
    queryFn: async () => {
      const repoList = await metadataRepo.listConnections(remoteId);
      const repos = await Promise.all(
        repoList
          ?.filter((it) => it !== undefined)
          .map((it) => metadataRepo.readConnection(remoteId, it.name)) ?? []
      );
      return repos.filter((it) => it !== undefined);
    },
  });

export const useUpsertConnection = (
  metadataRepo: MetadataRepository,
  remoteId: string
) =>
  useMutation({
    mutationFn: async (connection: RemoteConnection) => {
      await metadataRepo.writeConnection(remoteId, connection);
      await metadataRepo.snapshot();
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["remotes", remoteId, "connections"],
      }),
  });

export const useCreateChildRepo = (
  metadataRepo: MetadataRepository,
  remoteId: string,
  repoName: string | undefined
) =>
  useMutation({
    mutationFn: () => metadataRepo.createChild(remoteId, repoName),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["remotes", remoteId, "locations"],
      }),
  });

export const useLocations = (
  metadataRepo: MetadataRepository,
  remoteId: string
) =>
  useQuery({
    queryKey: ["remotes", remoteId, "locations"],
    queryFn: async () => {
      const repoList = await metadataRepo.listLocations(remoteId);
      const repos = await Promise.all(
        repoList
          ?.filter((it) => it !== undefined)
          .map((it) => metadataRepo.readLocation(remoteId, it.name)) ?? []
      );
      return repos.filter((it): it is LocationInfo => it !== undefined);
    },
  });

export const useCreateCheckout = (
  metadataRepo: MetadataRepository,
  remoteId: string
) =>
  useMutation({
    mutationFn: async (checkoutInfo: DirectoryLocationInfo) => {
      await metadataRepo.writeLocation(remoteId, checkoutInfo);
      await metadataRepo.snapshot();
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["remotes", remoteId, "locations"],
      }),
  });

export const useCreateSync = (
  metadataRepo: MetadataRepository,
  remoteId: string
) =>
  useMutation({
    mutationFn: async (syncInfo: SyncConfig) => {
      await metadataRepo.writeSync(remoteId, syncInfo);
      await metadataRepo.snapshot();
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["remotes", remoteId, "syncs"],
      }),
  });

export const useSyncs = (metadataRepo: MetadataRepository, remoteId: string) =>
  useQuery({
    queryKey: ["remotes", remoteId, "syncs"],
    queryFn: async () => {
      const repoList = await metadataRepo.listSyncs(remoteId);
      const repos = await Promise.all(
        repoList
          ?.filter((it) => it !== undefined)
          .map((it) => metadataRepo.readSync(remoteId, it.name)) ?? []
      );
      return repos.filter((it): it is SyncConfig => it !== undefined);
    },
  });
