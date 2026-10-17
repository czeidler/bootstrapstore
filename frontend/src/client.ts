import { contract } from "../../backend/src/contract";
import { contractLocal } from "../../backend/src/contract-local";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { RouterContractClient } from "@orpc/contract";

const link = new RPCLink({
  origin: "http://localhost:8080",
});
export const client: RouterContractClient<typeof contract> =
  createORPCClient(link);

export const trustedClient: RouterContractClient<typeof contractLocal> =
  createORPCClient(link);
