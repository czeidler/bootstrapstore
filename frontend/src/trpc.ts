import type { AppRouter } from "../../backend/src/controller";
import { CreateTRPCClient, createTRPCReact } from "@trpc/react-query";

export type TRPCProxyClient = CreateTRPCClient<AppRouter>;

export const trpc = createTRPCReact<AppRouter>();
