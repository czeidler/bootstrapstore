import { client } from "./client";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader } from "@mantine/core";

export const AdminAuth = ({ children }: { children: React.ReactNode }) => {
  const { data, isLoading } = useQuery({
    queryFn: async () => {
      const response = await client.me({ auth: undefined });
      return response;
    },
    queryKey: ["me"],
  });
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && data?.desktopMode === undefined) {
      navigate("/");
    }
  }, [isLoading, data, navigate]);

  if (isLoading) {
    return <Loader color="blue" />;
  }

  return <>{children}</>;
};
