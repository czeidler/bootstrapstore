import { ReactNode } from "react";
import {
  Button,
  Card,
  Flex,
  Space,
  Text,
  useMantineTheme,
} from "@mantine/core";

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
  const theme = useMantineTheme();
  return (
    <Card padding="sm" withBorder title={title}>
      <Card.Section pb="xs">
        <Flex
          align={"center"}
          w="100%"
          bg={theme.primaryColor}
          pl={"xs"}
          pr={"xs"}
          c={theme.white}
        >
          <Text>{title}</Text>
          <Space flex={1} />
          <Text size="sm">{id}</Text>
        </Flex>
      </Card.Section>

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
