import { oc } from "@orpc/contract";
import { openapi } from "@orpc/openapi";
import { Express } from "express";
import { z, ZodType } from "zod";

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

export const Auth = z.object({
  userId: z.string(),
  sessionKey: z.string(),
});

export const contract = {
  me: oc
    .meta(openapi({ method: "GET", path: "/me" }))
    .input(
      z.object({
        auth: Auth.optional(),
      }),
    )
    .output(
      z.object({
        desktopMode: z
          .object({
            /** Working dir path on the server */
            path: z.string(),
          })
          .optional(),
      }),
    ),

  // registration
  startRegistration: oc
    .meta(openapi({ method: "POST", path: "/register" }))
    .input(z.object({ registrationRequest: z.string() }))
    .output(
      z.object({
        userId: z.string(),
        registrationResponse: z.string(),
      }),
    ),
  finishRegistration: oc
    .meta(
      openapi({
        method: "POST",
        path: "/finishRegister",
      }),
    )
    .input(
      z.object({
        userId: z.string(),
        userName: z.string(),
        email: z.string().optional(),
        registrationRecord: z.string(),
      }),
    )
    .output(
      z.object({
        status: z.union([z.literal("Ok"), z.literal("UserExists")]),
      }),
    ),
  startChildRegistration: oc
    .meta(
      openapi({
        method: "POST",
        path: "/register-child",
      }),
    )
    .input(
      z.object({
        auth: Auth,
        registrationRequest: z.string(),
      }),
    )
    .output(
      z
        .object({
          userId: z.string(),
          registrationResponse: z.string(),
        })
        .optional(),
    ),

  // login
  startLogin: oc
    .meta(
      openapi({
        method: "POST",
        path: "/startLogin",
      }),
    )
    .input(z.object({ userName: z.string(), startLoginRequest: z.string() }))
    .output(
      z.discriminatedUnion("status", [
        z.object({
          status: z.literal("Ok"),
          loginResponse: z.string(),
        }),
        z.object({ status: z.literal("NotFound") }),
      ]),
    ),

  finishLogin: oc
    .meta(
      openapi({
        method: "POST",
        path: "/finishLogin",
      }),
    )
    .input(z.object({ userName: z.string(), finishLoginRequest: z.string() }))
    .output(z.object({ userId: z.string() })),
  // logout
  logout: oc
    .meta(
      openapi({
        method: "POST",
        path: "/logout",
      }),
    )
    .input(
      z.object({
        auth: Auth,
      }),
    )
    .output(z.undefined()),
  postBlob: oc
    .meta(
      openapi({
        path: "/blobs",
        requestBodyHint: "form-data",
      }),
    )
    .input(
      z.object({
        repoId: z.string().optional(),
        path: z.array(z.string()),
        auth: Auth,
        blob: z.instanceof(File),
      }),
    )
    .output(
      z.object({
        blob: z.object({
          name: z.string(),
        }),
      }),
    ),
  fileExists: oc
    .meta(
      openapi({
        method: "GET",
        path: "/blobs/exists/",
      }),
    )
    .input(
      z.object({
        repoId: z.string().optional(),
        path: z.array(z.string()),
        auth: Auth,
      }),
    )
    .output(z.boolean()),
  getFile: oc
    .meta(
      openapi({
        summary: "Get an blob",
        path: "/blobs",
      }),
    )
    .input(
      z.object({
        repoId: z.string().optional(),
        path: z.array(z.string()),
        auth: z.object({
          userId: z.string(),
          sessionKey: z.string().optional(),
        }),
      }),
    )
    .output(
      z.object({
        file: z.instanceof(File),
      }),
    ),
  list: oc
    .meta(
      openapi({
        summary: "Get an blob",
        method: "GET",
        path: "/ls",
      }),
    )
    .input(
      z.object({
        repoId: z.string().optional(),
        path: z.array(z.string()),
        auth: Auth,
      }),
    )
    .output(
      z.object({
        content: z.array(
          z.object({
            name: z.string(),
          }),
        ),
      }),
    ),
};
