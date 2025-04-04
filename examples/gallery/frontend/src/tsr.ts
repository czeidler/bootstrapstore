import { initTsrReactQuery } from "@ts-rest/react-query/v5";
import { contract, trustedContract } from "../../backend/src/contract";

const options = {
  baseUrl: "http://localhost:8080",
};

export const tsr = initTsrReactQuery(contract, options);

export const trustedTsr = initTsrReactQuery(trustedContract, options);
