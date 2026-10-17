import * as opaque from "@serenity-kit/opaque";
import { tsr } from "./tsr";

export async function register(
  userName: string,
  password: string,
  email?: string,
): Promise<{ userId: string; exportKey: string } | "UserExists"> {
  const { clientRegistrationState, registrationRequest } =
    opaque.client.startRegistration({ password });
  const result = await tsr.startRegistration({ registrationRequest });

  const { registrationRecord, exportKey } = opaque.client.finishRegistration({
    password,
    registrationResponse: result.registrationResponse,
    clientRegistrationState,
  });
  const finishResult = await tsr.finishRegistration({
    userId: result.userId,
    userName,
    email,
    registrationRecord,
  });

  if (finishResult.status === "UserExists") {
    return "UserExists";
  }
  return { userId: result.userId, exportKey };
}

export async function login(
  userName: string,
  password: string,
): Promise<
  | { exportKey: string; auth: { userId: string; sessionKey: string } }
  | "NotFound"
> {
  const { clientLoginState, startLoginRequest } = opaque.client.startLogin({
    password,
  });
  const result = await tsr.startLogin({
    userName,
    startLoginRequest,
  });
  if (result.status === "NotFound") {
    return "NotFound";
  }
  const finishLoginData = opaque.client.finishLogin({
    clientLoginState,
    loginResponse: result.loginResponse,
    password,
  });
  if (finishLoginData === undefined) {
    throw Error(`Failed to finish login protocol`);
  }
  const finishResult = await tsr.finishLogin({
    userName,
    finishLoginRequest: finishLoginData.finishLoginRequest,
  });

  return {
    exportKey: finishLoginData.exportKey,
    auth: {
      userId: finishResult.userId,
      sessionKey: finishLoginData.sessionKey,
    },
  };
}
