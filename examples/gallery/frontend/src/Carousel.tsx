import { Repository } from "lib";
import { Image } from "./Image";

export function Carousel(props: {
  repo: Repository | undefined;
  images: { src: string; path: string[]; width: number; height: number }[];
}) {
  return (
    <Image
      repo={props.repo}
      path={props.images[0].path}
      src={props.images[0].src}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "contain",
      }}
    />
  );
}
