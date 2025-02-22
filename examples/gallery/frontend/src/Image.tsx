import { RenderImageProps } from "react-photo-album";
import { Repository } from "lib";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CircularProgress } from "@mui/material";

const useLoadImage = (
  repo: Repository | undefined,
  path: string[],
  thumbnails: boolean
) => {
  return useQuery({
    queryKey: [...path],
    queryFn: async () => {
      if (repo === undefined) {
        return;
      }
      const fileName = path[path.length - 1];
      const file = await repo?.readFile([
        ...path.slice(0, -1),
        ...(thumbnails ? [".thumbnails"] : []),
        fileName,
      ]);
      if (file === undefined) {
        return;
      }
      const blob = new Blob([file]);

      const bitmap = await createImageBitmap(blob);
      // Create a URL for the Blob
      const imageUrl = URL.createObjectURL(blob);
      return { imageUrl, height: bitmap.height, width: bitmap.width };
    },
  });
};

export type ImageProps = {
  repo: Repository | undefined;
  thumbnail: boolean;
  path: string[];
  onLoaded?: (image: { width: number; height: number }) => void;
} & RenderImageProps;

export function Image(props: ImageProps) {
  const { data, isLoading } = useLoadImage(
    props.repo,
    props.path,
    props.thumbnail
  );
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
