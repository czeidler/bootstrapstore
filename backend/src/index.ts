import { Connection, DB, connectToDB, migrate } from "./db";
import express from "express";
import * as trpcExpress from "@trpc/server/adapters/express";
import { appRouter } from "./controller";
import cors from "cors";
import dotenv from "dotenv";
import cookieSession from "cookie-session";
import crypto from "crypto";

export type CreateContext = ({
  req,
  res,
}: trpcExpress.CreateExpressContextOptions) => Pick<
  trpcExpress.CreateExpressContextOptions,
  "req" | "res"
> & {
  connection: Connection;
};

async function main() {
  dotenv.config();

  const db = await connectToDB<DB>("database");
  await migrate(db);

  const createContext: CreateContext = ({ req, res }) => ({
    req,
    res,
    connection: db,
  });

  const app = express();
  app.use(
    cookieSession({
      name: "session",
      keys: [crypto.randomUUID()],
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    })
  );
  app.use(
    cors({
      methods: ["POST", "GET", "OPTIONS"],
      /*origin: function (_origin, callback) {
        // allow all origins
        callback(null, true);
      },*/
    })
  );
  app.use(
    "/trpc",
    trpcExpress.createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  const port = 8080;
  app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
  });

  const shutDown = async () => {
    await db.destroy();
    process.exit(1);
  };
  process.on("SIGTERM", shutDown);
  process.on("SIGINT", shutDown);
}

main().catch((e) => console.error(e));
