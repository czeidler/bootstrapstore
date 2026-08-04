import { validateAuth } from "./user/auth-service";

export const authValidation = () => {
  const hasRepoReadAccess = (
    repoId: string | undefined,
    auth: { userId: string; sessionKey: string } | undefined,
  ): boolean => {
    if (repoId === undefined) {
      if (auth) {
        return validateAuth(auth);
      }
      return false;
    }
    return true;
  };

  const hasRepoWriteAccess = (
    _repoId: string | undefined,
    auth: { userId: string; sessionKey: string } | undefined,
  ): boolean => {
    if (auth) {
      return validateAuth(auth);
    }
    return false;
  };
  return { hasRepoReadAccess, hasRepoWriteAccess };
};
