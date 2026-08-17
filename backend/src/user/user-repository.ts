import { Connection } from "./db";

type UserPermissions = {
  account: "write";
};

type Account = {
  permissions: UserPermissions[];
};

type User = {
  id: string;
  userName: string;
  registrationRecord?: string;
  accounts: Account[];
};

export class UserRepository {
  constructor(private readonly db: Connection) {}

  async addUser(user: {
    id: string;
    userName: string;
    email?: string;
    registrationRecord: string;
  }) {
    await this.db.transaction().execute(async (tx) => {
      const newUser = await tx
        .insertInto("user")
        .values({
          id: user.id,
          user_name: user.userName,
          registration_record: user.registrationRecord,
        })
        .returning(["id"])
        .executeTakeFirstOrThrow();

      const newAccount = await tx
        .insertInto("account")
        .values({
          owner_id: newUser.id,
        })
        .returning(["id"])
        .executeTakeFirstOrThrow();

      await tx.insertInto("permission").values({
        account_id: newAccount.id,
        user_id: newUser.id,
        permission: JSON.stringify({
          account: "write",
        } satisfies UserPermissions),
      });
    });
  }

  async getByUseName({
    userName,
  }: {
    userName: string;
  }): Promise<User | undefined> {
    const user = await this.db
      .selectFrom("user")
      .selectAll()
      .where("user_name", "=", userName)
      .executeTakeFirst();
    if (user === undefined) {
      return undefined;
    }

    const permissions = await this.db
      .selectFrom("permission")
      .selectAll()
      .where("user_id", "=", user.id)
      .execute();
    const accounts = permissions.reduce<Map<number, UserPermissions[]>>(
      (prev, cur) => {
        const existing = prev.get(cur.account_id) ?? [];
        existing.push(JSON.parse(cur.permission) as UserPermissions);
        prev.set(cur.account_id, existing);
        return prev;
      },
      new Map(),
    );
    return {
      id: user.id,
      userName: user.user_name,
      registrationRecord: user.registration_record ?? undefined,
      accounts: Array.from(accounts.values()).map((it) => ({
        permissions: it,
      })),
    };
  }
}
