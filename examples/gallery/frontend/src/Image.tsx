import { RenderImageProps } from "react-photo-album";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CircularProgress } from "@mui/material";
import { VFSFile } from "lib/src/vfs";

const useLoadImage = (file: VFSFile | undefined, path: string[]) => {
  return useQuery({
    queryKey: [...path],
    queryFn: async () => {
      if (file === undefined) {
        return;
      }
      const data = await file.read();
      const blob = new Blob([data]);

      const bitmap = await createImageBitmap(blob);
      // Create a URL for the Blob
      const imageUrl = URL.createObjectURL(blob);
      return { imageUrl, height: bitmap.height, width: bitmap.width };
    },
  });
};

export type ImageProps = {
  file: VFSFile | undefined;
  path: string[];
  thumbnail: boolean;
  onLoaded?: (image: { width: number; height: number }) => void;
} & RenderImageProps;

export function Image(props: ImageProps) {
  const { data, isLoading } = useLoadImage(props.file, props.path);
  const [isLoaded, setIsLoaded] = useState(false);
  useEffect(() => {
    if (isLoaded || data === undefined) {
      return;
    }
    props.onLoaded?.(data);
    setIsLoaded(true);
  }, [data, isLoaded, props]);

  return isLoading ? (
    <CircularProgress />
  ) : (
    <img
      className={props.className}
      sizes={props.sizes}
      loading={props.loading}
      //decoding={props.decoding}
      src={data?.imageUrl}
      style={{
        objectFit: "contain",
        maxHeight: "100%",
        maxWidth: "100%",
        marginTop: "auto",
        marginBottom: "auto",
      }}
    />
  );
}
