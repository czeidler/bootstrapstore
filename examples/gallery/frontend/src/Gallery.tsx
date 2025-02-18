import { RowsPhotoAlbum } from "react-photo-album";
import "react-photo-album/rows.css";
import { SqlocalSerializableDB } from "./sqlite";
import { HttpBlobStore } from "./HttpBlobStore";
import { Repository } from "lib";
import { useCallback, useEffect, useState } from "react";
import { ImageDialog } from "./ImageDialog";
import { Image } from "./Image";
import { Box, Pagination, Stack } from "@mui/material";
import { BlobStore, BlobStoreGetter } from "lib/src/blob-store";

const storeGetter: BlobStoreGetter = {
  get: function (repoId: string): BlobStore {
    return new HttpBlobStore(repoId);
  },
};

const baseWidth = 800;
const baseHeight = 600;

type RepoPhoto = { src: string; path: string[]; width: number; height: number };

export default function Gallery(props: { repoId: string; repoKey: Buffer }) {
  const [repo, setRepo] = useState<Repository>();

  const [images, setImages] = useState<RepoPhoto[] | undefined>(undefined);
  useEffect(() => {
    (async () => {
      const repo = await Repository.open(
        props.repoId,
        SqlocalSerializableDB,
        storeGetter,
        {
          key: props.repoKey,
          branch: "main",
          inlined: false,
        }
      );
      setRepo(repo);
    })();
  }, [props]);

  useEffect(() => {
    if (repo === undefined) {
      return;
    }
    (async () => {
      const baseDir: string[] = [];
      const content = await repo.listDirectory(baseDir);
      setImages(
        content
          ?.filter((it) => it.name.endsWith(".jpg"))
          .map((it) => ({
            src: [...baseDir, it.name].join("/"),
            path: [...baseDir, it.name],
            width: baseWidth,
            height: baseHeight,
          })) ?? []
      );
    })();
  }, [repo]);
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
      <Stack direction={"column"} height="100%">
        <Box overflow={"auto"}>
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
                  repo={repo}
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
        </Box>
        <Pagination
          count={Math.ceil((images?.length ?? 0) / imagesPerPage)}
          page={page + 1}
          onChange={(_, value) => {
            setPage(value - 1);
          }}
          sx={{ margin: "auto", marginBottom: 0 }}
        />
      </Stack>
      <ImageDialog
        repo={repo}
        images={images ?? []}
        onClose={() => {
          setSelected(undefined);
        }}
        selected={selected}
      />
    </>
  );
}
