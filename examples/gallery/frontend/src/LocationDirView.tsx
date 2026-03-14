import { LocationInfo } from "lib";
import { FileBrowser } from "./FileBrowser";
import { Flex, Text } from "@mantine/core";
import { RemoteProxyDirVFS } from "./remote-proxy-vfs";
import { useMemo } from "react";

export function DirRepoView({
  deviceId,
  location,
}: {
  deviceId: string;
  location: LocationInfo;
}) {
  if (location.type !== "directory") {
    throw Error("Location not a directory");
  }
  const root = useMemo(() => {
    return new RemoteProxyDirVFS(undefined, location.path?.split("/") ?? []);
  }, []);

  return (
    <Flex direction="column" style={{ width: "100%" }}>
      <Text>Path: {location.path}</Text>

      <FileBrowser root={root} />
    </Flex>
  );
}
