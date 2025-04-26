import { ReactNode } from "react";
import { Stack } from "@mui/material";

export const MainLayout = ({
  Header,
  Content,
}: {
  Header: ReactNode;
  Content: ReactNode;
}) => {
  return (
    <Stack height="100%" gap={1} width={"100%"}>
      <Stack
        direction={"row"}
        bgcolor="primary.light"
        width={"100%"}
        boxSizing="border-box"
        paddingLeft={1}
      >
        {Header}
      </Stack>
      {Content}
    </Stack>
  );
};
