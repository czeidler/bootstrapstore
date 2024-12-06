import "./App.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { initTsrReactQuery } from "@ts-rest/react-query/v5";
import { contract } from "../../backend/src/contract";
import Gallery from "./Gallery";

export const tsr = initTsrReactQuery(contract, {
  baseUrl: "http://localhost:8080",
});

const Home = () => {
  return (
    <div style={{ width: "100%" }}>
      <Gallery />
    </div>
  );
};

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <tsr.ReactQueryProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
          </Routes>
        </BrowserRouter>
      </tsr.ReactQueryProvider>
    </QueryClientProvider>
  );
};
export default App;
