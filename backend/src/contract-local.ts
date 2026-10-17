import { oc } from "@orpc/contract";
import { openapi } from "@orpc/openapi";
import { z } from "zod";
import { Auth } from "./contract";

const Remote = z.object({
  type: z.enum(["sftp"]),
  host: z.string(),
  user: z.string(),
  keyPem: z.string(),
});

/** Endpoints for a trusted local server, e.g. when run locally in "Desktop" mode. */
export const contractLocal = {
  pushRepo: oc
    .meta(
      openapi({
        path: "/repos/push",
        description: "Sync repos",
      }),
    )
    .input(
      z.object({
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
    )
    .output(z.object({})),

  snapshotCheckout: oc
    .meta(
      openapi({
        path: "/snapshot-checkout",
        description: "Snapshots checkout path into a repo",
      }),
    )
    .input(
      z.object({
        auth: Auth,
        encKey: z.string(),
        repoId: z.string(),
        checkoutPath: z.string(),
      }),
    )
    .output(z.object({})),

  snapshotCheckoutStatus: oc
    .meta(openapi({ path: "/snapshot-checkout-status" }))
    .input(
      z.object({
        auth: Auth,
        encKey: z.string(),
        repoId: z.string(),
        checkoutPath: z.string(),
      }),
    )
    .output(
      z.object({
        changes: z.array(
          z.object({
            path: z.array(z.string()),
            status: z.enum(["Added", "Deleted", "Changed"]),
          }),
        ),
      }),
    ),

  ls: oc
    .meta(openapi({ path: "/ls" }))
    .input(
      z.object({
        remote: Remote.optional(),
        path: z.string(),
      }),
    )
    .output(
      z.object({
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
    ),

  syncDir: oc
    .meta(openapi({ path: "/sync-dir" }))
    .input(
      z.object({
        syncId: z.string(),
        from: z.object({ remote: Remote.optional(), path: z.string() }),
        to: z.object({ remote: Remote.optional(), path: z.string() }),
      }),
    )
    .output(z.void()),

  syncStatus: oc
    .meta(openapi({ path: "/sync-status" }))
    .input(
      z.object({
        syncId: z.string(),
      }),
    )
    .output(
      z.object({
        status: z
          .object({
            finished: z.boolean(),
          })
          .optional(),
      }),
    ),

  diff: oc
    .meta(openapi({ path: "/diff" }))
    .input(
      z.object({
        left: z.object({ remote: Remote.optional(), path: z.string() }),
        right: z.object({ remote: Remote.optional(), path: z.string() }),
      }),
    )
    .output(
      z.object({
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
    ),

  resticBackup: oc
    .meta(openapi({ path: "/resticBackup" }))
    .input(
      z.object({
        remote: Remote,
        resticTargetRepoPath: z.string(),
        paths: z.array(z.string()),
      }),
    )
    .output(z.void()),
};
