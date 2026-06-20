import { Modal } from "@mantine/core";
import { Image } from "./Image";
import { VFSFile } from "lib/src/vfs";

export interface ImageDialogProps {
  selected: { file: VFSFile; path: string[] } | undefined;
  onClose: () => void;
}

export function ImageDialog(props: ImageDialogProps) {
  const { onClose, selected } = props;

  return (
    <Modal
      size="lg"
      onClick={onClose}
      onClose={onClose}
      opened={selected !== undefined}
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
    </Modal>
  );
}
