import { initClient } from "@ts-rest/core";
import { contract } from "../../backend/src/contract";
import { contractLocal } from "../../backend/src/contractLocal";

const options = {
  baseUrl: "http://localhost:8080",
  jsonQuery: true,
};

export const tsr = initClient(contract, options);

export const trustedTsr = initClient(contractLocal, options);
