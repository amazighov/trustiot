export function logEvent(event, data = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    ...data
  };

  console.log(
    JSON.stringify(entry)
  );
}
