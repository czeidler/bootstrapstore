import { useQuery } from "@tanstack/react-query";
import { trustedTsr } from "./tsr";
import { DataTable } from "mantine-datatable";

export function SyncDirStatus({
  fromPath,
  toPath,
}: {
  fromPath: string;
  toPath: string;
}) {
  const { data } = useQuery({
    queryKey: ["diff"],
    queryFn: async () => {
      const diff = await trustedTsr.diff({
        body: {
          left: {
            path: fromPath,
          },
          right: { path: toPath },
        },
      });
      if (diff.status !== 201) {
        throw Error(`HTTP status ${diff.status}`);
      }
      return diff.body;
    },
  });
  if (data === undefined) return <></>;

  const entries = [
    ...data.added.map((it) => ({ type: "added", entry: it })),
    ...data.deleted.map((it) => ({ type: "deleted", entry: it })),
    ...data.changed.map((it) => ({ type: "changed", entry: it })),
  ];
  return (
    <DataTable
      withTableBorder
      withColumnBorders
      records={entries}
      idAccessor={"entry"}
      columns={[
        {
          title: "",
          accessor: "",
          width: 50,
          render: (row) => {
            switch (row.type) {
              case "added":
                return "A";
              case "deleted":
                return "D";
              case "changed":
                return "C";
            }
          },
        },
        {
          accessor: "entry",
          title: "Path",
          render: (row) => {
            return row.entry.path.join("/");
          },
        },
      ]}
    />
  );
}
