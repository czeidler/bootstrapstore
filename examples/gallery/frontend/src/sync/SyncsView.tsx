import { useDisclosure } from "@mantine/hooks";
import { MetadataRepository } from "lib";
import { useSyncs } from "../account-hooks";
import { Button, Flex } from "@mantine/core";
import { AccountData } from "lib/src/account";
import { CreateSyncConfigDialog } from "./CreateSyncConfigDialog";
import { SyncEntry } from "./SyncEntry";
import { PushRepoEntry } from "./PushRepoEntry";
import { SnapshotEntry } from "./SnapshotEntry";

export function SyncsView({
  metadataRepo,
  deviceId,
  accountData,
}: {
  metadataRepo: MetadataRepository;
  deviceId: string;
  accountData: AccountData;
}) {
  const { data: syncs } = useSyncs(metadataRepo, deviceId);

  const [openCreateSyncDialog, { toggle, close }] = useDisclosure(false);
  return (
    <>
      <Flex h={"100%"} direction={"column"} gap={"xs"}>
        <Flex direction={"row"} mt={"xs"}>
          <Button size="xs" onClick={toggle}>
            Add Sync
          </Button>
        </Flex>

        {syncs?.map((it) => {
          if (it.type === "sync") {
            return (
              <SyncEntry
                key={it.id}
                metadataRepo={metadataRepo}
                deviceId={deviceId}
                syncInfo={it}
              />
            );
          }
          if (it.type === "push") {
            return (
              <PushRepoEntry
                key={it.id}
                metadataRepo={metadataRepo}
                deviceId={deviceId}
                repoId={it.repoId}
                syncInfo={it}
                accountData={accountData}
              />
            );
          }
          if (it.type === "snapshot") {
            return (
              <SnapshotEntry
                key={it.id}
                metadataRepo={metadataRepo}
                deviceId={deviceId}
                syncInfo={it}
              />
            );
          }
          throw Error("TODO");
        })}
      </Flex>
      <CreateSyncConfigDialog
        deviceId={deviceId}
        metadataRepo={metadataRepo}
        open={openCreateSyncDialog}
        onClose={close}
      />
    </>
  );
}
