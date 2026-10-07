// Call from server wrappers with server environment values; never a client gate.
export function isLocalPreviewEnabled(nodeEnvironment: string | undefined, vercel: string | undefined) {
  return nodeEnvironment === "development" && vercel === undefined;
}
