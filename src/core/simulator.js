export function generateReadings({
  deviceId = 'farm-001/temp-01',
  count = 25,
  start = Date.now(),
  intervalMs = 1_000
} = {}) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const wave = Math.sin(i / 4) * 1.5;
    const noise = ((i * 17) % 11) / 20 - 0.25;
    out.push({
      deviceId,
      timestamp: new Date(start + i * intervalMs).toISOString(),
      type: 'temperature',
      value: Number((27.5 + wave + noise).toFixed(2)),
      unit: 'C',
      sequence: i + 1
    });
  }
  return out;
}
