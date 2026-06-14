import { useDisclosure } from "@mantine/hooks";
import { MetadataRepository } from "lib";
import { useSyncs } from "./account-hooks";
import { Button, Divider, Flex, Text } from "@mantine/core";
import { SyncRepoEntry } from "./SyncRepoEntry";
import { SyncDirEntry } from "./SyncDirView";
import { AccountData } from "lib/src/account";
import { SyncConfigDialog } from "./sync/SyncConfigDialog";

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
      <Flex h={"100%"} direction={"column"}>
        <Flex direction={"row"} mt={5} mb={5}>
          <Button size="xs" onClick={toggle}>
            Add Sync
          </Button>
        </Flex>
        <Divider />
        <Text>Syncs</Text>
        {syncs?.map((it) => {
          if (it.type === "sync") {
            return (
              <SyncDirEntry
                key={it.id}
                metadataRepo={metadataRepo}
                deviceId={deviceId}
                syncInfo={it}
              />
            );
          }
          if (it.type === "push") {
            return (
              <SyncRepoEntry
                key={it.id}
                metadataRepo={metadataRepo}
                deviceId={deviceId}
                repoId={it.repoId}
                syncInfo={it}
                accountData={accountData}
              />
            );
          }
          throw Error("TODO");
        })}
      </Flex>
      <SyncConfigDialog
        deviceId={deviceId}
        metadataRepo={metadataRepo}
        open={openCreateSyncDialog}
        onClose={close}
      />
    </>
  );
}
