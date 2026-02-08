import "./App.css";

import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { Home } from "./Home";
import { AdminAuth } from "./AdminAuth";
import { Admin } from "./Admin";

import { queryClient } from "./account-hooks";
import { ThemeProvider } from "@mui/material";
import { theme } from "./theme";
import "@mantine/core/styles.css";

import { MantineProvider } from "@mantine/core";

const App = () => {
  return (
    <MantineProvider>
      <ThemeProvider theme={theme}>
        <QueryClientProvider client={queryClient}>
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
        </QueryClientProvider>
      </ThemeProvider>
    </MantineProvider>
  );
};
export default App;
