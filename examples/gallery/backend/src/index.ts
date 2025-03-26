import { buildApp } from "./controller";

const port = 8080;

//TODO make this a cli parameter
const isAdmin = true;
const isLocal = true;

const app = buildApp({ isAdmin, isLocal });
app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});
