import { useState } from "react";
import { MetadataRepository, shortId } from "lib";
import { useCreateSync } from "../account-hooks";
import { TextInput } from "@mantine/core";
import { SyncConfigLayout } from "./SyncConfigLayout";
import { SyncPathInfo } from "lib/src/main-repo";

export const SyncConfig = ({
  onClose,
  deviceId,
  metadataRepo,
  init,
}: {
  onClose: () => void;
  deviceId: string;
  metadataRepo: MetadataRepository;
  init?: SyncPathInfo;
}) => {
  const [from, setFrom] = useState(init?.from.path ?? "");
  const [to, setTo] = useState(init?.to.path ?? "");
  const { mutateAsync } = useCreateSync(metadataRepo, deviceId);
  const save = async () => {
    if (to === "" || from === "") {
      return;
    }
    await mutateAsync({
      id: init?.id ?? shortId(),
      type: "sync",
      from: { path: from },
      to: { path: to },
    });
    onClose();
  };
  return (
    <SyncConfigLayout
      Content={
        <>
          <TextInput
            label="From"
            value={from}
            onChange={(event) => setFrom(event.currentTarget.value)}
          />
          <TextInput
            label="To"
            value={to}
            onChange={(event) => setTo(event.currentTarget.value)}
          />
        </>
      }
      onClose={onClose}
      save={save}
      disabled={to === "" || from === ""}
    />
  );
};
