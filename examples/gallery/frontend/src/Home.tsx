import { useSearchParams } from "react-router-dom";
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
import { useEffect, useState } from "react";
import { Repository } from "lib";
import { SqlocalSerializableDB } from "./sqlite";

import FileViewer from "./FileViewer";
import { imageExtensions, storeGetter } from "./utils";
import { useFileNavigation } from "./useFileNavigation";

export type PathStackEntry = {
  repo: Repository;
  repoPath: string[];
  path: string[];
};
export const Home = () => {
  const [searchParams] = useSearchParams();
  const keyParam = searchParams.get("key");
  const repoId = searchParams.get("repoId") ?? "";
  const [viewType, setViewType] = useState<"gallery" | "file">("file");

  const [repo, setRepo] = useState<Repository>();
  const { currentPath, dirEntries, openFolder, onBack } = useFileNavigation(
    repo,
    storeGetter
  );

  useEffect(() => {
    (async () => {
      if (
        !dirEntries?.some((it) =>
          imageExtensions.some((ext) =>
            it.name.toLocaleLowerCase().endsWith(ext)
          )
        )
      ) {
        setViewType("file");
      }
    })();
  }, [dirEntries]);

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
          {currentPath?.path.map((it, i) => (
            <Typography key={`${i}`}>{it}</Typography>
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
        <Gallery content={dirEntries} path={currentPath} />
      ) : (
        <FileViewer content={dirEntries} openFolder={openFolder} />
      )}
    </Stack>
  );
};
