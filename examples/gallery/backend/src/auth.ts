//TODO make this a cli parameter
export const isAdmin = true;

export const hasRepoReadAccess = (repoId?: string): boolean => {
  if (repoId === undefined) {
    return isAdmin;
  }
  return true;
};

export const hasRepoWriteAccess = (repoId?: string): boolean => {
  return isAdmin;
};
