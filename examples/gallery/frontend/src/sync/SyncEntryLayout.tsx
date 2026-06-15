import { ReactNode } from "react";
import { Button, Card, Flex, Space, Text } from "@mantine/core";

export const SyncEntryLayout = ({
  id,
  title,
  Content,
  actions,
  sync,
  isSyncing,
}: {
  id: string;
  title: string;
  Content: ReactNode;
  actions?: ReactNode[];
  sync: () => Promise<void>;
  isSyncing: boolean;
}) => {
  return (
    <Card padding="sm" withBorder title={title}>
      <Flex align={"center"} w="100%">
        <Text>{title}</Text>
        <Space flex={1} />
        <Text c="dimmed" size="sm">
          {id}
        </Text>
      </Flex>
      {Content}
      <Flex gap={"xs"} justify={"start"}>
        <Button onClick={sync} autoFocus disabled={isSyncing} size="xs">
          Run
        </Button>
        {...actions ?? []}
      </Flex>
    </Card>
  );
};
