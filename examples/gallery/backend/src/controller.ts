import { createExpressEndpoints, initServer } from "@ts-rest/express";
import { contract } from "./contract";
import multer from "multer";
import express from "express";
import { storeGetter } from "./service";
import cors from "cors";
import { Readable } from "stream";
import { hasRepoReadAccess, hasRepoWriteAccess, isAdmin } from "./auth";

const upload = multer();
const s = initServer();

const postsRouter = s.router(contract, {
  me: {
    handler: async () => {
      return { status: 200, body: { isAdmin } };
    },
  },

  postBlob: {
    middleware: [upload.single("blob")],
    handler: async ({ query, file }) => {
      if (!hasRepoWriteAccess(query.repoId)) {
        return { status: 403 };
      }
      const blob = file as Express.Multer.File;
      await storeGetter.get(query.repoId).write(query.path, blob.buffer);
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
  fileExists: async ({ query }) => {
    if (!hasRepoReadAccess(query.repoId)) {
      return { status: 403 };
    }
    const exists = await storeGetter.get(query.repoId).exists(query.path);
    return {
      status: 200,
      body: exists,
    };
  },
  getFile: async ({ res, query }) => {
    if (!hasRepoReadAccess(query.repoId)) {
      return { status: 403 };
    }
    const buffer = await storeGetter.get(query.repoId).read(query.path);
    res.setHeader("Content-type", "application/octet-stream");
    return {
      status: 200,
      body: Readable.from(buffer),
    };
  },
  list: async ({ query }) => {
    if (!hasRepoWriteAccess(query.repoId)) {
      return { status: 403 };
    }
    const content = await storeGetter.get(query.repoId).list(query.path);
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
