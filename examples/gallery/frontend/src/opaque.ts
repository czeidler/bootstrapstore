import * as opaque from "@serenity-kit/opaque";
import { tsr } from "./tsr";

export async function register(
  userName: string,
  password: string,
  email?: string,
): Promise<{ exportKey: string }> {
  const { clientRegistrationState, registrationRequest } =
    opaque.client.startRegistration({ password });
  const result = await tsr.startRegistration({ body: { registrationRequest } });
  if (result.status !== 201) {
    throw Error(`Failed to start registration: ${result.status}`);
  }
  const { registrationRecord, exportKey } = opaque.client.finishRegistration({
    password,
    registrationResponse: result.body.registrationResponse,
    clientRegistrationState,
  });
  const finishResult = await tsr.finishRegistration({
    body: {
      userId: result.body.userId,
      userName,
      email,
      registrationRecord,
    },
  });
  if (finishResult.status !== 201) {
    throw Error(`Failed to finish registration: ${finishResult.status}`);
  }
  return { exportKey };
}

export async function login(
  userName: string,
  password: string,
): Promise<{ exportKey: string }> {
  const { clientLoginState, startLoginRequest } = opaque.client.startLogin({
    password,
  });
  const result = await tsr.startLogin({
    body: { userName, startLoginRequest },
  });
  if (result.status !== 201) {
    throw Error(`Failed to start registration: ${result.status}`);
  }
  const finishLoginData = opaque.client.finishLogin({
    clientLoginState,
    loginResponse: result.body.loginResponse,
    password,
  });
  if (finishLoginData === undefined) {
    throw Error(`Failed to finish login protocol`);
  }
  const finishResult = await tsr.finishLogin({
    body: { userName, finishLoginRequest: finishLoginData.finishLoginRequest },
  });
  if (finishResult.status !== 201) {
    throw Error(`Failed to finish login: ${result.status}`);
  }

  return { exportKey: finishLoginData.exportKey };
}
