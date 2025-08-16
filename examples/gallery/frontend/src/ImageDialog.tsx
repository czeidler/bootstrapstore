import Dialog from "@mui/material/Dialog";
import { Image } from "./Image";
import { VFSFile } from "lib/src/vfs";

export interface ImageDialogProps {
  selected: { file: VFSFile; path: string[] } | undefined;
  onClose: () => void;
}

export function ImageDialog(props: ImageDialogProps) {
  const { onClose, selected } = props;

  return (
    <Dialog
      onClick={onClose}
      onClose={onClose}
      open={selected !== undefined}
      maxWidth={"xl"}
      PaperProps={{
        sx: {
          width: "75vw",
          height: "98vh",
          maxWidth: "100%",
          maxHeight: "100%",
        },
      }}
    >
      <Image
        file={selected?.file}
        path={selected?.path ?? []}
        src={selected?.path.join("/") ?? ""}
        thumbnail={false}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
        }}
      />
    </Dialog>
  );
}
