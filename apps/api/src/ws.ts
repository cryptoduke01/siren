import type { FastifyRequest } from "fastify";
import type { WebSocket } from "ws";
import { getMarketsWithVelocity } from "./services/markets.js";

const clients = new Set<WebSocket>();

export function createWebSocketHandler() {
  return (socket: WebSocket, _req: FastifyRequest) => {
    clients.add(socket);
    socket.on("close", () => clients.delete(socket));

    const send = () => {
      if (socket.readyState === 1) {
        getMarketsWithVelocity()
          .then((data) => socket.send(JSON.stringify({ type: "markets", data })))
          .catch(() => {});
      }
    };

    send();
    const interval = setInterval(send, 60_000);
    socket.on("close", () => clearInterval(interval));
  };
}

export function broadcastMarkets(data: unknown) {
  const payload = JSON.stringify({ type: "markets", data });
  clients.forEach((client) => {
    if (client.readyState === 1) client.send(payload);
  });
}
