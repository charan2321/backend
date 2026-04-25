import { app } from "./app.js";
import { connectDb } from "./config/db.js";
import { env } from "./config/env.js";

const bootstrap = async (): Promise<void> => {
  await connectDb();
  app.listen(env.PORT, () => {
    const serverUrl = `http://localhost:${env.PORT}`;
    console.log(`✅ LinguaStar backend running on ${serverUrl}`);
    console.log(`📍 Open in browser: ${serverUrl}`);
  });
};

bootstrap().catch((error) => {
  console.error("Failed to bootstrap server", error);
  process.exit(1);
});
