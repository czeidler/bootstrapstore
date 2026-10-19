import { contract } from "./contract";
import express from "express";
import { storeGetter } from "./service";
import cors from "cors";
import { authValidation } from "./auth";
import { syncRepo, pushRepo, syncRepoStatus } from "./trustedService";
import { diffWalk, RCloneVFSDir, Restic } from "lib-node";
import { ExhaustiveCheckError } from "lib";
import {
  lsEntryLSEntryToDirReader,
  RCloneRCCommands,
} from "lib-node/src/rclone";
import { RCloneJobManager } from "./rclone-job-manager";
import { contractLocal, SyncStatusEventsType } from "./contract-local";
import {
  finishLogin,
  finishRegistration,
  logout,
  startChildRegistration,
  startLogin,
  startRegistration,
  validateAuth,
} from "./user/auth-service";
import { Connection } from "./user/db";
import { implement, onError, ORPCError } from "@orpc/server";
import { OpenAPIHandler } from "@orpc/openapi/node";
import { TmpFileUploadHandlerPlugin } from "@orpc/node";

const os = implement(contract);

const mainRouter = ({
  connection,
  desktopMode,
}: {
  desktopMode?: { path: string };
  connection: Connection;
}) => {
  const { hasRepoReadAccess, hasRepoWriteAccess } = authValidation();
  return os.router({
    me: os.me.handler(async ({ input }) => {
      if (input.auth === undefined) {
        return { desktopMode };
      }
      if (!validateAuth(input.auth)) {
        throw new Error("Not authenticated");
      }
      return { desktopMode };
    }),
    startRegistration: os.startRegistration.handler(async ({ input }) => {
      return startRegistration(input.registrationRequest);
    }),
    finishRegistration: os.finishRegistration.handler(async ({ input }) => {
      const result = await finishRegistration(input, connection);
      return result;
    }),
    startChildRegistration: os.startChildRegistration.handler(
      async ({ input }) => {
        const result = startChildRegistration(
          input.auth,
          input.registrationRequest,
        );
        if (typeof result === "string") {
          return undefined;
        }
        return result;
      },
    ),
    startLogin: os.startLogin.handler(async ({ input }) => {
      const result = await startLogin(input, connection);
      return result;
    }),
    finishLogin: os.finishLogin.handler(async ({ input }) => {
      return finishLogin(input, connection);
    }),
    logout: os.logout.handler(async ({ input }) => {
      const result = logout(input.auth);
      if (typeof result === "string") {
        throw new ORPCError("UNAUTHORIZED");
      }
      return undefined;
    }),

    postBlob: os.postBlob.handler(async ({ input }) => {
      if (!hasRepoWriteAccess(input.repoId, input.auth)) {
        throw new ORPCError("UNAUTHORIZED");
      }
      const blob = input.blob;
      await storeGetter(input.auth.userId)
        .get(input.repoId)
        .write(input.path, await blob.bytes());
      return {
        blob: {
          name: blob.name,
        },
      };
    }),
    fileExists: os.fileExists.handler(async ({ input }) => {
      if (!hasRepoReadAccess(input.repoId, input.auth)) {
        throw new ORPCError("UNAUTHORIZED");
      }
      const exists = await storeGetter(input.auth.userId)
        .get(input.repoId)
        .exists(input.path);
      return exists;
    }),

    getFile: os.getFile.handler(async ({ input }) => {
      const { userId, sessionKey } = input.auth;
      const auth =
        sessionKey !== undefined ? { userId, sessionKey } : undefined;
      if (!hasRepoReadAccess(input.repoId, auth)) {
        throw new ORPCError("UNAUTHORIZED");
      }
      const buffer = await storeGetter(input.auth.userId)
        .get(input.repoId)
        .read(input.path);
      const file = new File([buffer], input.path.join("/"));

      return {
        file,
      };
    }),
    list: os.list.handler(async ({ input }) => {
      if (!hasRepoWriteAccess(input.repoId, input.auth)) {
        throw new ORPCError("UNAUTHORIZED");
      }
      const content = await storeGetter(input.auth.userId)
        .get(input.repoId)
        .list(input.path);
      return { content: content.map((it) => ({ name: it })) };
    }),
  });
};

export type AppConfig = {
  path: string;
  desktopMode: boolean;
  connection: Connection;
};

const osLocal = implement(contractLocal);
const localRouter = (config: AppConfig) => {
  const rsyncManager = new RCloneJobManager();
  return osLocal.router({
    syncStatusEvents: osLocal.syncStatusEvents.handler(async function* ({
      signal,
      input,
    }) {
      if (!config.desktopMode) {
        return;
      }
      while (!signal?.aborted) {
        const status = await rsyncManager.jobStatus(input.syncId);
        if (status === undefined) {
          return;
        }
        const event: SyncStatusEventsType = status.finished
          ? ({
              status: "ongoing",
            } satisfies SyncStatusEventsType)
          : status.success
            ? ({
                status: "success",
                endTime: status.endTime,
              } satisfies SyncStatusEventsType)
            : ({
                status: "error",
                error: status.error,
                endTime: status.endTime,
              } satisfies SyncStatusEventsType);

        yield event;
        if (event.status !== "ongoing") {
          return;
        }

        await new Promise((r) => setTimeout(r, 300));
      }
    }),

    pushRepo: osLocal.pushRepo.handler(async ({ input }) => {
      await pushRepo(input.auth.userId, input);
      return {};
    }),

    snapshotCheckoutStatus: osLocal.snapshotCheckoutStatus.handler(
      async ({ input }) => {
        const entry = await syncRepoStatus(input.auth.userId, input);
        return {
          changes: entry.map((it) => ({ path: it.path, status: it.type })),
        };
      },
    ),

    snapshotCheckout: osLocal.snapshotCheckout.handler(async ({ input }) => {
      await syncRepo(input.auth.userId, input);
      return {};
    }),
    ls: osLocal.ls.handler(async ({ input }) => {
      const { remote, path } = input;
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
      return { entries: await Promise.all(entries) };
    }),
    syncDir: osLocal.syncDir.handler(async ({ input }) => {
      await rsyncManager.syncDir(input.syncId, input.from, input.to);
      return undefined;
    }),
    syncStatus: osLocal.syncStatus.handler(async ({ input }) => {
      const status = await rsyncManager.jobStatus(input.syncId);
      return {
        status: status ? { finished: status?.finished } : undefined,
      };
    }),
    diff: osLocal.diff.handler(async ({ input }) => {
      const left = await RCloneRCCommands.operationsList(
        input.left.remote,
        input.left.path,
      );
      const leftReader = lsEntryLSEntryToDirReader(left.list);
      const right = await RCloneRCCommands.operationsList(
        input.right.remote,
        input.right.path,
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

      return result;
    }),
    resticBackup: osLocal.resticBackup.handler(async ({ input }) => {
      await Restic.backup(
        input.remote,
        input.resticTargetRepoPath,
        input.paths,
      );
      return undefined;
    }),
  });
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

  app.use(express.json());

  const handler = new OpenAPIHandler(
    {
      ...mainRouter({
        connection: config.connection,
        desktopMode: config.desktopMode ? { path: config.path } : undefined,
      }),
      ...localRouter(config),
    },
    {
      interceptors: [
        onError((error) => {
          console.error(error);
        }),
      ],
      plugins: [
        new TmpFileUploadHandlerPlugin({
          maxBodySize: {
            memory: 1024 * 1024, // JSON, forms, multipart text fields
            file: 500 * 1024 * 1024, // uploads spooled to disk
            stream: Number.POSITIVE_INFINITY, // event streams, raw streams
          },
        }),
      ],
    },
  );
  app.use("{/*path}", async (req, res, next) => {
    const { matched } = await handler.handle(req, res);
    if (matched) return;
    next();
  });

  return app;
};
