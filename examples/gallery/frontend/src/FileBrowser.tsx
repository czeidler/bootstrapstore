import GalleryView from "./GalleryView";
import CollectionsTwoToneIcon from "@mui/icons-material/CollectionsTwoTone";
import FolderTwoToneIcon from "@mui/icons-material/FolderTwoTone";
import DriveFolderUploadTwoToneIcon from "@mui/icons-material/DriveFolderUploadTwoTone";
import { useEffect, useState } from "react";
import { VFSDir } from "lib";

import FileView from "./FileView";
import { imageExtensions } from "./utils";
import { useFileNavigation } from "./useFileNavigation";
import { VFSEntry } from "lib";
import {
  Breadcrumbs,
  Flex,
  Loader,
  Divider,
  ActionIcon,
  Tooltip,
  Group,
  Anchor,
} from "@mantine/core";

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
      <Flex direction={"row"} align={"center"} gap={5} pt={2} pb={2}>
        <Tooltip label="Navigate to parent directory">
          <ActionIcon
            disabled={(currentPath.length ?? 0) === 0}
            onClick={() => onBack()}
          >
            <DriveFolderUploadTwoToneIcon />
          </ActionIcon>
        </Tooltip>
        <Breadcrumbs aria-label="breadcrumb">
          {currentPath.map((it, i) => (
            <Anchor key={`${i}`} onClick={() => onBack(i)}>
              {it}
            </Anchor>
          ))}
        </Breadcrumbs>

        <Group gap={0} ml="auto" mr={0}>
          <Tooltip label="Gallery">
            <ActionIcon
              aria-label="Gallery"
              disabled={viewType === "gallery"}
              onClick={() => setViewType("gallery")}
            >
              <CollectionsTwoToneIcon />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Files">
            <ActionIcon
              aria-label="File"
              disabled={viewType === "file"}
              onClick={() => setViewType("file")}
            >
              <FolderTwoToneIcon />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Flex>
      <Divider />
      {root === undefined ? (
        <Flex h="100%" justify={"center"} ml="auto" mr="auto">
          <Loader />
        </Flex>
      ) : viewType === "gallery" ? (
        <GalleryView dirPath={currentPath} content={dirEntries} />
      ) : (
        <FileView content={dirEntries} onDirEntryClicked={onDirEntryClicked} />
      )}
    </>
  );
};
