import { initContract } from "@ts-rest/core";
import { Express } from "express";
import { z, ZodType } from "zod";

export const c = initContract();

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

  // registration
  startRegistration: {
    method: "POST",
    path: "/register",
    body: z.object({ registrationRequest: z.string() }),
    responses: {
      201: z.object({
        userId: z.string(),
        registrationResponse: z.string(),
      }),
    },
  },
  finishRegistration: {
    method: "POST",
    path: "/finishRegister",
    body: z.object({
      userId: z.string(),
      userName: z.string(),
      email: z.string().optional(),
      registrationRecord: z.string(),
    }),
    responses: {
      201: z.object({}),
    },
  },
  // login
  startLogin: {
    method: "POST",
    path: "/startLogin",
    body: z.object({ userName: z.string(), startLoginRequest: z.string() }),
    responses: {
      201: z.object({
        loginResponse: z.string(),
      }),
    },
  },
  finishLogin: {
    method: "POST",
    path: "/finishLogin",
    body: z.object({ userName: z.string(), finishLoginRequest: z.string() }),
    responses: {
      201: z.object({ userId: z.string() }),
    },
  },
  // logout
  logout: {
    method: "POST",
    path: "/logout",
    body: z.object({
      auth: z.object({
        userId: z.string(),
        sessionKey: z.string(),
      }),
    }),
    responses: {
      201: z.void(),
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
