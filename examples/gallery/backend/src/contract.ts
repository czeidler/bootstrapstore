import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

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
