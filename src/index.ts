import "dotenv/config";
import { createApp } from "./app";

const app = createApp();
const port = Number(process.env.PORT ?? 5000);

app.listen(port, () => {
  console.log(`bsuc-server listening on http://localhost:${port}`);
});
