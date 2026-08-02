import { useQuery } from "@tanstack/react-query";
import { MetadataRepository, LocationInfo } from "lib";
import { useMemo, useState } from "react";
import { AccountData } from "lib/src/account";
import { DevicesView } from "./DeviceView";
import { useCreateDevice, useDevicesWithLocations } from "./account-hooks";
import { shortId } from "lib/src/utils";
import { MainLayout } from "./MainLayout";
import { tsr } from "./tsr";
import {
  IconChevronDown,
  IconFilePlus,
  IconEdit,
  IconHome,
  IconDatabase,
  IconFolder,
  IconDevicesPc,
} from "@tabler/icons-react";
import {
  ActionIcon,
  Button,
  Divider,
  Flex,
  getTreeExpandedState,
  Group,
  Modal,
  Space,
  Text,
  TextInput,
  Title,
  Tooltip,
  Tree,
  useMantineTheme,
  useTree,
} from "@mantine/core";
import { LocationRepoView } from "./LocationRepoView";
import { LocationDirView } from "./LocationDirView";
import { useDisclosure } from "@mantine/hooks";
import { CreateLocationDialog } from "./location/CreateLocationDialog";
import { EditLocationDialog } from "./location/EditLocationDialog";

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
    <Modal title="Add Device" opened={open} onClose={onClose} centered>
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

function EditDeviceLocationButton({
  deviceId,
  locationInfo,
  metadataRepo,
}: {
  deviceId: string;
  locationInfo: LocationInfo;
  metadataRepo: MetadataRepository;
}) {
  const [
    openCreateLocationDialog,
    { toggle: toggleCreateLocationDialog, close: closeCreateLocationDialog },
  ] = useDisclosure(false);
  return (
    <>
      <ActionIcon
        variant="outline"
        bd={0}
        onClick={(e) => {
          e.stopPropagation();
          toggleCreateLocationDialog();
        }}
      >
        <IconEdit />
      </ActionIcon>
      <EditLocationDialog
        open={openCreateLocationDialog}
        onClose={closeCreateLocationDialog}
        deviceId={deviceId}
        metadataRepo={metadataRepo}
        locationInfo={locationInfo}
      />
    </>
  );
}

function CreateDeviceLocationButton({
  deviceId,
  metadataRepo,
}: {
  deviceId: string;
  metadataRepo: MetadataRepository;
}) {
  const [
    openCreateLocationDialog,
    { toggle: toggleCreateLocationDialog, close: closeCreateLocationDialog },
  ] = useDisclosure(false);
  return (
    <>
      <ActionIcon
        variant="outline"
        bd={0}
        onClick={(e) => {
          e.stopPropagation();
          toggleCreateLocationDialog();
        }}
      >
        <IconFilePlus />
      </ActionIcon>
      <CreateLocationDialog
        open={openCreateLocationDialog}
        onClose={closeCreateLocationDialog}
        deviceId={deviceId}
        metadataRepo={metadataRepo}
      />
    </>
  );
}

export const AccountView = ({
  accountData,
  metadataRepo,
}: {
  accountData: AccountData;
  metadataRepo: MetadataRepository;
}) => {
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

  const theme = useMantineTheme();

  const [openAddDeviceDialog, setOpenAddDeviceDialog] = useState(false);
  const { data: devicesWithLocations } = useDevicesWithLocations(metadataRepo);

  const locationToTreeChild = (deviceId: string, location: LocationInfo) => {
    const nodeProps = { deviceId, locationInfo: location };
    if (location.type === "directory") {
      return {
        value: `${deviceId}#${location.id}`,
        label: (
          <Flex gap={5}>
            <IconFolder />
            <Text>{location.path}</Text>
          </Flex>
        ),
        nodeProps,
      };
    }
    return {
      value: `${deviceId}#${location.id}`,
      label: (
        <Flex gap={5}>
          <IconDatabase />
          <Tooltip label={`Location id: ${location.id}`} openDelay={500}>
            <Text>{location.name ?? location.id}</Text>
          </Tooltip>
        </Flex>
      ),
      nodeProps,
    };
  };
  const data = useMemo(
    () => [
      {
        value: accountData.deviceId,
        label: (
          <Flex gap={5}>
            <IconDevicesPc />
            <Tooltip label={`${me?.body?.desktopMode?.path}`}>
              <Text>{`${accountData.deviceId} (Local)`}</Text>
            </Tooltip>
          </Flex>
        ),
        nodeProps: { deviceId: accountData.deviceId },
        children:
          devicesWithLocations
            ?.find((it) => it.device.id === accountData.deviceId)
            ?.locations.map((it) =>
              locationToTreeChild(accountData.deviceId, it),
            ) ?? [],
      },
      ...(devicesWithLocations
        ?.filter((device) => device.device.id !== accountData.deviceId)
        .map((device) => ({
          value: device.device.id,
          label: (
            <Flex gap={5}>
              <IconDevicesPc />
              <Text>{device.device.name ?? device.device.id}</Text>
            </Flex>
          ),
          nodeProps: { deviceId: device.device.id },
          children: device.locations.map((it) =>
            locationToTreeChild(device.device.id, it),
          ),
        })) ?? []),
    ],
    [accountData.deviceId, devicesWithLocations, me?.body?.desktopMode?.path],
  );
  const tree = useTree({
    initialSelectedState: [accountData.deviceId], // Set initial selected nodes
    initialExpandedState: getTreeExpandedState(data, "*"),
  });

  const [selected, setSelected] = useState<{
    deviceId: string;
    location?: LocationInfo;
  }>({ deviceId: accountData.deviceId });

  return (
    <MainLayout
      Header={
        <>
          <Tooltip
            label={`Open: repo: ${accountData.repoId}, local device: ${accountData.deviceId}`}
          >
            <IconHome />
          </Tooltip>
          <Title p="sx" size="h4">
            Account
          </Title>
        </>
      }
      Content={
        <>
          <Flex direction={"row"} h={"100%"} mr="xs" mih={0}>
            <Flex direction="column" miw="400px">
              <Flex
                direction={"row"}
                justify={"space-between"}
                align={"center"}
                m={5}
              >
                <Text>Devices:</Text>
                <Button
                  size={"xs"}
                  onClick={() => setOpenAddDeviceDialog(true)}
                >
                  Add
                </Button>
              </Flex>
              <Divider />

              <Tree
                ml="xs"
                mr="xs"
                tree={tree}
                data={data}
                levelOffset={20}
                renderNode={({
                  node,
                  selected,
                  expanded,
                  hasChildren,
                  elementProps,
                }) => (
                  <Group
                    gap={5}
                    {...elementProps}
                    style={{
                      backgroundColor: selected
                        ? theme.colors.green[1]
                        : "transparent", // Highlight color
                    }}
                    onClick={() => {
                      tree.select(node.value);
                      if (tree.selectedState.includes(node.value)) {
                        tree.toggleExpanded(node.value);
                      }
                      const [deviceId, locationId] = node.value.split("#");
                      const location = devicesWithLocations
                        ?.find((it) => it.device.id === deviceId)
                        ?.locations.find((it) => it.id === locationId);

                      setSelected({ deviceId, location });
                    }}
                  >
                    {hasChildren ? (
                      <IconChevronDown
                        size={16}
                        style={{
                          transform: expanded
                            ? "rotate(180deg)"
                            : "rotate(0deg)",
                        }}
                      />
                    ) : (
                      <Space w={24} />
                    )}
                    {node.label}

                    <Flex // Prevents click and key events from bubbling up to the tree
                      ml="auto"
                      onClick={(event) => {
                        event.stopPropagation();
                      }}
                      onKeyDown={(event) => {
                        event.stopPropagation();
                      }}
                    >
                      {node.nodeProps?.deviceId &&
                      node.nodeProps?.locationInfo ? (
                        <EditDeviceLocationButton
                          deviceId={node.nodeProps.deviceId}
                          locationInfo={node.nodeProps.locationInfo}
                          metadataRepo={metadataRepo}
                        />
                      ) : node.nodeProps?.deviceId ? (
                        <CreateDeviceLocationButton
                          deviceId={node.nodeProps.deviceId}
                          metadataRepo={metadataRepo}
                        />
                      ) : null}
                    </Flex>
                  </Group>
                )}
              />
            </Flex>
            <Divider orientation="vertical" mr="xs" />
            {selected.location === undefined ? (
              <DevicesView
                deviceId={selected.deviceId}
                metadataRepo={metadataRepo}
                accountData={accountData}
              />
            ) : selected.location.type === "repository" ? (
              <LocationRepoView
                deviceId={selected.deviceId}
                location={selected.location}
                metadataRepo={metadataRepo}
                accountData={accountData}
              />
            ) : (
              <LocationDirView
                deviceId={selected.deviceId}
                location={selected.location}
                metadataRepo={metadataRepo}
                devicesWithLocations={devicesWithLocations}
              />
            )}
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
