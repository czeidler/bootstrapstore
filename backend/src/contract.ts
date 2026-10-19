import { oc } from "@orpc/contract";
import { openapi } from "@orpc/openapi";
import { z } from "zod";

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
