import {
  validateDeviceReading
} from './core/deviceValidation.js';
import http from 'node:http';

const PORT = 8080;

const server = http.createServer(
  (req, res) => {
    if (
      req.method === 'POST' &&
      req.url === '/api/readings'
    ) {
      let body = '';

      req.on('data', (chunk) => {
        body += chunk;
      });

      req.on('end', async () => {
  try {
    const reading =
      JSON.parse(body);

    const validation =
      await validateDeviceReading(
        reading
      );

    console.log(
      'ESP32 READING VERIFIED'
    );

    console.log(
      JSON.stringify(
        {
          deviceId:
            validation.deviceId,
          sequence:
            validation.sequence,
          timestamp:
            validation.timestamp
        },
        null,
        2
      )
    );

    res.writeHead(
      200,
      {
        'Content-Type':
          'application/json'
      }
    );

    res.end(
      JSON.stringify({
        accepted: true,
        verified: true,
        deviceId:
          validation.deviceId,
        sequence:
          validation.sequence
      })
    );
  } catch (error) {
    console.error(
      'ESP32 READING REJECTED:',
      error.message
    );

    res.writeHead(
      401,
      {
        'Content-Type':
          'application/json'
      }
    );

    res.end(
      JSON.stringify({
        accepted: false,
        verified: false,
        error:
          error.message
      })
    );
  }
});

      return;
    }

    res.writeHead(404);
    res.end('Not Found');
  }
);

server.listen(
  PORT,
  '0.0.0.0',
  () => {
    console.log(
      `TrustIoT ingestion server listening on port ${PORT}`
    );
  }
);
