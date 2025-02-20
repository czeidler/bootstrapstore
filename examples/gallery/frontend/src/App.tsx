import "./App.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  Route,
  Routes,
  useSearchParams,
} from "react-router-dom";
import Gallery from "./Gallery";
import {
  Breadcrumbs,
  CircularProgress,
  Divider,
  IconButton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import CollectionsTwoToneIcon from "@mui/icons-material/CollectionsTwoTone";
import FolderTwoToneIcon from "@mui/icons-material/FolderTwoTone";
import DriveFolderUploadTwoToneIcon from "@mui/icons-material/DriveFolderUploadTwoTone";
import { tsr } from "./tsr";
import { useEffect, useState } from "react";
import { Repository } from "lib";
import { SqlocalSerializableDB } from "./sqlite";

import FileViewer from "./FileViewer";
import { storeGetter } from "./utils";

export type PathStackEntry = {
  repo: Repository;
  repoPath: string[];
  path: string[];
};
const Home = () => {
  const [searchParams] = useSearchParams();
  const keyParam = searchParams.get("key");
  const repoId = searchParams.get("repoId") ?? "";
  const [viewType, setViewType] = useState<"gallery" | "file">("file");

  const [repo, setRepo] = useState<Repository>();

  const [pathStack, setPathStack] = useState<PathStackEntry[]>([]);
  const currentPath = pathStack[pathStack.length - 1];

  const onBack = () => {
    if (!currentPath) {
      return;
    }
    if (currentPath.repoPath.length === 0) {
      setPathStack(pathStack.slice(0, -1));
      return;
    }
    setPathStack([
      ...pathStack.slice(0, -1),
      {
        repo: currentPath.repo,
        path: currentPath.path.slice(0, -1),
        repoPath: currentPath.repoPath.slice(0, -1),
      },
    ]);
  };
  useEffect(() => {
    (async () => {
      const key = Buffer.from(keyParam ?? "", "hex");
      const repo = await Repository.open(
        repoId,
        SqlocalSerializableDB,
        storeGetter,
        {
          key,
          branch: "main",
          inlined: false,
        }
      );
      setRepo(repo);
      setPathStack([{ repo, repoPath: [], path: [] }]);
    })();
  }, [repoId, keyParam]);
  return (
    <Stack style={{ width: "100%", height: "100%" }} gap={1}>
      <Stack direction={"row"} alignItems={"center"}>
        <Tooltip title="Navigate to parent directory">
          <span>
            <IconButton
              disabled={(currentPath?.path.length ?? 0) === 0}
              onClick={onBack}
            >
              <DriveFolderUploadTwoToneIcon />
            </IconButton>
          </span>
        </Tooltip>
        <Breadcrumbs aria-label="breadcrumb">
          {currentPath?.path.map((it) => (
            <Typography>{it}</Typography>
          ))}
        </Breadcrumbs>

        <ToggleButtonGroup
          value={viewType}
          exclusive
          onChange={(_, value) => setViewType(value)}
          aria-label="text alignment"
          sx={{ marginLeft: "auto", marginRight: 0 }}
        >
          <Tooltip title="Gallery">
            <ToggleButton value="gallery" aria-label="Gallery" size="small">
              <CollectionsTwoToneIcon />
            </ToggleButton>
          </Tooltip>
          <Tooltip title="Files">
            <ToggleButton value="file" aria-label="File" size="small">
              <FolderTwoToneIcon />
            </ToggleButton>
          </Tooltip>
        </ToggleButtonGroup>
      </Stack>
      <Divider />
      {repo === undefined ? (
        <Stack
          height="100%"
          justifyContent={"center"}
          marginLeft="auto"
          marginRight="auto"
        >
          <CircularProgress />
        </Stack>
      ) : viewType === "gallery" ? (
        <Gallery pathStack={pathStack} />
      ) : (
        <FileViewer
          repo={repo}
          pathStack={pathStack}
          setPathStack={setPathStack}
        />
      )}
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
