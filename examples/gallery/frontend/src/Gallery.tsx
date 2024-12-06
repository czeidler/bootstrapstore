import { RenderImageProps, RowsPhotoAlbum } from "react-photo-album";
import "react-photo-album/rows.css";
import { SqlocalSerializableDB } from "./sqlite";
import { HttpBlobStore } from "./HttpBlobStore";
import { Repository } from "lib";
import { useEffect, useState } from "react";

const store = new HttpBlobStore();

function Image(
  props: { repo: Repository | undefined; path: string } & RenderImageProps
) {
  console.log(`image`);
  const [image, setImage] = useState<string | undefined>();
  useEffect(() => {
    if (props.repo === undefined) {
      return;
    }
    (async () => {
      const file = await props.repo?.readFile(props.path.split("//"));
      console.log(file);

      if (file === undefined) {
        return;
      }
      const blob = new Blob([file]);

      // Create a URL for the Blob
      const blobUrl = URL.createObjectURL(blob);
      setImage(blobUrl);
    })();
  }, [props.path, props.repo]);
  if (props.repo === undefined || image === undefined) {
    return null;
  }

  return <img {...props} src={image} />;
}

function passwordToKey(password: string): Buffer {
  const buffer = Buffer.alloc(16, 0); // Create a 16-byte buffer filled with zeros
  const passwordBuffer = Buffer.from(password, "utf8");
  passwordBuffer.copy(buffer, 0, 0, Math.min(passwordBuffer.length, 16));
  return buffer;
}

export default function Gallery() {
  const [repo, setRepo] = useState<Repository>();

  const [imagePaths, setImagePaths] = useState<string[]>([]);
  useEffect(() => {
    (async () => {
      const indexData = await store.read(["index"]);
      console.log(indexData);
      const key = passwordToKey("mySecret123");
      const repo = await Repository.open(
        "noid",
        SqlocalSerializableDB,
        store,
        [],
        key
      );
      setRepo(repo);
    })();
  }, []);

  useEffect(() => {
    if (repo === undefined) {
      return;
    }
    (async () => {
      const baseDir: string[] = ["./testData"];
      const content = await repo.listDirectory(baseDir);
      console.log(content);
      setImagePaths(
        content?.map((it) => [...baseDir, it.name].join("//")) ?? []
      );
    })();
  }, [repo]);

  return (
    <RowsPhotoAlbum
      sizes={{ size: "100vw" }}
      defaultContainerWidth={1000}
      photos={imagePaths.map((it) => ({
        src: it,
        width: 800,
        height: 600,
      }))}
      render={{
        image: (props) => <Image repo={repo} path={props.src} {...props} />,
      }}
    />
  );
}
