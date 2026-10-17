import { contract } from "../../backend/src/contract";
import { contractLocal } from "../../backend/src/contract-local";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { RouterContractClient } from "@orpc/contract";

const link = new RPCLink({
  origin: "http://localhost:8080",
});
export const tsr: RouterContractClient<typeof contract> =
  createORPCClient(link);

export const trustedTsr: RouterContractClient<typeof contractLocal> =
  createORPCClient(link);
