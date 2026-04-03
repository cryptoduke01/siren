import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyWebsocket from "@fastify/websocket";
import { registerRoutes } from "./routes.js";
import { createWebSocketHandler } from "./ws.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const isProd = process.env.NODE_ENV === "production";
const fastify = Fastify({
  logger: isProd
    ? { level: "info" }
    : { level: "info", transport: { target: "pino-pretty", options: { colorize: true } } },
});

async function main() {
  await fastify.register(fastifyCors, {
    origin: true, // Allow localhost:3000 and any dev origin
    methods: ["GET", "POST", "OPTIONS"],
  });
  await fastify.register(fastifyWebsocket);

  fastify.register(async (instance) => {
    instance.get("/ws", { websocket: true }, createWebSocketHandler());
  });

  registerRoutes(fastify);

  const port = Number(process.env.PORT) || 4000;
  await fastify.listen({ port, host: "0.0.0.0" });
  fastify.log.info({ port }, "Siren API listening");
}

main().catch((err) => {
  fastify.log.error(err);
  process.exit(1);
});
