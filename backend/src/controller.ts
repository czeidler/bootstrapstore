import { createExpressEndpoints, initServer } from "@ts-rest/express";
import {
  contract,
  contractSSE,
  serverSSEHandler,
  SyncStatusSEEBodyType,
} from "./contract";
import multer from "multer";
import express from "express";
import { storeGetter } from "./service";
import cors from "cors";
import { Readable } from "stream";
import { authValidation } from "./auth";
import { syncRepo, pushRepo, syncRepoStatus } from "./trustedService";
import { diffWalk, RCloneVFSDir } from "lib-node";
import { ExhaustiveCheckError } from "lib";
import {
  lsEntryLSEntryToDirReader,
  RCloneRCCommands,
} from "lib-node/src/rclone";
import { RCloneJobManager } from "./rclone-job-manager";
import { contractLocal } from "./contractLocal";
import {
  finishLogin,
  finishRegistration,
  logout,
  startLogin,
  startRegistration,
  validateAuth,
} from "./user/auth-service";
import { Connection } from "./user/db";

const upload = multer();
const s = initServer();

const mainRouter = ({
  connection,
  desktopMode,
}: {
  desktopMode?: { path: string };
  connection: Connection;
}) => {
  const { hasRepoReadAccess, hasRepoWriteAccess } = authValidation();
  return s.router(contract, {
    me: {
      handler: async ({ query }) => {
        if (query.auth === undefined) {
          return { status: 200, body: { desktopMode } };
        }
        if (!validateAuth(query.auth)) {
          throw new Error("Not authenticated");
        }
        return { status: 200, body: { desktopMode } };
      },
    },

    startRegistration: {
      handler: async ({ body }) => {
        return {
          status: 201,
          body: startRegistration(body.registrationRequest),
        };
      },
    },
    finishRegistration: {
      handler: async ({ body }) => {
        const result = await finishRegistration(body, connection);
        return {
          status: 201,
          body: result,
        };
      },
    },
    startLogin: {
      handler: async ({ body }) => {
        const result = await startLogin(body, connection);
        return {
          status: 201,
          body: result,
        };
      },
    },
    finishLogin: {
      handler: async ({ body }) => {
        return {
          status: 201,
          body: await finishLogin(body, connection),
        };
      },
    },
    logout: {
      handler: async ({ body }) => {
        logout(body.auth);
        return {
          status: 201,
          body: undefined,
        };
      },
    },

    postBlob: {
      middleware: [upload.single("blob")],
      handler: async ({ query, file }) => {
        if (!hasRepoWriteAccess(query.repoId, query.auth)) {
          return { status: 403 };
        }
        const blob = file as Express.Multer.File;
        await storeGetter(query.auth.userId)
          .get(query.repoId)
          .write(query.path, blob.buffer);
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
      if (!hasRepoReadAccess(query.repoId, query.auth)) {
        return { status: 403 };
      }
      const exists = await storeGetter(query.auth.userId)
        .get(query.repoId)
        .exists(query.path);
      return {
        status: 200,
        body: exists,
      };
    },
    getFile: async ({ res, query }) => {
      const { userId, sessionKey } = query.auth;
      const auth =
        sessionKey !== undefined ? { userId, sessionKey } : undefined;
      if (!hasRepoReadAccess(query.repoId, auth)) {
        return { status: 403 };
      }
      const buffer = await storeGetter(query.auth.userId)
        .get(query.repoId)
        .read(query.path);
      res.setHeader("Content-type", "application/octet-stream");
      return {
        status: 200,
        body: Readable.from(buffer),
      };
    },
    list: async ({ query }) => {
      if (!hasRepoWriteAccess(query.repoId, query.auth)) {
        return { status: 403 };
      }
      const content = await storeGetter(query.auth.userId)
        .get(query.repoId)
        .list(query.path);
      return {
        status: 200,
        body: { content: content.map((it) => ({ name: it })) },
      };
    },
  });
};

export type AppConfig = {
  path: string;
  desktopMode: boolean;
  connection: Connection;
};

export const buildApp = (config: AppConfig) => {
  const rsyncManager = new RCloneJobManager();
  const app = express();
  app.use(express.json());

  app.use(
    cors({
      methods: ["POST", "GET", "OPTIONS"],
      origin: function (_origin, callback) {
        // allow all origins
        callback(null, true);
      },
    }),
  );

  createExpressEndpoints(
    contract,
    mainRouter({
      connection: config.connection,
      desktopMode: config.desktopMode ? { path: config.path } : undefined,
    }),
    app,
    { jsonQuery: true },
  );

  if (config.desktopMode) {
    serverSSEHandler(
      app,
      contractSSE.syncStatusEvents,
      ({ query, onEvent, end }) => {
        const interval = setInterval(async () => {
          const status = await rsyncManager.jobStatus(query.syncId);
          const event: SyncStatusSEEBodyType | undefined =
            status === undefined
              ? undefined
              : !status.finished
                ? ({
                    status: "ongoing",
                  } satisfies SyncStatusSEEBodyType)
                : status.success
                  ? ({
                      status: "success",
                      endTime: status.endTime,
                    } satisfies SyncStatusSEEBodyType)
                  : ({
                      status: "error",
                      error: status.error,
                      endTime: status.endTime,
                    } satisfies SyncStatusSEEBodyType);

          onEvent(event);
          if (event?.status !== "ongoing") {
            clearInterval(interval);
            end();
          }
        }, 300);
        return () => {
          clearInterval(interval);
        };
      },
    );

    const trustedRouter = s.router(contractLocal, {
      pushRepo: {
        handler: async ({ body }) => {
          await pushRepo(body.auth.userId, body);
          return {
            status: 201,
            body: {},
          };
        },
      },
      snapshotCheckoutStatus: {
        handler: async ({ body }) => {
          const entry = await syncRepoStatus(body.auth.userId, body);
          return {
            status: 201,
            body: {
              changes: entry.map((it) => ({ path: it.path, status: it.type })),
            },
          };
        },
      },
      snapshotCheckout: {
        handler: async ({ body }) => {
          await syncRepo(body.auth.userId, body);
          return { status: 200, body: {} };
        },
      },
      ls: {
        handler: async ({ body }) => {
          const { remote, path } = body;
          const result = await new RCloneVFSDir(path, remote).list();
          const entries = result.map(async (it) => {
            switch (it.type) {
              case "dir":
                return { type: "dir", name: it.name } satisfies {
                  type: "dir";
                  name: string;
                };

              case "repo": {
                throw Error("Internal error");
              }

              case "file": {
                const st = await it.content.stats();
                return {
                  type: "file",
                  name: it.name,
                  size: st.size,
                  creationTime: st.creationTime,
                  modificationTime: st.modificationTime,
                } satisfies {
                  type: "file";
                  name: string;
                  size: number;
                  creationTime: number;
                  modificationTime: number;
                };
              }
              default:
                throw new ExhaustiveCheckError(it);
            }
          });
          return { status: 201, body: { entries: await Promise.all(entries) } };
        },
      },
      syncDir: {
        handler: async ({ body }) => {
          await rsyncManager.syncDir(body.syncId, body.from, body.to);
          return {
            status: 201,
            body: undefined,
          };
        },
      },
      syncStatus: {
        handler: async ({ query }) => {
          const status = await rsyncManager.jobStatus(query.syncId);
          return {
            status: 200,
            body: {
              status: status ? { finished: status?.finished } : undefined,
            },
          };
        },
      },
      diff: {
        handler: async ({ body }) => {
          const left = await RCloneRCCommands.operationsList(
            body.left.remote,
            body.left.path,
          );
          const leftReader = lsEntryLSEntryToDirReader(left.list);
          const right = await RCloneRCCommands.operationsList(
            body.right.remote,
            body.right.path,
          );
          const rightReader = lsEntryLSEntryToDirReader(right.list);

          const result: {
            added: { path: string[] }[];
            deleted: { path: string[] }[];
            changed: { path: string[] }[];
          } = { added: [], deleted: [], changed: [] };
          await diffWalk(leftReader, rightReader, (it) => {
            if (it.type === "Added") {
              result.added.push({ path: it.path });
            }
            if (it.type === "Deleted") {
              result.deleted.push({ path: it.path });
            }
            if (it.type === "Changed") {
              result.changed.push({ path: it.path });
            }
          });

          return {
            status: 201,
            body: result,
          };
        },
      },
    });
    createExpressEndpoints(contractLocal, trustedRouter, app);
  }

  return app;
};
