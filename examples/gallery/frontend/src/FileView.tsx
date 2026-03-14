import { useEffect, useState } from "react";
import FolderTwoToneIcon from "@mui/icons-material/FolderTwoTone";
import InsertDriveFileTwoToneIcon from "@mui/icons-material/InsertDriveFileTwoTone";
import DriveFileMoveTwoToneIcon from "@mui/icons-material/DriveFileMoveTwoTone";
import { VFSEntry } from "lib/src/vfs";
import { DataTable } from "mantine-datatable";
import "mantine-datatable/styles.layer.css";

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
        }),
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
    <DataTable
      withTableBorder
      withColumnBorders
      // provide data
      records={dirEntries}
      // define columns
      columns={[
        {
          title: "",
          accessor: "entry.type",
          width: 50,
          render: (row) => {
            const type = row.entry.type;
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
          accessor: "entry.name",
          title: "Name",
          textAlign: "left",
        },
        {
          accessor: "stats.size",
          title: "Size",
          width: 110,
        },
        {
          accessor: "entry.type",
          title: "Type",
          width: 110,
          render: (row) => {
            return row.entry.type === "file"
              ? "File"
              : row.entry.type === "dir"
                ? "Dir"
                : "Repo";
          },
        },
        {
          accessor: "stats.creationTime",
          title: "Created",
          width: 170,
          render: (row) => formatTime(row.stats?.creationTime),
        },
        {
          accessor: "stats.modificationTime",
          title: "Last modified",
          width: 170,
          render: (row) => formatTime(row.stats?.modificationTime),
        },
      ]}
      onRowClick={(row) => onDirEntryClicked(row.record.entry)}
    />
  );
}
