import { checkServerIdentity, type PeerCertificate } from "node:tls";

import type { FixtureTarget } from "./target";

export function fixtureConnectionOptions(target: FixtureTarget) {
  return {
    host: target.host, port: target.port, user: target.user, password: target.password, database: target.database,
    options: "-c search_path=public",
    ssl: {
      ca: target.ca,
      rejectUnauthorized: true,
      checkServerIdentity: (_driverName: string, cert: PeerCertificate) => checkServerIdentity(target.host, cert),
    },
  };
}
