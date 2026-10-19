import { contract } from "../../backend/src/contract";
import { contractLocal } from "../../backend/src/contract-local";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { RouterContractClient } from "@orpc/contract";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";

const link = new RPCLink({
  origin: "http://localhost:8080",
});
export const client: RouterContractClient<typeof contract> =
  createORPCClient(link);
export const clientQuery = createTanstackQueryUtils(client);

export const trustedClient: RouterContractClient<typeof contractLocal> =
  createORPCClient(link);
export const trustedClientQuery = createTanstackQueryUtils(trustedClient);
