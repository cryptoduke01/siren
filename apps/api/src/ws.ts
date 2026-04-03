import type { FastifyRequest } from "fastify";
import { getMarketsWithVelocity } from "./services/markets.js";

interface SocketLike {
  readyState: number;
  send(data: string): void;
  on(event: string, fn: () => void): void;
}

const clients = new Set<SocketLike>();

export function createWebSocketHandler() {
  return (socket: SocketLike, _req: FastifyRequest) => {
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
