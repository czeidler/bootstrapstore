import { MainRepository, Repository } from "lib";
import { useEffect, useState } from "react";
import { DataGrid, GridRowParams } from "@mui/x-data-grid";
import { DirEntry } from "lib/src/repository";
import FolderTwoToneIcon from "@mui/icons-material/FolderTwoTone";
import InsertDriveFileTwoToneIcon from "@mui/icons-material/InsertDriveFileTwoTone";
import DriveFileMoveTwoToneIcon from "@mui/icons-material/DriveFileMoveTwoTone";
import { SqlocalSerializableDB } from "./sqlite";
import { PathStackEntry } from "./App";
import { storeGetter } from "./utils";

export default function FileViewer({
  repo,
  pathStack,
  setPathStack,
  content,
}: {
  repo: Repository;
  pathStack: PathStackEntry[];
  setPathStack: React.Dispatch<React.SetStateAction<PathStackEntry[]>>;
  // current dir entries
  content: DirEntry[];
}) {
  const [mainRepo] = useState(new MainRepository(repo));

  const currentPath = pathStack[pathStack.length - 1];
  const [dirEntries, setDirEntries] = useState<(DirEntry & { id: string })[]>(
    []
  );
  useEffect(() => {
    (async () => {
      setDirEntries(content?.map((it) => ({ id: it.name, ...it })) ?? []);
    })();
  }, [content]);

  return (
    <DataGrid
      rows={dirEntries}
      columns={[
        {
          field: "icon",
          headerName: "",
          width: 30,
          renderCell: (params) => {
            const type = params.row.type;
            if (type === "dir") {
              return <FolderTwoToneIcon />;
            }
            if (type === "repo") {
              return <DriveFileMoveTwoToneIcon />;
            }
            return <InsertDriveFileTwoToneIcon />;
          },
        },
        { field: "name", headerName: "Name", flex: 2 },
        {
          field: "size",
          headerName: "Size",
          width: 110,
        },
        {
          field: "type",
          headerName: "Type",
          width: 110,
        },
        {
          field: "creationTime",
          headerName: "Created",
          width: 170,
          valueGetter: (_value, row) =>
            `${
              row.type === "file"
                ? new Date(row.creationTime).toLocaleString()
                : ""
            }`,
        },
        {
          field: "modificationTime",
          headerName: "Last modified",
          width: 170,
          valueGetter: (_value, row) =>
            `${
              row.type === "file"
                ? new Date(row.modificationTime).toLocaleString()
                : ""
            }`,
        },
      ]}
      onRowClick={async (params: GridRowParams<DirEntry>) => {
        const row = params.row;
        if (row.type === "dir") {
          setPathStack([
            ...pathStack.slice(0, -1),
            {
              repo: currentPath.repo,
              repoPath: [...currentPath.repoPath, row.name],
              path: [...currentPath.path, row.name],
            },
          ]);
          return;
        }
        if (row.type === "repo") {
          const child = await mainRepo.openChild(
            row.repoId,
            SqlocalSerializableDB,
            storeGetter
          );
          if (child === undefined) {
            return;
          }
          setPathStack([
            ...pathStack,
            {
              repo: child,
              repoPath: [],
              path: [...currentPath.path, row.name],
            },
          ]);
        }
      }}
      sx={{
        border: 0,
      }}
    />
  );
}
