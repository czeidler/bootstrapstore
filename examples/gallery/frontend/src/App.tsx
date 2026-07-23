import "./App.css";

import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { Home } from "./Home";
import { AdminAuth } from "./AdminAuth";
import { Admin } from "./Admin";

import { queryClient } from "./account-hooks";
import { theme } from "./theme";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";

import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";

const App = () => {
  return (
    <MantineProvider theme={theme}>
      <Notifications autoClose={4000} />
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
    </MantineProvider>
  );
};
export default App;
