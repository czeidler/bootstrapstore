import { initTRPC } from "@trpc/server";
import { z } from "zod";
import {
  FinishLoginResponse,
  ListFilesResponse,
  StartLoginResponse,
  StartRegistrationResponse,
  finishLogin,
  finishRegistration,
  getFile,
  listFiles,
  logout,
  mutateFiles,
  startLogin,
  startRegistration,
} from "./service";
import { CreateContext } from ".";

const t = initTRPC.context<CreateContext>().create();

const Auth = z.object({
  userId: z.string(),
  sessionKey: z.string(),
});

export const appRouter = t.router({
  // registration
  startRegistration: t.procedure
    .input(z.object({ registrationRequest: z.string() }))
    .mutation((opts): StartRegistrationResponse => {
      return startRegistration(opts.input.registrationRequest);
    }),
  finishRegistration: t.procedure
    .input(
      z.object({
        userId: z.string(),
        email: z.string(),
        registrationRecord: z.string(),
      })
    )
    .mutation((opts): Promise<void> => {
      return finishRegistration(opts.input, opts.ctx.connection);
    }),

  // login
  startLogin: t.procedure
    .input(z.object({ email: z.string(), startLoginRequest: z.string() }))
    .mutation((opts): Promise<StartLoginResponse> => {
      return startLogin(opts.input, opts.ctx.connection);
    }),
  finishLogin: t.procedure
    .input(z.object({ email: z.string(), finishLoginRequest: z.string() }))
    .mutation(async (opts): Promise<FinishLoginResponse> => {
      return await finishLogin(opts.input, opts.ctx.connection);
    }),

  // logout
  logout: t.procedure
    .input(z.object({ auth: Auth }))
    .mutation(async (opts): Promise<void> => {
      logout(opts.input.auth);
    }),

  // files
  listFiles: t.procedure
    .input(z.object({ auth: Auth }))
    .query(async (opts): Promise<ListFilesResponse> => {
      return listFiles(opts.input.auth, opts.ctx.connection);
    }),
  getFile: t.procedure
    .input(z.object({ auth: Auth, name: z.string() }))
    .query(async (opts): Promise<string | undefined> => {
      return getFile(opts.input.auth, opts.input.name, opts.ctx.connection);
    }),
  mutateFiles: t.procedure
    .input(
      z.object({
        auth: Auth,
        updates: z.record(z.string(), z.string()),
        deletes: z.array(z.string()),
      })
    )
    .mutation(async (opts): Promise<void> => {
      await mutateFiles(
        opts.input.auth,
        opts.input.updates,
        opts.input.deletes,
        opts.ctx.connection
      );
    }),
});
// export type definition of API
export type AppRouter = typeof appRouter;
