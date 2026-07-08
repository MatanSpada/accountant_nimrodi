function log(
  level: "info" | "error",
  event: string,
  metadata: Record<string, unknown>
) {
  console[level](
    JSON.stringify({
      level,
      event,
      metadata,
      timestamp: new Date().toISOString()
    })
  );
}

export const logger = {
  info(event: string, metadata: Record<string, unknown>) {
    log("info", event, metadata);
  },
  error(event: string, metadata: Record<string, unknown>) {
    log("error", event, metadata);
  }
};
