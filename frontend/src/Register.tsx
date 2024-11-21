import * as opaque from "@serenity-kit/opaque";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { TRPCProxyClient, trpc } from "./trpc";
import { SessionUser, useSessionStore } from "./session-store";
import { useMutation } from "@tanstack/react-query";

async function register(
  client: TRPCProxyClient,
  email: string,
  password: string
) {
  const { clientRegistrationState, registrationRequest } =
    opaque.client.startRegistration({ password });
  const { userId, registrationResponse } =
    await client.startRegistration.mutate({
      registrationRequest,
    });
  const { registrationRecord } = opaque.client.finishRegistration({
    clientRegistrationState,
    registrationResponse,
    password,
  });
  const registrationError = await client.finishRegistration.mutate({
    userId,
    email: email ?? "",
    registrationRecord,
  });

  if (registrationError !== undefined) {
    console.error(registrationError);
  }
}

function useRegister(email: string, password: string) {
  const utils = trpc.useUtils();
  return useMutation({
    mutationFn: () => {
      return register(utils.client, email, password);
    },
  });
}

async function login(
  client: TRPCProxyClient,
  email: string,
  password: string
): Promise<SessionUser> {
  const { clientLoginState, startLoginRequest } = opaque.client.startLogin({
    password,
  });

  const response1 = await client.startLogin.mutate({
    email,
    startLoginRequest,
  });
  const loginResult = opaque.client.finishLogin({
    clientLoginState,
    loginResponse: response1.loginResponse,
    password,
  });
  if (!loginResult) {
    throw new Error("Login failed");
  }
  const { exportKey, finishLoginRequest, sessionKey } = loginResult;
  const { userId } = await client.finishLogin.mutate({
    email,
    finishLoginRequest,
  });
  return { userId, email, sessionKey, exportKey };
}

function useLogin(email: string, password: string) {
  const utils = trpc.useUtils();
  return useMutation({
    mutationFn: () => {
      return login(utils.client, email, password);
    },
  });
}

export function Register() {
  const password = "sup-krah.42-UOI"; // user password
  const [email, setEmail] = useState<string | null>();
  const navigate = useNavigate();
  const { setUser } = useSessionStore();

  const { mutateAsync: register } = useRegister(email ?? "", password);
  const { mutateAsync: login } = useLogin(email ?? "", password);

  //console.log(await trpc.getUser.query("test"));
  return (
    <>
      <div className="card">
        <div>
          Email:
          <input
            value={email ?? ""}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <button
          onClick={async () => {
            await register();
          }}
        >
          Register
        </button>

        <button
          onClick={async () => {
            const user = await login();
            setUser(user);
            navigate("/files");
          }}
        >
          Login
        </button>
      </div>
    </>
  );
}
