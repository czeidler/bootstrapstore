import { CircularProgress } from "@mui/material";
import { tsr } from "./tsr";
import { useNavigate } from "react-router-dom";

export const AdminAuth = ({ children }: { children: React.ReactNode }) => {
  const { data, isLoading } = tsr.me.useQuery({ queryKey: ["me"] });
  const navigate = useNavigate();
  if (isLoading) {
    return <CircularProgress />;
  }
  if (!data?.body.isAdmin) {
    navigate("/");
  }
  return <>{children}</>;
};
