import { Connection, NewUser, User, UserTable } from "./db";

export type Manifest = {
  /** Encryption key used to encrypt the file data */
  encryptionKey: string;
  /** File path to file information */
  files: Record<
    string,
    {
      hash: string;
    }
  >;
};

export class UserRepository {
  constructor(private readonly db: Connection) {}

  async addUser(user: NewUser) {
    await this.db.insertInto("user").values(user).execute();
  }

  async getByEmail(email: string): Promise<User | undefined> {
    const user = await this.db
      .selectFrom("user")
      .selectAll()
      .where("email", "=", email)
      .execute();
    return user[0];
  }
}

export class FileRepository {
  constructor(private readonly db: Connection) {}

  async listFiles(userId: string): Promise<{ files: string[] }> {
    const result = await this.db
      .selectFrom("file")
      .select("name")
      .where("user_id", "=", userId)
      .execute();
    return {
      files: result.map((it) => it.name),
    };
  }

  async putFile(userId: string, name: string, data: string) {
    await this.db
      .insertInto("file")
      .values({ user_id: userId, name, data })
      .onConflict((oc) => oc.columns(["user_id", "name"]).doUpdateSet({ data }))
      .execute();
  }

  async deleteFile(userId: string, name: string) {
    await this.db
      .deleteFrom("file")
      .where("user_id", "=", userId)
      .where("name", "=", name)
      .execute();
  }
}
