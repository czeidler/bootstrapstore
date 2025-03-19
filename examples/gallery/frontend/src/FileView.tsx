import { useEffect, useState } from "react";
import { DataGrid, GridRowParams } from "@mui/x-data-grid";
import { DirEntry } from "lib/src/repository";
import FolderTwoToneIcon from "@mui/icons-material/FolderTwoTone";
import InsertDriveFileTwoToneIcon from "@mui/icons-material/InsertDriveFileTwoTone";
import DriveFileMoveTwoToneIcon from "@mui/icons-material/DriveFileMoveTwoTone";

export default function FileView({
  content,
  openFolder,
}: {
  openFolder: (row: DirEntry) => Promise<void>;
  // current dir entries
  content: DirEntry[];
}) {
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
        openFolder(params.row);
      }}
      sx={{
        border: 0,
      }}
    />
  );
}
