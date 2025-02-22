import { RowsPhotoAlbum } from "react-photo-album";
import "react-photo-album/rows.css";
import { useCallback, useEffect, useState } from "react";
import { ImageDialog } from "./ImageDialog";
import { Image } from "./Image";
import { Pagination, Stack } from "@mui/material";
import { PathStackEntry } from "./App";
import { DirEntry } from "lib/src/repository";
import { imageExtensions } from "./utils";

const baseWidth = 800;
const baseHeight = 600;

type RepoPhoto = { src: string; path: string[]; width: number; height: number };

export default function Gallery({
  path,
  content,
}: {
  path: PathStackEntry;
  content: DirEntry[];
}) {
  const [images, setImages] = useState<RepoPhoto[] | undefined>(undefined);

  useEffect(() => {
    (async () => {
      setImages(
        content
          ?.filter((it) =>
            imageExtensions.some((ext) =>
              it.name.toLocaleLowerCase().endsWith(ext)
            )
          )
          .map((it) => ({
            src: [...path.repoPath, it.name].join("/"),
            path: [...path.repoPath, it.name],
            width: baseWidth,
            height: baseHeight,
          })) ?? []
      );
    })();
  }, [path, content]);
  // Update image dimensions
  const onLoaded = useCallback(
    (index: number, image: { width: number; height: number }) => {
      const newImages = [...(images ?? [])];
      newImages[index].width = image.width;
      newImages[index].height = image.height;
      setImages(newImages);
    },
    [images]
  );

  const [selected, setSelected] = useState<
    { src: string; path: string[] } | undefined
  >(undefined);
  const [page, setPage] = useState(0);
  const imagesPerPage = 25;
  const imagesOnPage = images?.slice(
    page * imagesPerPage,
    page * imagesPerPage + imagesPerPage
  );
  return (
    <>
      <Stack overflow={"auto"}>
        <RowsPhotoAlbum
          sizes={{ size: "100vw" }}
          rowConstraints={{
            maxPhotos: 3,
          }}
          defaultContainerWidth={1000}
          photos={imagesOnPage ?? []}
          onClick={(e) => setSelected(e.photo)}
          render={{
            image: (props, context) => (
              <Image
                repo={path.repo}
                path={context.photo.path}
                {...props}
                onLoaded={(image) =>
                  onLoaded(page * imagesPerPage + context.index, image)
                }
                thumbnail={true}
              />
            ),
          }}
        />
      </Stack>
      <Pagination
        count={Math.ceil((images?.length ?? 0) / imagesPerPage)}
        page={page + 1}
        onChange={(_, value) => {
          setPage(value - 1);
        }}
        sx={{ margin: "auto", marginBottom: 0 }}
      />

      <ImageDialog
        repo={path.repo}
        images={images ?? []}
        onClose={() => {
          setSelected(undefined);
        }}
        selected={selected}
      />
    </>
  );
}
