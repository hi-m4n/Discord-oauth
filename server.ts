import express from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

dotenv.config();

// Extend express-session to include our custom properties
declare module 'express-session' {
  interface SessionData {
    user: any;
    accessToken: string;
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Discord OAuth2 Constants
const DISCORD_API_URL = 'https://discord.com/api/v10';
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || (process.env.APP_URL ? `${process.env.APP_URL}/auth/callback` : undefined);

// Middleware
app.use(cors());
app.use(express.json());
app.use(cookieParser());

// Session configuration for iframe context
// CRITICAL: SameSite: 'none' and Secure: true are required for the AI Studio iframe
app.use(session({
  secret: process.env.SESSION_SECRET || 'discord-oauth-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,      // Required for SameSite=None
    sameSite: 'none',  // Required for cross-origin iframe
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

/**
 * Diagnostic endpoint to check if environment variables are set
 */
app.get('/api/config-check', (req, res) => {
  res.json({
    clientIdSet: !!CLIENT_ID,
    clientSecretSet: !!CLIENT_SECRET,
    redirectUriSet: !!REDIRECT_URI,
    redirectUri: REDIRECT_URI,
    nodeEnv: process.env.NODE_ENV
  });
});

// --- Auth Routes ---

/**
 * Step 1: Construct the Discord OAuth2 URL
 * The client will fetch this and open it in a popup.
 */
app.get('/api/auth/url', (req, res) => {
  if (!CLIENT_ID || !REDIRECT_URI) {
    return res.status(500).json({ error: 'Discord Client ID or Redirect URI not configured' });
  }

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'identify guilds', // identify for basic profile, guilds for bonus
    prompt: 'consent'
  });

  const authUrl = `https://discord.com/api/oauth2/authorize?${params.toString()}`;
  res.json({ url: authUrl });
});

/**
 * Step 2: Callback handler
 * Discord redirects here with a 'code' parameter.
 */
app.get(['/auth/callback', '/auth/callback/'], async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send('No authorization code provided');
  }

  try {
    // Exchange code for access token
    const tokenResponse = await axios.post(
      `${DISCORD_API_URL}/oauth2/token`,
      new URLSearchParams({
        client_id: CLIENT_ID!,
        client_secret: CLIENT_SECRET!,
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: REDIRECT_URI!,
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token } = tokenResponse.data;

    // Fetch user profile info
    const userResponse = await axios.get(`${DISCORD_API_URL}/users/@me`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    // Store user info and token in session
    // In a real app, you might only store the user ID and fetch from a DB
    (req.session as any).user = userResponse.data;
    (req.session as any).accessToken = access_token;

    // Send success message to parent window and close popup
    res.send(`
      <html>
        <head>
          <title>Authentication Successful</title>
          <style>
            body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #36393f; color: white; }
            .container { text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Authentication Successful!</h2>
            <p>This window will close automatically.</p>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
              setTimeout(() => window.close(), 1000);
            } else {
              window.location.href = '/';
            }
          </script>
        </body>
      </html>
    `);
  } catch (error: any) {
    console.error('OAuth Error:', error.response?.data || error.message);
    res.status(500).send('Authentication failed. Please check server logs.');
  }
});

/**
 * Get current user info from session
 */
app.get('/api/user', (req, res) => {
  const user = (req.session as any).user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json(user);
});

/**
 * Get user guilds (Bonus)
 */
app.get('/api/guilds', async (req, res) => {
  const accessToken = (req.session as any).accessToken;
  if (!accessToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const response = await axios.get(`${DISCORD_API_URL}/users/@me/guilds`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    res.json(response.data);
  } catch (error: any) {
    console.error('Fetch Guilds Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch guilds' });
  }
});

/**
 * Logout
 */
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Could not log out' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out successfully' });
  });
});

// --- Vite Integration ---

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
