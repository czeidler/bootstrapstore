import { CircularProgress } from "@mui/material";
import { tsr } from "./tsr";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

export const AdminAuth = ({ children }: { children: React.ReactNode }) => {
  const { data, isLoading } = tsr.me.useQuery({ queryKey: ["me"] });
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && data?.body.admin === undefined) {
      navigate("/");
    }
  }, [isLoading, data, navigate]);

  if (isLoading) {
    return <CircularProgress />;
  }

  return <>{children}</>;
};
