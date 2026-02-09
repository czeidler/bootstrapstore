import { ReactNode } from "react";
import { Flex, Group } from "@mantine/core";

export const MainLayout = ({
  Header,
  Content,
}: {
  Header: ReactNode;
  Content: ReactNode;
}) => {
  return (
    <Flex h="100%" gap={1} w={"100%"} direction={"column"}>
      <Group bg="green" w={"100%"} style={{ boxSizing: "border-box" }} pl={1}>
        {Header}
      </Group>
      {Content}
    </Flex>
  );
};
