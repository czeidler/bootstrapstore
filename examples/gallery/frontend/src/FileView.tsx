import { useEffect, useState } from "react";
import { DataGrid, GridRowParams } from "@mui/x-data-grid";
import FolderTwoToneIcon from "@mui/icons-material/FolderTwoTone";
import InsertDriveFileTwoToneIcon from "@mui/icons-material/InsertDriveFileTwoTone";
import DriveFileMoveTwoToneIcon from "@mui/icons-material/DriveFileMoveTwoTone";
import { VFSEntry } from "lib/src/vfs";

type ViewEntry = {
  entry: VFSEntry;
  stats?: {
    size: number;
    creationTime: number;
    modificationTime: number;
  };
};

export default function FileView({
  content,
  onDirEntryClicked,
}: {
  onDirEntryClicked: (row: VFSEntry) => Promise<void>;
  // current dir entries
  content: VFSEntry[];
}) {
  const [dirEntries, setDirEntries] = useState<ViewEntry[]>([]);
  useEffect(() => {
    (async () => {
      const viewEntries = content.map(async (entry) => {
        if (entry.type === "file") {
          const stats = await entry.content.stats();
          return { entry, stats };
        }
        return { entry };
      });
      setDirEntries(await Promise.all(viewEntries));
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
            const type = params.row.entry.type;
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
          valueGetter: (_value, row) => `${row.stats?.creationTime ?? ""}`,
        },
        {
          field: "modificationTime",
          headerName: "Last modified",
          width: 170,
          valueGetter: (_value, row) => `${row.stats?.modificationTime ?? ""}`,
        },
      ]}
      onRowClick={async (params: GridRowParams<ViewEntry>) => {
        onDirEntryClicked(params.row.entry);
      }}
      sx={{
        border: 0,
      }}
    />
  );
}
