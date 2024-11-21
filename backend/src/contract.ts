import { initContract } from "@ts-rest/core";
import { z } from "zod";
import {
  FinishLoginResponse,
  ListFilesResponse,
  StartLoginResponse,
  StartRegistrationResponse,
} from "./service";

const Auth = z.object({
  userId: z.string(),
  sessionKey: z.string(),
});

const c = initContract();
export const contract = c.router({
  // registration
  startRegistration: {
    method: "POST",
    path: "/registrations/start",
    body: z.object({ registrationRequest: z.string() }),
    responses: {
      201: c.type<StartRegistrationResponse>(),
    },
  },
  finishRegistration: {
    method: "POST",
    path: "/registrations/finish",
    body: z.object({
      userId: z.string(),
      email: z.string(),
      registrationRecord: z.string(),
    }),
    responses: {
      201: z.void(),
    },
  },
  // login
  startLogin: {
    method: "POST",
    path: "/logins/start",
    body: z.object({ email: z.string(), startLoginRequest: z.string() }),
    responses: {
      201: c.type<StartLoginResponse>(),
    },
  },
  finishLogin: {
    method: "POST",
    path: "/logins/finish",
    body: z.object({ email: z.string(), finishLoginRequest: z.string() }),
    responses: {
      201: c.type<FinishLoginResponse>(),
    },
  },
  // logout
  logout: {
    method: "POST",
    path: "/logouts",
    body: z.object({ auth: Auth }),
    responses: {
      201: z.void(),
    },
  },
  // files
  listFiles: {
    method: "GET",
    path: "/files/lists",
    query: z.object({ auth: Auth }),
    responses: {
      201: c.type<ListFilesResponse>(),
    },
  },
  getFile: {
    method: "GET",
    path: "/files",
    headers: z.object({
      "Content-Type": z.string().optional(),
      "Content-disposition": z.string().optional(),
    }),
    query: z.object({ auth: Auth, name: z.string() }),
    responses: {
      201: z.unknown(),
    },
  },
});
