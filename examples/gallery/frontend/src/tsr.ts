import { initClient } from "@ts-rest/core";
import { contract, trustedContract } from "../../backend/src/contract";

const options = {
  baseUrl: "http://localhost:8080",
};

export const tsr = initClient(contract, options);

export const trustedTsr = initClient(trustedContract, options);
