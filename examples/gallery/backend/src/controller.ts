import { createExpressEndpoints, initServer } from "@ts-rest/express";
import { contract } from "./contract";
import multer from "multer";
import express from "express";
import { store } from "./service";
import cors from "cors";
import { Readable } from "stream";

const upload = multer();
const s = initServer();

const postsRouter = s.router(contract, {
  postBlob: {
    middleware: [upload.single("blob")],
    handler: async ({ query, file }) => {
      throw new Error("Not supported");
      const blob = file as Express.Multer.File;
      await store.write(query.path, blob.buffer);
      return {
        status: 201,
        body: {
          blob: {
            name: blob.originalname,
          },
        },
      };
    },
  },
  getFile: async ({ res, query }) => {
    const buffer = await store.read(query.path);
    res.setHeader("Content-type", "application/octet-stream");
    return {
      status: 200,
      body: Readable.from(buffer),
    };
  },
  list: async ({ query }) => {
    throw new Error("Not supported");
    const content = await store.list(query.path);
    return {
      status: 200,
      body: { content: content.map((it) => ({ name: it })) },
    };
  },
});

export const app = express();

app.use(
  cors({
    methods: ["POST", "GET", "OPTIONS"],
    origin: function (_origin, callback) {
      // allow all origins
      callback(null, true);
    },
  })
);

createExpressEndpoints(contract, postsRouter, app);
