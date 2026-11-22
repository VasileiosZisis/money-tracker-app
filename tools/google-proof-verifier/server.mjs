import { createServer } from "node:http";
import { OAuth2Client } from "google-auth-library";

import { readConfig } from "./config.mjs";
import { createProofHandler, sendJson } from "./verifier.mjs";

function start(config) {
  const google = new OAuth2Client({
    transporterOptions: { timeout: 5_000, retryConfig: { retry: 0 } },
  });
  const handle = createProofHandler({
    ...config,
    verifyIdToken: async (idToken, audience) => {
      const ticket = await google.verifyIdToken({ idToken, audience });
      return ticket.getPayload();
    },
  });

  const server = createServer({
    maxHeaderSize: 8 * 1024,
    headersTimeout: 5_000,
    requestTimeout: 10_000,
    connectionsCheckingInterval: 1_000,
  }, (request, response) => {
    handle(request, response).catch(() => {
      if (response.destroyed) return;
      if (response.headersSent) response.destroy();
      else sendJson(response, 500, { error: "request_failed" });
    });
  });

  server.maxConnections = 32;
  server.on("clientError", (_error, socket) => {
    if (socket.writable) {
      socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\nCache-Control: no-store\r\nContent-Length: 0\r\n\r\n");
    } else {
      socket.destroy();
    }
  });
  server.on("error", () => {
    process.stderr.write("Could not start the Google proof verifier on loopback.\n");
    process.exitCode = 1;
  });
  server.listen(config.port, "127.0.0.1");
}

let config;
try {
  config = readConfig(process.env);
} catch (error) {
  process.stderr.write(error.message + "\n");
  process.exitCode = 1;
}
if (config) start(config);
