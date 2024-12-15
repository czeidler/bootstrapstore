import "./App.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  Route,
  Routes,
  useSearchParams,
} from "react-router-dom";
import Gallery from "./Gallery";
import { Stack } from "@mui/material";
import { tsr } from "./tsr";

const Home = () => {
  const [searchParams] = useSearchParams();
  const keyParam = searchParams.get("key");

  const key = Buffer.from(keyParam ?? "", "hex");
  return (
    <Stack style={{ width: "100%", height: "100%" }}>
      <Gallery repoKey={key} />
    </Stack>
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
