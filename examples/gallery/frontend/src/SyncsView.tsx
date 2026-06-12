import { useState } from "react";
import { useDisclosure } from "@mantine/hooks";
import { MetadataRepository, shortId, SyncInfo } from "lib";
import { useCreateSync, useSyncs } from "./account-hooks";
import { Button, Divider, Flex, Modal, Text, TextInput } from "@mantine/core";
import { SyncRepoEntry } from "./SyncRepoEntry";
import { SyncDirEntry } from "./SyncDirView";
import { AccountData } from "lib/src/account";

const CreateSyncDialog = ({
  open,
  onClose,
  deviceId,
  metadataRepo,
  init,
}: {
  open: boolean;
  onClose: () => void;
  deviceId: string;
  metadataRepo: MetadataRepository;
  init?: SyncInfo;
}) => {
  const [from, setFrom] = useState(init?.type === "cp" ? init.from.path : "");
  const [to, setTo] = useState(init?.type === "cp" ? init.to.path : "");
  const { mutateAsync } = useCreateSync(metadataRepo, deviceId);
  const create = async () => {
    if (to === "" || from === "") {
      return;
    }
    await mutateAsync({
      id: init?.id ?? shortId(),
      type: "cp",
      from: { path: from },
      to: { path: to },
    });
    onClose();
  };
  return (
    <Modal opened={open} onClose={onClose}>
      <Flex direction={"column"} gap={10}>
        <Text id="alert-dialog-title">Copy</Text>
        <Flex direction={"column"}>
          <Text>From</Text>
          <TextInput
            value={from}
            onChange={(event) => setFrom(event.currentTarget.value)}
          />
          <Text>To</Text>
          <TextInput
            value={to}
            onChange={(event) => setTo(event.currentTarget.value)}
          />
        </Flex>
        <Flex gap={10} justify={"end"}>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            onClick={create}
            autoFocus
            disabled={to === "" || from === ""}
          >
            Save
          </Button>
        </Flex>
      </Flex>
    </Modal>
  );
};

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
        <Flex direction={"row"}>
          <Button onClick={toggle}>Add Sync</Button>
        </Flex>
        <Divider />
        <Text>Syncs</Text>
        {syncs?.map((it) => {
          if (it.type === "cp") {
            return (
              <SyncDirEntry
                key={it.id}
                metadataRepo={metadataRepo}
                deviceId={deviceId}
                syncInfo={it}
              />
            );
          }
          if (it.type === "syncRepos") {
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
      <CreateSyncDialog
        deviceId={deviceId}
        metadataRepo={metadataRepo}
        open={openCreateSyncDialog}
        onClose={close}
      />
    </>
  );
}
