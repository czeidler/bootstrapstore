import short from "short-uuid";
import * as opaque from "@serenity-kit/opaque";
import { Connection } from "./db";
import { FileRepository, UserRepository } from "./repository";

class OngoingRegistrations {
  private ongoing: Record<string, { registrationTime: number }> = {};

  startRegistration(userId: string) {
    this.ongoing[userId] = { registrationTime: Date.now() };
  }

  finishOngoingRegistration(userId: string): boolean {
    this.clean();
    const ongoing = this.ongoing[userId] !== undefined;
    delete this.ongoing[userId];
    return ongoing;
  }

  private clean() {
    const maxAge = 1000 * 60;
    const now = Date.now();
    for (const key of Object.keys(this.ongoing)) {
      if (this.ongoing[key].registrationTime + maxAge < now) {
        delete this.ongoing[key];
      }
    }
  }
}

class UserSessions {
  private sessions: Record<
    string,
    {
      serverLoginState: string | undefined;
      sessionKey?: string | undefined;
      loginTime: number;
    }
  > = {};

  startLogin(userId: string, serverLoginState: string) {
    this.sessions[userId] = { serverLoginState, loginTime: Date.now() };
  }

  getServerLoginState(userId: string): string | undefined {
    this.clean(60 * 1000);
    return this.sessions[userId]?.serverLoginState;
  }

  finishLogin(userId: string, sessionKey: string): boolean {
    const session = this.sessions[userId];
    if (session === undefined) return false;

    session.serverLoginState = undefined;
    session.sessionKey = sessionKey;
    return true;
  }

  logout(userId: string) {
    delete this.sessions[userId];
  }

  getSessionKey(userId: string): string | undefined {
    return this.sessions[userId]?.sessionKey;
  }

  private clean(age?: number) {
    const maxAge = age ?? 1000 * 60 * 60;
    const now = Date.now();
    for (const key of Object.keys(this.sessions)) {
      if (this.sessions[key].loginTime + maxAge < now) {
        delete this.sessions[key];
      }
    }
  }
}
const userContext = {
  ongoingRegistrations: new OngoingRegistrations(),
  userSessions: new UserSessions(),
};

export type StartRegistrationResponse = {
  userId: string;
  registrationResponse: string;
};

export function startRegistration(
  registrationRequest: string
): StartRegistrationResponse {
  const userIdentifier = short.uuid();
  userContext.ongoingRegistrations.startRegistration(userIdentifier);
  const response = opaque.server.createRegistrationResponse({
    serverSetup: process.env.OPAQUE_SERVER_SETUP ?? "",
    userIdentifier,
    registrationRequest,
  });
  return {
    userId: userIdentifier,
    registrationResponse: response.registrationResponse,
  };
}

export async function finishRegistration(
  input: {
    userId: string;
    email: string;
    registrationRecord: string;
  },
  con: Connection
): Promise<void> {
  if (
    !userContext.ongoingRegistrations.finishOngoingRegistration(input.userId)
  ) {
    throw Error(`No ongoing registration for userId ${input.userId}`);
  }
  const userRepo = new UserRepository(con);
  const existingUser = await userRepo.getByEmail(input.email);
  if (existingUser !== undefined) {
    throw Error("User already exists");
  }
  await userRepo.addUser({
    id: input.userId,
    email: input.email,
    registration_record: input.registrationRecord,
  });
}

export type StartLoginResponse = {
  loginResponse: string;
};

export async function startLogin(
  {
    email,
    startLoginRequest,
  }: {
    email: string;
    startLoginRequest: string;
  },
  con: Connection
): Promise<StartLoginResponse> {
  const userRepo = new UserRepository(con);
  const existingUser = await userRepo.getByEmail(email);
  if (existingUser === undefined) {
    throw Error("User does not exist");
  }
  const { loginResponse, serverLoginState } = opaque.server.startLogin({
    userIdentifier: existingUser.id,
    registrationRecord: existingUser.registration_record,
    serverSetup: process.env.OPAQUE_SERVER_SETUP ?? "",
    startLoginRequest,
  });
  userContext.userSessions.startLogin(existingUser.id, serverLoginState);
  return { loginResponse };
}

export type FinishLoginResponse = {
  userId: string;
};

export async function finishLogin(
  {
    email,
    finishLoginRequest,
  }: {
    email: string;
    finishLoginRequest: string;
  },
  con: Connection
): Promise<FinishLoginResponse> {
  const userRepo = new UserRepository(con);
  const existingUser = await userRepo.getByEmail(email);
  if (existingUser === undefined) {
    throw Error("User does not exist");
  }
  const serverLoginState = userContext.userSessions.getServerLoginState(
    existingUser.id
  );
  if (!serverLoginState) {
    throw Error("Invalid login state");
  }
  const { sessionKey } = opaque.server.finishLogin({
    finishLoginRequest,
    serverLoginState,
  });

  userContext.userSessions.finishLogin(existingUser.id, sessionKey);
  return { userId: existingUser.id };
}

type AuthData = {
  userId: string;
  sessionKey: string;
};

function validateAuth({ userId, sessionKey }: AuthData) {
  if (userContext.userSessions.getSessionKey(userId) !== sessionKey) {
    throw Error("Not authorized");
  }
}

export function logout(auth: AuthData): string | undefined {
  validateAuth(auth);

  userContext.userSessions.logout(auth.userId);
  return undefined;
}

export type ListFilesResponse = {
  files: string[];
};

export async function listFiles(
  auth: AuthData,
  con: Connection
): Promise<ListFilesResponse> {
  validateAuth(auth);

  return new FileRepository(con).listFiles(auth.userId);
}

export async function getFile(
  auth: AuthData,
  name: string,
  con: Connection
): Promise<string | undefined> {
  validateAuth(auth);

  return new FileRepository(con).getFile(auth.userId, name);
}

export async function mutateFiles(
  auth: AuthData,
  updates: Record<string, string>,
  deletes: string[],
  con: Connection
) {
  validateAuth(auth);

  await con.transaction().execute(async (con) => {
    const repo = new FileRepository(con);
    // delete first in case we add the same file again
    for (const d of deletes) {
      await repo.deleteFile(auth.userId, d);
    }

    for (const [key, data] of Object.entries(updates)) {
      await repo.putFile(auth.userId, key, data);
    }
  });
}
