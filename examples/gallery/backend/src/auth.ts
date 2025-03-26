export const authValidation = (isAdmin: boolean) => {
  const hasRepoReadAccess = (repoId?: string): boolean => {
    if (repoId === undefined) {
      return isAdmin;
    }
    return true;
  };

  const hasRepoWriteAccess = (repoId?: string): boolean => {
    return isAdmin;
  };
  return { hasRepoReadAccess, hasRepoWriteAccess };
};
