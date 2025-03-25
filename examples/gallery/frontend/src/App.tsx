import "./App.css";

import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { tsr } from "./tsr";
import { Home } from "./Home";
import { AdminAuth } from "./Auth";
import { Admin } from "./Admin";
import { queryClient } from "./main";

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <tsr.ReactQueryProvider>
        <BrowserRouter
          future={{
            v7_relativeSplatPath: true,
            v7_startTransition: true,
          }}
        >
          <Routes>
            <Route path="/" element={<Home />} />
            <Route
              path="admin"
              element={
                <AdminAuth>
                  <Admin />
                </AdminAuth>
              }
            />
          </Routes>
        </BrowserRouter>
      </tsr.ReactQueryProvider>
    </QueryClientProvider>
  );
};
export default App;
