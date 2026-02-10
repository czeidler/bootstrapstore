import { List, ListSubheader, TextField } from "@mui/material";
import { useMutation, useQuery } from "@tanstack/react-query";
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
import { IconChevronDown } from "@tabler/icons-react";
import {
  Button,
  Divider,
  Flex,
  Group,
  Modal,
  Space,
  Text,
  TextInput,
  Title,
  Tooltip,
  Tree,
} from "@mantine/core";

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
        <Title p="sx" size="h4">
          Open Account
        </Title>
      }
      Content={
        <Flex gap={"xs"} m={"xs"} direction={"column"}>
          <TextField
            label="Password"
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button disabled={!password} onClick={() => openAccount()}>
            Open
          </Button>
        </Flex>
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
    <Modal opened={open} onClose={onClose} centered>
      <Title>Add Device</Title>

      <TextInput
        autoFocus={true}
        value={deviceName}
        label="Device Name"
        placeholder="First input"
        onChange={(event) => setDeviceName(event.target.value)}
      />
      <Group mt="xs">
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={create} autoFocus>
          Create
        </Button>
      </Group>
    </Modal>
  );
};

export const AccountView = ({ accountFile }: { accountFile: AccountFile }) => {
  const [accountData, setAccountData] = useState<AccountData | undefined>();
  const [metadataRepo, setMetadataRepo] = useState<
    MetadataRepository | undefined
  >();

  const { data: me } = useQuery({
    queryFn: async () => {
      const response = await tsr.me();
      if (response.status !== 200) {
        throw Error(JSON.stringify(response));
      }
      return response;
    },
    queryKey: ["me"],
  });

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

  const data = [
    {
      value: accountData.deviceId,
      label: (
        <Tooltip label={`${me?.body?.admin?.path}`}>
          <Text>{`${accountData.deviceId} (Local)`}</Text>
        </Tooltip>
      ),
      children: [{ value: "account-repo", label: <Text>Account repo</Text> }],
    },
    ...(devices
      ?.filter((device) => device.id !== accountData.deviceId)
      .map((device) => ({
        value: device.id,
        label: (
          <Text onClick={() => setSelectedDevice(device.id)}>
            {device.name ?? device.id}
          </Text>
        ),
      })) ?? []),
  ];

  return (
    <MainLayout
      Header={
        <>
          <Tooltip
            label={`Open: repo: ${accountData.repoId}, local device: ${accountData.deviceId}`}
          >
            <HomeTwoToneIcon sx={{ alignSelf: "center" }} />
          </Tooltip>
          <Title p="sx" size="h4">
            Account
          </Title>
        </>
      }
      Content={
        <>
          <Flex direction={"row"} h={"100%"} mr="xs">
            <Flex direction="column" miw="400px">
              <List
                subheader={
                  <ListSubheader sx={{ textAlign: "start" }}>
                    <Flex
                      pl="xs"
                      direction={"row"}
                      justify={"space-between"}
                      align={"center"}
                    >
                      <Text>Devices:</Text>
                      <Button onClick={() => setOpenAddDeviceDialog(true)}>
                        Add
                      </Button>
                    </Flex>
                  </ListSubheader>
                }
              >
                <Divider />
              </List>

              <Tree
                data={data}
                levelOffset={20}
                renderNode={({ node, expanded, hasChildren, elementProps }) => (
                  <Group {...elementProps}>
                    {hasChildren ? (
                      <IconChevronDown
                        size={18}
                        style={{
                          transform: expanded
                            ? "rotate(180deg)"
                            : "rotate(0deg)",
                        }}
                      />
                    ) : (
                      <Space w={18} />
                    )}
                    {node.label}
                  </Group>
                )}
              />
            </Flex>
            <Divider orientation="vertical" mr="xs" />
            <DevicesView
              deviceId={selectedDevice ?? accountData.deviceId}
              metadataRepo={metadataRepo}
            />
          </Flex>
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
