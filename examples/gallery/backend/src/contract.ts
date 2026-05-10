import { initContract } from "@ts-rest/core";
import { Express } from "express";
import { z, ZodType } from "zod";

const c = initContract();

type SSEEndpoint = {
  path: string;
  query: ZodType;
  streamBody: ZodType;
};
export const contractSSE = {
  syncStatusEvents: {
    path: "/sync-status-events",
    query: z.object({ syncId: z.string() }),
    streamBody: z
      .discriminatedUnion("status", [
        z.object({
          status: z.literal("error"),
          error: z.string(),
          endTime: z.string(),
        }),
        z.object({ status: z.literal("success"), endTime: z.string() }),
        z.object({ status: z.literal("ongoing") }),
      ])
      .optional(),
  },
};
export type SyncStatusSEEBodyType = z.infer<
  typeof contractSSE.syncStatusEvents.streamBody
>;

export function serverSSEHandler<T extends SSEEndpoint>(
  app: Express,
  endpoint: T,
  /** Returns a clean up method to be called when the client terminates the connection */
  handler: (params: {
    query: z.infer<T["query"]>;
    onEvent: (event: z.infer<T["streamBody"]>) => void;
    /** End the connection to the client (doesn't call the clean up method) */
    end: () => void;
  }) => () => void,
) {
  app.get(endpoint.path, async (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const query =
      endpoint.query !== undefined
        ? endpoint.query.parse(req.query)
        : undefined;
    const cleanUp = await handler({
      query,
      onEvent: (event: T["streamBody"]) => {
        res.write(`data: ${JSON.stringify({ event })}\n\n`);
      },
      end: () => res.end(),
    });
    req.on("close", () => {
      cleanUp();
      res.end();
    });
  });
}

export const contract = c.router({
  me: {
    method: "GET",
    path: "/me",
    responses: {
      200: z.object({
        admin: z
          .object({
            /** Working dir path on th server */
            path: z.string(),
          })
          .optional(),
      }),
    },
  },

  postBlob: {
    method: "POST",
    path: "/blobs",
    contentType: "multipart/form-data",
    query: z.object({
      repoId: z.string().optional(),
      path: z.array(z.string()),
    }),
    body: c.type<{ blob: File }>(),
    responses: {
      201: z.object({
        blob: z.object({
          name: z.string(),
        }),
      }),
      403: z.undefined(),
    },
  },
  fileExists: {
    method: "GET",
    path: "/blobs/exists",
    query: z.object({
      repoId: z.string().optional(),
      path: z.array(z.string()),
    }),
    responses: {
      200: z.boolean(),
      403: z.undefined(),
    },
  },
  getFile: {
    method: "GET",
    path: "/blobs",
    headers: z.object({
      "Content-Type": z.string().optional(),
      "Content-disposition": z.string().optional(),
    }),
    query: z.object({
      repoId: z.string().optional(),
      path: z.array(z.string()),
    }),
    responses: {
      200: z.unknown(),
      403: z.undefined(),
    },
    summary: "Get an blob",
  },
  list: {
    method: "GET",
    path: "/ls",
    query: z.object({
      repoId: z.string().optional(),
      path: z.array(z.string()),
    }),
    responses: {
      200: z.object({
        content: z.array(
          z.object({
            name: z.string(),
          }),
        ),
      }),
      403: z.undefined(),
    },
  },
});

const Remote = z.object({
  type: z.enum(["sftp"]),
  host: z.string(),
  user: z.string(),
  keyPem: z.string(),
});

/** Endpoints for a trusted server, e.g. when run locally. */
export const trustedContract = c.router({
  syncRepo: {
    method: "POST",
    path: "/sync-repo",
    body: z.object({
      encKey: z.string(),
      repoId: z.string(),
      checkoutPath: z.string(),
    }),
    responses: {
      201: z.object({}),
    },
  },
  syncRepoStatus: {
    method: "POST",
    path: "/sync-repo-status",
    body: z.object({
      encKey: z.string(),
      repoId: z.string(),
      checkoutPath: z.string(),
    }),
    responses: {
      201: z.object({
        changes: z.array(
          z.object({
            path: z.array(z.string()),
            status: z.enum(["Added", "Deleted", "Changed"]),
          }),
        ),
      }),
    },
  },
  ls: {
    method: "POST",
    path: "/ls",
    body: z.object({
      remote: Remote.optional(),
      path: z.string(),
    }),
    responses: {
      201: z.object({
        entries: z.array(
          z.discriminatedUnion("type", [
            z.object({
              type: z.literal("dir"),
              name: z.string(),
            }),
            z.object({
              type: z.literal("file"),
              name: z.string(),
              size: z.number().int(),
              creationTime: z.number().int(),
              modificationTime: z.number().int(),
            }),
          ]),
        ),
      }),
    },
  },
  syncDir: {
    method: "POST",
    path: "/sync-dir",
    body: z.object({
      syncId: z.string(),
      from: z.object({ remote: Remote.optional(), path: z.string() }),
      to: z.object({ remote: Remote.optional(), path: z.string() }),
    }),
    responses: {
      201: z.void(),
    },
  },
  syncStatus: {
    method: "GET",
    path: "/sync-status",
    query: z.object({
      syncId: z.string(),
    }),
    responses: {
      200: z.object({
        status: z
          .object({
            finished: z.boolean(),
          })
          .optional(),
      }),
    },
  },
  diff: {
    method: "POST",
    path: "/diff",
    body: z.object({
      left: z.object({ remote: Remote.optional(), path: z.string() }),
      right: z.object({ remote: Remote.optional(), path: z.string() }),
    }),
    responses: {
      201: z.object({
        added: z.array(
          z.object({
            path: z.array(z.string()),
          }),
        ),
        deleted: z.array(
          z.object({
            path: z.array(z.string()),
          }),
        ),
        changed: z.array(
          z.object({
            path: z.array(z.string()),
          }),
        ),
      }),
      403: z.undefined(),
    },
  },
});
