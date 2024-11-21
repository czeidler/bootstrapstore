export type VaultDetail = {
  id: string;
  passphrase: string;
};

export type UserData = {
  vaults: Record<string, VaultDetail>;
};
