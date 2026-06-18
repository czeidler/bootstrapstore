import { RowsPhotoAlbum } from "react-photo-album";
import "react-photo-album/rows.css";
import { useCallback, useEffect, useState } from "react";
import { ImageDialog } from "./ImageDialog";
import { Image } from "./Image";
import { Pagination, Stack } from "@mui/material";
import { imageExtensions } from "./utils";
import { VFSEntry, VFSFile } from "lib/src/vfs";
import { useFileNavigation } from "./useFileNavigation";

const baseWidth = 800;
const baseHeight = 600;

type RepoPhoto = {
  file: VFSFile;
  src: string;
  path: string[];
  width: number;
  height: number;
};

export default function GalleryView({
  dirPath,
  content,
}: {
  dirPath: string[];
  content: VFSEntry[];
}) {
  // selected full image
  const [selected, setSelected] = useState<
    { file: VFSFile; path: string[] } | undefined
  >(undefined);

  const thumbnailDir = content.find((it) => it.name === ".thumbnails");
  const { dirEntries: thumbnailDirEntries } = useFileNavigation(
    thumbnailDir?.type === "dir" ? thumbnailDir?.content : undefined,
  );
  const files = (thumbnailDir ? thumbnailDirEntries : content)
    .filter((it) => it.type === "file")
    .filter((it) => content.some((c) => c.name === it.name));

  const [photos, setPhotos] = useState<RepoPhoto[] | undefined>(undefined);

  useEffect(() => {
    (async () => {
      setPhotos(
        files
          ?.filter((it) => it.type === "file")
          .filter((it) =>
            imageExtensions.some((ext) =>
              it.name.toLocaleLowerCase().endsWith(ext),
            ),
          )
          .map((it) => ({
            file: it.content,
            src: [...dirPath, it.name].join("/"),
            path: [...dirPath, it.name],
            width: baseWidth,
            height: baseHeight,
          })) ?? [],
      );
    })();
  }, [dirPath, files]);
  // Update image dimensions
  const onLoaded = useCallback(
    (index: number, image: { width: number; height: number }) => {
      const newImages = [...(photos ?? [])];
      newImages[index].width = image.width;
      newImages[index].height = image.height;
      setPhotos(newImages);
    },
    [photos],
  );

  const [page, setPage] = useState(0);
  const imagesPerPage = 25;
  const imagesOnPage = photos?.slice(
    page * imagesPerPage,
    page * imagesPerPage + imagesPerPage,
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
          onClick={(e) => {
            const name = e.photo.path[e.photo.path.length - 1];
            const image = content.find((it) => it.name === name);
            setSelected(
              image?.type === "file"
                ? { path: [...dirPath, name], file: image.content }
                : undefined,
            );
          }}
          render={{
            image: (props, context) => (
              <Image
                file={context.photo.file}
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
        count={Math.ceil((photos?.length ?? 0) / imagesPerPage)}
        page={page + 1}
        onChange={(_, value) => {
          setPage(value - 1);
        }}
        sx={{ margin: "auto", marginBottom: 0 }}
      />

      <ImageDialog
        onClose={() => {
          setSelected(undefined);
        }}
        selected={selected}
      />
    </>
  );
}
