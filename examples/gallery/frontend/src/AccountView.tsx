import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  List,
  ListSubheader,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useMutation } from "@tanstack/react-query";
import { AccountFile, Account, MetadataRepository } from "lib";
import { storeGetter } from "./utils";
import { useEffect, useState } from "react";
import { AccountData } from "lib/src/account";
import { DevicesView } from "./DeviceView";
import { useCreateDevice, useDevices } from "./account-hooks";
import { shortId, stringToUint8Array } from "lib/src/utils";
import HomeTwoToneIcon from "@mui/icons-material/HomeTwoTone";
import { MainLayout } from "./MainLayout";
import { getRepoIOConfig } from "./io-config";
import { tsr } from "./tsr";
import { SimpleTreeView } from "@mui/x-tree-view/SimpleTreeView";
import { TreeItem } from "@mui/x-tree-view/TreeItem";
import { Group, Tree } from "@mantine/core";

// TEMP
function create16ByteBuffer(str: string): Uint8Array {
  const array = stringToUint8Array(str);
  const result = new Uint8Array(16);
  result.set(array.subarray(0, 16), 0);
  return result;
}

const OpenAccount = ({
  onOpen,
  accountFile,
}: {
  onOpen: (accountData: AccountData, metadataRepo: MetadataRepository) => void;
  accountFile: AccountFile;
}) => {
  const [password, setPassword] = useState<string | undefined>();

  const { mutate: openAccount } = useMutation({
    mutationFn: async () => {
      if (password === undefined) {
        return;
      }
      const account = await Account.openAccount(
        storeGetter,
        getRepoIOConfig(),
        create16ByteBuffer(password),
        accountFile,
      );

      const metadataRepo = await account.openMetadataRepo();
      onOpen(account.accountData, metadataRepo);
    },
  });

  return (
    <MainLayout
      Header={
        <Typography padding={0.5} variant="h5">
          Open Account
        </Typography>
      }
      Content={
        <>
          <TextField
            label="Password"
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button disabled={!password} onClick={() => openAccount()}>
            Open
          </Button>
        </>
      }
    />
  );
};

const AddDeviceDialog = ({
  open,
  onClose,
  metadataRepo,
}: {
  open: boolean;
  onClose: () => void;
  metadataRepo: MetadataRepository;
}) => {
  const [deviceName, setDeviceName] = useState<string | undefined>();
  const { mutateAsync } = useCreateDevice(metadataRepo);
  const create = async () => {
    await mutateAsync({
      id: shortId(),
      name: deviceName,
    });

    onClose();
  };
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle id="alert-dialog-title">Add Device</DialogTitle>
      <DialogContent>
        <TextField
          value={deviceName}
          autoFocus
          margin="dense"
          id="name"
          name="reponame"
          label="Device Name"
          fullWidth
          variant="standard"
          onChange={(event) => setDeviceName(event.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={create} autoFocus>
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export const AccountView = ({ accountFile }: { accountFile: AccountFile }) => {
  const [accountData, setAccountData] = useState<AccountData | undefined>();
  const [metadataRepo, setMetadataRepo] = useState<
    MetadataRepository | undefined
  >();

  const { data: me } = tsr.me.useQuery({ queryKey: ["me"] });

  const [openAddDeviceDialog, setOpenAddDeviceDialog] = useState(false);
  const { data: devices } = useDevices(metadataRepo);
  const [selectedDevice, setSelectedDevice] = useState<string | undefined>();
  useEffect(() => {
    setSelectedDevice(accountData?.deviceId);
  }, [accountData]);
  if (accountData === undefined || metadataRepo === undefined) {
    return (
      <OpenAccount
        accountFile={accountFile}
        onOpen={(accountData, metadataRepo) => {
          setAccountData(accountData);
          setMetadataRepo(metadataRepo);
        }}
      />
    );
  }

  return (
    <MainLayout
      Header={
        <>
          <Tooltip
            title={`Open: repo: ${accountData.repoId}, local device: ${accountData.deviceId}`}
          >
            <HomeTwoToneIcon sx={{ alignSelf: "center" }} />
          </Tooltip>
          <Typography padding={0.5} variant="h5">
            Account
          </Typography>
        </>
      }
      Content={
        <>
          <Stack direction={"row"} height={"100%"} marginRight={1}>
            <Stack minWidth="400px">
              <List
                subheader={
                  <ListSubheader sx={{ textAlign: "start" }}>
                    <Stack
                      paddingLeft={1}
                      direction={"row"}
                      justifyContent={"space-between"}
                      alignItems={"center"}
                    >
                      <Typography>Devices:</Typography>
                      <Button onClick={() => setOpenAddDeviceDialog(true)}>
                        Add
                      </Button>
                    </Stack>
                  </ListSubheader>
                }
              >
                <Divider />
              </List>
              <SimpleTreeView sx={{ textAlign: "start" }}>
                <TreeItem
                  itemId={accountData.deviceId}
                  label={`${accountData.deviceId} (Local) ${me?.body?.admin?.path}`}
                >
                  <TreeItem itemId={"account-repo"} label={"Account repo"} />
                </TreeItem>
                {devices
                  ?.filter((device) => device.id !== accountData.deviceId)
                  .map((device) => (
                    <TreeItem
                      itemId={device.id}
                      label={device.name ?? device.id}
                      onClick={() => setSelectedDevice(device.id)}
                    />
                  ))}
              </SimpleTreeView>
            </Stack>
            <Divider orientation="vertical" sx={{ marginRight: 1 }} />
            <DevicesView
              deviceId={selectedDevice ?? accountData.deviceId}
              metadataRepo={metadataRepo}
            />
          </Stack>
          <AddDeviceDialog
            open={openAddDeviceDialog}
            onClose={() => setOpenAddDeviceDialog(false)}
            metadataRepo={metadataRepo}
          />
        </>
      }
    />
  );
};
