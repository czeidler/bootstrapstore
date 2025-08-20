import { useMutation, useQuery, QueryClient } from "@tanstack/react-query";
import {
  MetadataRepository,
  RemoteInfo,
  ProfileInfo,
  LocationInfo,
  SyncConfig,
  DirectoryLocationInfo,
} from "lib";

export const queryClient = new QueryClient();

export const useCreateRemote = (metadataRepo: MetadataRepository) =>
  useMutation({
    mutationFn: async (remoteInfo: ProfileInfo) => {
      await metadataRepo.addProfile(remoteInfo);
      await metadataRepo.snapshot();
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["remotes"],
      }),
  });

export const useProfiles = (metadataRepo: MetadataRepository | undefined) =>
  useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const repoList = await metadataRepo?.listProfile();
      const repos = await Promise.all(
        repoList
          ?.filter((it) => it !== undefined)
          .map((it) => metadataRepo?.getProfile(it.name)) ?? []
      );
      return repos.filter((it): it is ProfileInfo => it !== undefined);
    },
    enabled: metadataRepo !== undefined,
  });

export const useConnections = (
  metadataRepo: MetadataRepository,
  profileId: string
) =>
  useQuery({
    queryKey: ["profiles", profileId, "connections"],
    queryFn: async () => {
      const repoList = await metadataRepo.listRemotes(profileId);
      const repos = await Promise.all(
        repoList
          ?.filter((it) => it !== undefined)
          .map((it) => metadataRepo.readRemote(profileId, it.name)) ?? []
      );
      return repos.filter((it) => it !== undefined);
    },
  });

export const useUpsertConnection = (
  metadataRepo: MetadataRepository,
  profileId: string
) =>
  useMutation({
    mutationFn: async (remote: RemoteInfo) => {
      await metadataRepo.writeConnection(profileId, remote);
      await metadataRepo.snapshot();
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["profiles", profileId, "connections"],
      }),
  });

export const useCreateChildRepo = (
  metadataRepo: MetadataRepository,
  profileId: string,
  repoName: string | undefined
) =>
  useMutation({
    mutationFn: () => metadataRepo.createChild(profileId, repoName),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["profiles", profileId, "locations"],
      }),
  });

export const useLocations = (
  metadataRepo: MetadataRepository,
  profileId: string
) =>
  useQuery({
    queryKey: ["profiles", profileId, "locations"],
    queryFn: async () => {
      const repoList = await metadataRepo.listLocations(profileId);
      const repos = await Promise.all(
        repoList
          ?.filter((it) => it !== undefined)
          .map((it) => metadataRepo.readLocation(profileId, it.name)) ?? []
      );
      return repos.filter((it): it is LocationInfo => it !== undefined);
    },
  });

export const useCreateCheckout = (
  metadataRepo: MetadataRepository,
  profileId: string
) =>
  useMutation({
    mutationFn: async (checkoutInfo: DirectoryLocationInfo) => {
      await metadataRepo.writeLocation(profileId, checkoutInfo);
      await metadataRepo.snapshot();
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["profiles", profileId, "locations"],
      }),
  });

export const useCreateSync = (
  metadataRepo: MetadataRepository,
  profileId: string
) =>
  useMutation({
    mutationFn: async (syncInfo: SyncConfig) => {
      await metadataRepo.writeSync(profileId, syncInfo);
      await metadataRepo.snapshot();
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["profiles", profileId, "syncs"],
      }),
  });

export const useSyncs = (metadataRepo: MetadataRepository, profileId: string) =>
  useQuery({
    queryKey: ["profiles", profileId, "syncs"],
    queryFn: async () => {
      const repoList = await metadataRepo.listSyncs(profileId);
      const repos = await Promise.all(
        repoList
          ?.filter((it) => it !== undefined)
          .map((it) => metadataRepo.readSync(profileId, it.name)) ?? []
      );
      return repos.filter((it): it is SyncConfig => it !== undefined);
    },
  });
