import Dialog from "@mui/material/Dialog";
import { Repository } from "lib";
import { Image } from "./Image";

export interface ImageDialogProps {
  repo: Repository | undefined;
  images: { src: string; path: string[]; width: number; height: number }[];
  selected: { src: string; path: string[] } | undefined;
  onClose: () => void;
}

export function ImageDialog(props: ImageDialogProps) {
  const { onClose, selected } = props;

  return (
    <Dialog
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
        repo={props.repo}
        path={selected?.path ?? []}
        src={selected?.src ?? ""}
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
