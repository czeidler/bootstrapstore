import { initTsrReactQuery } from "@ts-rest/react-query/v5";
import { contract } from "../../backend/src/contract";

export const tsr = initTsrReactQuery(contract, {
  baseUrl: "http://localhost:8080",
});
