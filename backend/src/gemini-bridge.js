import tls from "tls";
import fs from "fs";
import fetch from "node-fetch";

const GEMINI_PORT = 1965;
const MCP_URL = "http://localhost:3001/mcp";

const options = {
  key: fs.readFileSync("key.pem"),
  cert: fs.readFileSync("cert.pem")
};

const server = tls.createServer(options, (socket) => {
  socket.setEncoding("utf8");

  socket.on("data", async (data) => {
    const raw = data.toString().trim();
    let path = raw;

    try {
      // Gemini requests may come as full URLs: gemini://host/path
      if (raw.startsWith("gemini://")) {
        const url = new URL(raw);
        path = url.pathname;
      }
    } catch {
      socket.write("40 Bad Request\r\n");
      return socket.end();
    }

    try {
      // Health route
      if (path === "/health") {
        const response = await fetch(MCP_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "tools/call",
            params: { name: "health_check", arguments: {} }
          })
        });

        const result = await response.json();

        socket.write(`20 text/plain\r\n${result.result.status}\r\n`);
        return socket.end();
      }

      // RSS route
      if (path.startsWith("/rss/")) {
        const feedUrl = decodeURIComponent(path.slice(5));

        const response = await fetch(MCP_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "tools/call",
            params: { name: "fetch_rss_feed", arguments: { url: feedUrl } }
          })
        });

        const result = await response.json();

        socket.write(`20 text/plain\r\n${JSON.stringify(result.result, null, 2)}\r\n`);
        return socket.end();
      }

      // Unknown route
      socket.write("51 Not Found\r\n");
      socket.end();

    } catch (err) {
      socket.write(`40 Temporary Failure\r\n${err.message}\r\n`);
      socket.end();
    }
  });
});

server.listen(GEMINI_PORT, () => {
  console.log(`Gemini bridge running on port ${GEMINI_PORT}`);
});