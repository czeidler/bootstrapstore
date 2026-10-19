import { useQuery } from "@tanstack/react-query";
import { trustedClientQuery } from "../client";

export function useSyncStatus(syncId: string) {
  const { data, refetch } = useQuery(
    trustedClientQuery.syncStatusEvents.liveOptions({
      input: { syncId },
      retry: true,
    }),
  );
  return { syncStatus: data, recheck: refetch };
}
