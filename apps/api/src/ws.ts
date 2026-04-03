import type { FastifyRequest } from "fastify";
import { getMarketsWithVelocity } from "./services/markets.js";
import { getSignalFeedSnapshot } from "./services/signalState.js";

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
        getSignalFeedSnapshot()
          .then((snapshot) => {
            socket.send(JSON.stringify({ type: "signals", data: snapshot.signals }));
            socket.send(JSON.stringify({ type: "signal-status", data: snapshot.status }));
          })
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

export function broadcastSignalSnapshot(snapshot: Awaited<ReturnType<typeof getSignalFeedSnapshot>>) {
  const signalsPayload = JSON.stringify({ type: "signals", data: snapshot.signals });
  const statusPayload = JSON.stringify({ type: "signal-status", data: snapshot.status });

  clients.forEach((client) => {
    if (client.readyState !== 1) return;
    client.send(signalsPayload);
    client.send(statusPayload);
  });
}
