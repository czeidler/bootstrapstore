import { MetadataRepository } from "lib";
import { useState } from "react";
import { RemoteTab } from "./RemoteTab";
import { SyncsView } from "./SyncsView";
import { AccountData } from "lib/src/account";
import { Flex, Tabs } from "@mantine/core";

export const DevicesView = ({
  deviceId,
  metadataRepo,
  accountData,
}: {
  deviceId: string;
  metadataRepo: MetadataRepository;
  accountData: AccountData;
}) => {
  type TabValue = "syncs" | "remote";
  const [tabValue, setTabValue] = useState<TabValue>("syncs");

  return (
    <>
      <Flex direction="column" w="100%" h={"100%"}>
        <Tabs value={tabValue} onChange={(v) => setTabValue(v as TabValue)}>
          <Tabs.List>
            <Tabs.Tab value="syncs">Syncs</Tabs.Tab>
            <Tabs.Tab value="remote">Remote</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="syncs">
            <SyncsView
              metadataRepo={metadataRepo}
              deviceId={deviceId}
              accountData={accountData}
            />
          </Tabs.Panel>
          <Tabs.Panel value="remote">
            <RemoteTab deviceId={deviceId} metadataRepo={metadataRepo} />
          </Tabs.Panel>
        </Tabs>
      </Flex>
    </>
  );
};
