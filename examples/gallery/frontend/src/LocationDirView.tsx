import { LocationInfo, MetadataRepository } from "lib";
import { FileBrowser } from "./FileBrowser";
import { Flex, Tabs, Text } from "@mantine/core";
import { RemoteProxyDirVFS } from "./remote-proxy-vfs";
import { useMemo, useState } from "react";
import { SyncDirView } from "./SyncDirView";
import { DeviceWithLocations } from "./account-hooks";

export function LocationDirView({
  deviceId,
  location,
  metadataRepo,
  devicesWithLocations,
}: {
  deviceId: string;
  location: LocationInfo;
  metadataRepo: MetadataRepository;
  devicesWithLocations: DeviceWithLocations[] | undefined;
}) {
  if (location.type !== "directory") {
    throw Error("Location not a directory");
  }
  const root = useMemo(() => {
    return new RemoteProxyDirVFS(undefined, location.path?.split("/") ?? []);
  }, []);
  const [activeTab, setActiveTab] = useState<string | null>("details");
  return (
    <Flex direction="column" style={{ width: "100%" }}>
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="details">Detail</Tabs.Tab>
          <Tabs.Tab value="browse">Browser</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="details">
          <Text>Path: {location.path}</Text>
          <SyncDirView
            metadataRepo={metadataRepo}
            deviceId={deviceId}
            locationId={location.id}
            devicesWithLocations={devicesWithLocations}
          />
        </Tabs.Panel>
        <Tabs.Panel value="browse">
          <FileBrowser root={root} />
        </Tabs.Panel>
      </Tabs>
    </Flex>
  );
}
