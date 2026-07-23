import { Connection, NewUser, User } from "./db";

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
      .executeTakeFirst();
    return user;
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
    return user;
  }
}
