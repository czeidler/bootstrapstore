import { app } from "./controller";

const port = 8080;

app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});
