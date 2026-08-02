import { MetadataRepository } from "lib";
import { Account } from "lib/src/account";
import { proxy } from "valtio";

type AuthenticatedUser = {
  auth: { userId: string; sessionKey: string };
  account: Account;
  metadataRepo: MetadataRepository;
};

export const authUserStore = proxy<{ user?: AuthenticatedUser }>();
