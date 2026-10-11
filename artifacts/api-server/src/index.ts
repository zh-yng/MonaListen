import app from "./app";
import { logger } from "./lib/logger";
import { migrate } from "./lib/mona-db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

migrate().then(() => app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
})).catch((error) => {
  logger.error({code:error?.code,name:error?.name},"Could not initialize MonaListen's Tiger database");
  process.exit(1);
});
