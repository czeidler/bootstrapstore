import GalleryView from "./GalleryView";
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

import FileView from "./FileView";
import { imageExtensions, storeGetter } from "./utils";
import { useFileNavigation } from "./useFileNavigation";
import { DirEntry } from "lib/src/repository";

export type PathStackEntry = {
  repo: Repository;
  repoPath: string[];
  path: string[];
};
export const FileBrowser = ({ repo }: { repo: Repository | undefined }) => {
  const [viewType, setViewType] = useState<"gallery" | "file">("file");

  const { currentPath, dirEntries, openFolder, onBack } = useFileNavigation(
    repo,
    storeGetter
  );

  const onDirEntryClicked = async (entry: DirEntry) => {
    if (entry.type !== "file") {
      await openFolder(entry);
      return;
    }
  };

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

  return (
    <>
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
        <GalleryView content={dirEntries} path={currentPath} />
      ) : (
        <FileView content={dirEntries} onDirEntryClicked={onDirEntryClicked} />
      )}
    </>
  );
};
