import { tsr } from "./tsr";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader } from "@mantine/core";

export const AdminAuth = ({ children }: { children: React.ReactNode }) => {
  const { data, isLoading } = useQuery({
    queryFn: async () => {
      const response = await tsr.me({ query: { auth: undefined } });
      if (response.status !== 200) {
        throw Error(JSON.stringify(response));
      }
      return response;
    },
    queryKey: ["me"],
  });
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && data?.body.desktopMode === undefined) {
      navigate("/");
    }
  }, [isLoading, data, navigate]);

  if (isLoading) {
    return <Loader color="blue" />;
  }

  return <>{children}</>;
};
