import { z } from "zod";
import { Auth, c } from "./contract";

const Remote = z.object({
  type: z.enum(["sftp"]),
  host: z.string(),
  user: z.string(),
  keyPem: z.string(),
});

/** Endpoints for a trusted local server, e.g. when run locally in "Desktop" mode. */
export const contractLocal = c.router({
  pushRepo: {
    method: "POST",
    path: "/repos/push",
    description: "Sync repos",
    body: z.object({
      auth: Auth,
      encKey: z.string(),
      repoId: z.string(),
      from: z.object({
        path: z.string().optional(),
        branch: z.string().optional(),
        inlined: z.boolean().optional(),
      }),
      to: z.object({
        path: z.string(),
        branch: z.string().optional(),
        inlined: z.boolean().optional(),
      }),
    }),
    responses: {
      201: z.object({}),
    },
  },
  snapshotCheckout: {
    method: "POST",
    path: "/snapshot-checkout",
    description: "Snapshots checkout path into a repo",
    body: z.object({
      auth: Auth,
      encKey: z.string(),
      repoId: z.string(),
      checkoutPath: z.string(),
    }),
    responses: {
      201: z.object({}),
    },
  },
  snapshotCheckoutStatus: {
    method: "POST",
    path: "/snapshot-checkout-status",
    body: z.object({
      auth: Auth,
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
