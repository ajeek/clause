import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import http from "http";

async function startServer() {
  const app = express();
  const PORT = 3000;
  const server = http.createServer(app);

  // Body parser for JSON RPC payload (increased limit for large ABI/args)
  app.use(express.json({ limit: "50mb" }));

  // Proxy API route for GenLayer RPC
  app.post("/api/genlayer", async (req, res) => {
    try {
      const response = await fetch("https://studio.genlayer.com/api", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(req.body),
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error("GenLayer returned non-JSON:", text.slice(0, 200));
        return res.status(502).json({ error: "GenLayer returned non-JSON" });
      }

      res.status(response.status).json(data);
    } catch (error) {
      console.error("RPC Proxy Error:", error);
      res.status(500).json({ error: "Failed to proxy RPC request" });
    }
  });

  // Error handler for express.json() payload errors
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err) {
      return res.status(err.status || 500).json({ error: err.message || "Internal Server Error" });
    }
    next();
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: { server } },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
