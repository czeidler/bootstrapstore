import { ReactNode } from "react";
import { Button, Flex } from "@mantine/core";

export const LocationConfigLayout = ({
  Content,
  onClose,
  save,
  disabled,
}: {
  Content: ReactNode;
  onClose: () => void;
  save: () => Promise<void>;
  disabled: boolean;
}) => {
  return (
    <Flex h="100%" gap={"xs"} w={"100%"} direction={"column"}>
      {Content}
      <Flex gap={"xs"} justify={"end"}>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={save} autoFocus disabled={disabled}>
          Save
        </Button>
      </Flex>
    </Flex>
  );
};
