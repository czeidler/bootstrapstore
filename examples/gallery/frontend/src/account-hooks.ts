import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "./main";
import {
  CheckoutInfo,
  MetadataRepository,
  RepositoryInfo,
} from "lib/src/main-repo";

export const useCreateChildRepo = (
  metadataRepo: MetadataRepository,
  remoteId: string,
  repoName: string | undefined
) =>
  useMutation({
    mutationFn: () => metadataRepo.createChild(remoteId, repoName),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["remotes", remoteId, "repositories"],
      }),
  });

export const useRepositories = (
  metadataRepo: MetadataRepository,
  remoteId: string
) =>
  useQuery({
    queryKey: ["remotes", remoteId, "repositories"],
    queryFn: async () => {
      const repoList = await metadataRepo.listRepositories(remoteId);
      const repos = await Promise.all(
        repoList
          ?.filter((it) => it !== undefined)
          .map((it) => metadataRepo.readRepository(remoteId, it.name)) ?? []
      );
      return repos.filter((it): it is RepositoryInfo => it !== undefined);
    },
  });

export const useCreateCheckout = (
  metadataRepo: MetadataRepository,
  remoteId: string
) =>
  useMutation({
    mutationFn: async (checkoutInfo: CheckoutInfo) => {
      await metadataRepo.writeCheckout(remoteId, checkoutInfo);
      await metadataRepo.snapshot();
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["remotes", remoteId, "checkouts"],
      }),
  });

export const useCheckouts = (
  metadataRepo: MetadataRepository,
  remoteId: string
) =>
  useQuery({
    queryKey: ["remotes", remoteId, "checkouts"],
    queryFn: async () => {
      const repoList = await metadataRepo.listCheckouts(remoteId);
      const repos = await Promise.all(
        repoList
          ?.filter((it) => it !== undefined)
          .map((it) => metadataRepo.readCheckout(remoteId, it.name)) ?? []
      );
      return repos.filter((it): it is CheckoutInfo => it !== undefined);
    },
  });
