/** 极简静态服务器：服务 expo export 的 dist-web，支持 /habit/:id 动态路由回退 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "native", "dist-web");
const MIME = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".png": "image/png", ".ico": "image/x-icon", ".json": "application/json", ".map": "application/json", ".svg": "image/svg+xml", ".ttf": "font/ttf", ".woff": "font/woff", ".woff2": "font/woff2" };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/") p = "/index.html";
  let file = path.join(ROOT, p);
  if (!fs.existsSync(file)) {
    if (p.startsWith("/habit/")) file = path.join(ROOT, "habit", "[id].html");
    else if (fs.existsSync(file + ".html")) file = file + ".html";
    else file = path.join(ROOT, "+not-found.html");
  }
  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}).listen(8082, () => console.log("serving dist-web on http://localhost:8082"));
