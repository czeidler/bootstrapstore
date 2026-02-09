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

import { createTheme, MantineProvider } from "@mantine/core";

const mantineTheme = createTheme({
  primaryColor: "green",
  colors: {
    green: [
      "#eafcf3",
      "#daf5e8",
      "#b4e8cf",
      "#8bdcb5",
      "#6ad19e",
      "#54cb90",
      "#47c888",
      "#38b075",
      "#2a9461",
      "#1a8856",
    ],
  },
});

const App = () => {
  return (
    <MantineProvider theme={mantineTheme}>
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
