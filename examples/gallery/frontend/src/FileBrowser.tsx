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
import { VFSDir } from "lib";

import FileView from "./FileView";
import { imageExtensions } from "./utils";
import { useFileNavigation } from "./useFileNavigation";
import { VFSEntry } from "lib";

export const FileBrowser = ({ root }: { root: VFSDir | undefined }) => {
  const [viewType, setViewType] = useState<"gallery" | "file">("file");

  const { currentPath, dirEntries, openFolder, onBack } =
    useFileNavigation(root);

  const onDirEntryClicked = async (entry: VFSEntry) => {
    if (entry.type !== "file") {
      await openFolder(entry.name);
      return;
    }
  };

  useEffect(() => {
    (async () => {
      if (
        !dirEntries?.some((it) =>
          imageExtensions.some((ext) =>
            it.name.toLocaleLowerCase().endsWith(ext),
          ),
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
              disabled={(currentPath.length ?? 0) === 0}
              onClick={onBack}
            >
              <DriveFolderUploadTwoToneIcon />
            </IconButton>
          </span>
        </Tooltip>
        <Breadcrumbs aria-label="breadcrumb">
          {currentPath.map((it, i) => (
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
      {root === undefined ? (
        <Stack
          height="100%"
          justifyContent={"center"}
          marginLeft="auto"
          marginRight="auto"
        >
          <CircularProgress />
        </Stack>
      ) : viewType === "gallery" ? (
        <GalleryView dirPath={currentPath} content={dirEntries} />
      ) : (
        <FileView content={dirEntries} onDirEntryClicked={onDirEntryClicked} />
      )}
    </>
  );
};
