import { useMutation, useQuery, QueryClient } from "@tanstack/react-query";
import {
  MetadataRepository,
  ConnectionInfo,
  DeviceInfo,
  LocationInfo,
  SyncInfo,
  DirectoryLocationInfo,
} from "lib";

export const queryClient = new QueryClient();

export const useCreateDevice = (metadataRepo: MetadataRepository) =>
  useMutation({
    mutationFn: async (deviceInfo: DeviceInfo) => {
      await metadataRepo.addDevice(deviceInfo);
      await metadataRepo.snapshot();
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["devices"],
      }),
  });

export const useDevices = (metadataRepo: MetadataRepository | undefined) =>
  useQuery({
    queryKey: ["devices"],
    queryFn: async () => {
      const repoList = await metadataRepo?.listDevices();
      const repos = await Promise.all(
        repoList
          ?.filter((it) => it !== undefined)
          .map((it) => metadataRepo?.getDevice(it.name)) ?? [],
      );
      return repos.filter((it): it is DeviceInfo => it !== undefined);
    },
    enabled: metadataRepo !== undefined,
  });

export type DeviceWithLocations = {
  device: DeviceInfo;
  locations: LocationInfo[];
};
export const useDevicesWithLocations = (
  metadataRepo: MetadataRepository | undefined,
) =>
  useQuery({
    queryKey: ["devices", "all", "locations", "all"],
    queryFn: async (): Promise<DeviceWithLocations[]> => {
      const repoList = await metadataRepo?.listDevices();
      const repos = await Promise.all(
        repoList
          ?.filter((it) => it !== undefined)
          .map((it) => metadataRepo?.getDevice(it.name)) ?? [],
      );
      const devices = repos.filter((it): it is DeviceInfo => it !== undefined);
      return Promise.all(
        devices.map(async (device) => {
          const locationEntries = await metadataRepo?.listLocations(device.id);
          if (locationEntries === undefined) {
            return { device, locations: [] };
          }
          const locations = (
            await Promise.all(
              locationEntries?.map(async (locEntry) => {
                const location = await metadataRepo?.readLocation(
                  device.id,
                  locEntry.name,
                );
                return location;
              }),
            )
          )?.filter((it) => it !== undefined);
          return {
            device,
            locations,
          } satisfies DeviceWithLocations;
        }),
      );
    },
    enabled: metadataRepo !== undefined,
  });

export const useConnections = (
  metadataRepo: MetadataRepository,
  deviceId: string,
) =>
  useQuery({
    queryKey: ["devices", deviceId, "connections"],
    queryFn: async () => {
      const repoList = await metadataRepo.listConnections(deviceId);
      const repos = await Promise.all(
        repoList
          ?.filter((it) => it !== undefined)
          .map((it) => metadataRepo.readConnection(deviceId, it.name)) ?? [],
      );
      return repos.filter((it) => it !== undefined);
    },
  });

export const useUpsertConnection = (
  metadataRepo: MetadataRepository,
  deviceId: string,
) =>
  useMutation({
    mutationFn: async (connection: ConnectionInfo) => {
      await metadataRepo.writeConnection(deviceId, connection);
      await metadataRepo.snapshot();
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["devices", deviceId, "connections"],
      }),
  });

export const useCreateChildRepo = (
  metadataRepo: MetadataRepository,
  deviceId: string,
) =>
  useMutation({
    mutationFn: (params: { repoName?: string; path?: string }) =>
      metadataRepo.createChild(deviceId, params.repoName, params.path),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["devices"],
      }),
  });

export const useChildRepo = (
  metadataRepo: MetadataRepository,
  deviceId: string,
  repoId: string,
) =>
  useQuery({
    queryKey: ["devices", deviceId, "child-repos", repoId],
    queryFn: async () => {
      const repo = await metadataRepo.openChild(deviceId, repoId);
      return repo;
    },
  });

export const useLocations = (
  metadataRepo: MetadataRepository,
  deviceId: string,
) =>
  useQuery({
    queryKey: ["devices", deviceId, "locations"],
    queryFn: async () => {
      const repoList = await metadataRepo.listLocations(deviceId);
      const repos = await Promise.all(
        repoList
          ?.filter((it) => it !== undefined)
          .map((it) => metadataRepo.readLocation(deviceId, it.name)) ?? [],
      );
      return repos.filter((it): it is LocationInfo => it !== undefined);
    },
  });

export const useCreateCheckout = (
  metadataRepo: MetadataRepository,
  deviceId: string,
) =>
  useMutation({
    mutationFn: async (checkoutInfo: DirectoryLocationInfo) => {
      await metadataRepo.writeLocation(deviceId, checkoutInfo);
      await metadataRepo.snapshot();
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["devices"],
      }),
  });

export const useCreateSync = (
  metadataRepo: MetadataRepository,
  deviceId: string,
) =>
  useMutation({
    mutationFn: async (syncInfo: SyncInfo) => {
      await metadataRepo.writeSync(deviceId, syncInfo);
      await metadataRepo.snapshot();
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["devices", deviceId, "syncs"],
      }),
  });

export const useSyncs = (metadataRepo: MetadataRepository, deviceId: string) =>
  useQuery({
    queryKey: ["devices", deviceId, "syncs"],
    queryFn: async () => {
      const repoList = await metadataRepo.listSyncs(deviceId);
      const repos = await Promise.all(
        repoList
          ?.filter((it) => it !== undefined)
          .map((it) => metadataRepo.readSync(deviceId, it.name)) ?? [],
      );
      return repos.filter((it): it is SyncInfo => it !== undefined);
    },
  });
