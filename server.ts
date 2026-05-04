import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { google } from "googleapis";
import session from "express-session";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

dotenv.config();

declare module "express-session" {
  interface SessionData {
    tokens: any;
  }
}

const googleConfig = {
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirect: `${process.env.APP_URL}/auth/callback`,
};

function createConnection() {
  return new google.auth.OAuth2(
    googleConfig.clientId,
    googleConfig.clientSecret,
    googleConfig.redirect
  );
}

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.profile',
];

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*" }
  });

  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());
  app.use(session({
    secret: 'secure-vision-stealth-secret',
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: true,
      sameSite: 'none',
      httpOnly: true,
    }
  }));

  // --- OAuth Routes ---

  app.get('/api/auth/url', (req, res) => {
    const auth = createConnection();
    const url = auth.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent'
    });
    res.json({ url });
  });

  app.get(['/auth/callback', '/auth/callback/'], async (req, res) => {
    const { code } = req.query;
    if (typeof code !== 'string') return res.status(400).send('Invalid code');

    const auth = createConnection();
    const { tokens } = await auth.getToken(code);
    
    // Store tokens in session (In production, use a database)
    req.session.tokens = tokens;

    res.send(`
      <html>
        <body style="background: #020617; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif;">
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <div style="text-align: center;">
            <p>Authentication Successful</p>
            <p style="font-size: 10px; opacity: 0.5;">Secure Tunnel Established</p>
          </div>
        </body>
      </html>
    `);
  });

  app.get('/api/auth/status', (req, res) => {
    const tokens = req.session.tokens;
    res.json({ isAuthenticated: !!tokens });
  });

  // --- Drive Proxy ---

  app.post('/api/drive/upload', async (req, res) => {
    const tokens = req.session.tokens;
    if (!tokens) return res.status(401).json({ error: 'Not authenticated' });

    const { imageData, filename } = req.body;
    if (!imageData) return res.status(400).json({ error: 'No image data' });

    try {
      const auth = createConnection();
      auth.setCredentials(tokens);
      const drive = google.drive({ version: 'v3', auth });

      // Find or create "SecureVision" folder
      let folderId: string;
      const folderRes = await drive.files.list({
        q: "name = 'SecureVision' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
        fields: 'files(id)',
      });

      if (folderRes.data.files && folderRes.data.files.length > 0) {
        folderId = folderRes.data.files[0].id!;
      } else {
        const createFolder = await drive.files.create({
          requestBody: {
            name: 'SecureVision',
            mimeType: 'application/vnd.google-apps.folder',
          },
          fields: 'id',
        });
        folderId = createFolder.data.id!;
      }

      // Upload file
      const buffer = Buffer.from(imageData.split(',')[1], 'base64');
      const fileMetadata = {
        name: filename || `sv_${Date.now()}.jpg`,
        parents: [folderId],
      };
      const media = {
        mimeType: 'image/jpeg',
        body: require('stream').Readable.from(buffer),
      };

      const file = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, webViewLink',
      });

      res.json({ id: file.data.id, link: file.data.webViewLink });
    } catch (error: any) {
      console.error('Drive upload error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // --- WebSocket Signaling ---

  const rooms = new Map<string, string[]>();

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("join", (roomId) => {
      socket.join(roomId);
      console.log(`Socket ${socket.id} joined room ${roomId}`);
      
      const current = rooms.get(roomId) || [];
      if (!current.includes(socket.id)) {
        rooms.set(roomId, [...current, socket.id]);
      }
      
      // Let everyone in the room know someone joined
      socket.to(roomId).emit("user-joined", socket.id);
    });

    socket.on("signal", ({ roomId, data }) => {
      // Broadcast signal (offer/answer/candidate) to others in the room
      socket.to(roomId).emit("signal", { from: socket.id, data });
    });

    socket.on("trigger", ({ roomId, command }) => {
      socket.to(roomId).emit("trigger", { from: socket.id, command });
    });

    socket.on("disconnect", () => {
      rooms.forEach((members, roomId) => {
        if (members.includes(socket.id)) {
          rooms.set(roomId, members.filter(m => m !== socket.id));
        }
      });
    });
  });

  // --- Vite Middleware ---

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
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

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
});
