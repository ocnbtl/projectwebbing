const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const root = path.resolve(process.argv[2] || process.cwd());
const port = Number(process.argv[3] || 4174);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

function resolveRequest(requestUrl) {
  const url = new URL(requestUrl, `http://127.0.0.1:${port}`);
  const pathname = decodeURIComponent(url.pathname);
  const requested = path.resolve(root, `.${pathname}`);
  const isInsideRoot = requested === root || requested.startsWith(`${root}${path.sep}`);

  if (!isInsideRoot) {
    return null;
  }

  return requested;
}

const server = http.createServer((request, response) => {
  let target = resolveRequest(request.url || "/");

  if (!target) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }

  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
    target = path.join(target, "index.html");
  }

  fs.stat(target, (statError, stats) => {
    if (statError || !stats.isFile()) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": mimeTypes[path.extname(target).toLowerCase()] || "application/octet-stream",
    });

    const stream = fs.createReadStream(target);
    stream.on("error", () => {
      if (!response.headersSent) {
        response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      }
      response.end("Unable to read file");
    });
    stream.pipe(response);
  });
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`Serving ${root} at http://127.0.0.1:${port}\n`);
});
