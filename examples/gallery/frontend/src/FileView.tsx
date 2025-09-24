import { useEffect, useState } from "react";
import { DataGrid, GridRowParams } from "@mui/x-data-grid";
import FolderTwoToneIcon from "@mui/icons-material/FolderTwoTone";
import InsertDriveFileTwoToneIcon from "@mui/icons-material/InsertDriveFileTwoTone";
import DriveFileMoveTwoToneIcon from "@mui/icons-material/DriveFileMoveTwoTone";
import { VFSEntry } from "lib/src/vfs";

type ViewEntry = {
  id: string;
  entry: VFSEntry;
  stats?: {
    size: number;
    creationTime: number;
    modificationTime: number;
  };
};

const formatTime = (timestamp: number | undefined) => {
  if (timestamp === undefined) {
    return undefined;
  }
  return new Date(timestamp).toLocaleDateString();
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
      const viewEntries = await Promise.all(
        content.map(async (entry) => {
          if (entry.type === "file") {
            const stats = await entry.content.stats();
            return { id: entry.name, entry, stats };
          }
          return { id: entry.name, entry };
        })
      );

      viewEntries.sort((a, b) => {
        if (a.entry.type === "dir" && a.entry.type !== b.entry.type) {
          return -1;
        }
        return a.entry.name.localeCompare(b.entry.name);
      });
      setDirEntries(viewEntries);
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
        {
          field: "name",
          headerName: "Name",
          flex: 2,
          renderCell: (params) => {
            return params.row.entry.name;
          },
        },
        {
          field: "size",
          headerName: "Size",
          width: 110,
          renderCell: (params) => {
            return params.row.stats?.size;
          },
        },
        {
          field: "type",
          headerName: "Type",
          width: 110,
          renderCell: (params) => {
            return params.row.entry.type === "file"
              ? "File"
              : params.row.entry.type === "dir"
              ? "Dir"
              : "Repo";
          },
        },
        {
          field: "creationTime",
          headerName: "Created",
          width: 170,
          valueGetter: (_value, row) => formatTime(row.stats?.creationTime),
        },
        {
          field: "modificationTime",
          headerName: "Last modified",
          width: 170,
          valueGetter: (_value, row) => formatTime(row.stats?.modificationTime),
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
