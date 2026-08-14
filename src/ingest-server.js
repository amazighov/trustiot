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

      req.on('end', () => {
        try {
          const reading =
            JSON.parse(body);

          console.log(
            'ESP32 READING RECEIVED'
          );

          console.log(
            JSON.stringify(
              reading,
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
              accepted: true
            })
          );
        } catch {
          res.writeHead(400);

          res.end(
            JSON.stringify({
              accepted: false,
              error: 'invalid JSON'
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
