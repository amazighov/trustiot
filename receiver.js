import http from 'http';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const artifactsDir = path.resolve('./artifacts');

if (!fs.existsSync(artifactsDir)) {
  fs.mkdirSync(artifactsDir, { recursive: true });
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/sensor') {
    let body = '';

    req.on('data', chunk => {
      body += chunk;
    });

    req.on('end', () => {
      try {
        const reading = JSON.parse(body);

        const requiredFields = [
          'deviceId',
          'sensor',
          'temperature',
          'humidity',
          'pressure',
          'timestamp'
        ];

        for (const field of requiredFields) {
          if (!(field in reading)) {
            throw new Error(`Missing field: ${field}`);
          }
        }

        const canonicalPayload = JSON.stringify({
          deviceId: reading.deviceId,
          sensor: reading.sensor,
          temperature: reading.temperature,
          humidity: reading.humidity,
          pressure: reading.pressure,
          timestamp: reading.timestamp
        });

        const sha256 = crypto
          .createHash('sha256')
          .update(canonicalPayload)
          .digest('hex');

        const artifact = {
          schema: 'trustiot.sensor.v1',
          receivedAt: new Date().toISOString(),
          payload: JSON.parse(canonicalPayload),
          sha256
        };

        const filename =
          `${reading.deviceId}-${reading.timestamp}-${sha256.slice(0, 12)}.json`;

        const filepath = path.join(artifactsDir, filename);

        fs.writeFileSync(
          filepath,
          JSON.stringify(artifact, null, 2)
        );

        console.log('\n=== TrustIoT reading ===');
        console.log('Device:', reading.deviceId);
        console.log('Sensor:', reading.sensor);
        console.log('SHA-256:', sha256);
        console.log('Artifact:', filepath);

        res.writeHead(200, {
          'Content-Type': 'application/json'
        });

        res.end(JSON.stringify({
          ok: true,
          sha256,
          artifact: filename
        }));
      } catch (error) {
        console.error('Invalid payload:', error.message);

        res.writeHead(400, {
          'Content-Type': 'application/json'
        });

        res.end(JSON.stringify({
          ok: false,
          error: error.message
        }));
      }
    });

    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(3000, '0.0.0.0', () => {
  console.log('TrustIoT receiver listening on port 3000');
});