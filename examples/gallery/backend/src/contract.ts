import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

export const contract = c.router({
  me: {
    method: "GET",
    path: "/me",
    responses: {
      200: z.object({
        isAdmin: z.boolean(),
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
          })
        ),
      }),
      403: z.undefined(),
    },
  },
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
          })
        ),
      }),
    },
  },
  copy: {
    method: "POST",
    path: "/copy",
    body: z.object({
      host: z.string(),
      user: z.string(),
      keyPem: z.string(),
    }),
    responses: {
      201: z.object({}),
    },
  },
});
