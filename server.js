// ============================================
// AuraAI - Main Server File (server.js)
// This is the backend that runs your app
// ============================================

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Database = require("better-sqlite3");
const Anthropic = require("@anthropic-ai/sdk");
const fetch = require("node-fetch");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Setup Database ───────────────────────────────────────────────────────────
const db = new Database("auraai.db");

// Create tables if they don't exist yet
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT DEFAULT 'New Chat',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chat_id) REFERENCES chats(id)
  );
`);

// ─── Setup Anthropic AI ───────────────────────────────────────────────────────
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static("public")); // Serve frontend files

// ─── Helper: Send Discord Notification ───────────────────────────────────────
async function sendDiscordNotification(userEmail, chatTitle, userMessage) {
  try {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) return;

    const payload = {
      username: "AuraAI Bot",
      avatar_url: "https://i.imgur.com/AfFp7pu.png",
      embeds: [
        {
          title: "💬 New Chat Message",
          color: 0x6c63ff, // Purple color
          fields: [
            {
              name: "👤 User",
              value: userEmail,
              inline: true,
            },
            {
              name: "📝 Chat Title",
              value: chatTitle || "New Chat",
              inline: true,
            },
            {
              name: "💭 Message",
              value:
                userMessage.length > 200
                  ? userMessage.substring(0, 200) + "..."
                  : userMessage,
            },
          ],
          timestamp: new Date().toISOString(),
          footer: {
            text: "AuraAI",
          },
        },
      ],
    };

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error("Discord notification failed:", error.message);
  }
}

// ─── Helper: Verify JWT Token ─────────────────────────────────────────────────
function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // "Bearer TOKEN"

  if (!token) {
    return res.status(401).json({ error: "No token provided. Please log in." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Attach user info to request
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token. Please log in again." });
  }
}

// ─── AUTH ROUTES ──────────────────────────────────────────────────────────────

// REGISTER - Create new account
app.post("/api/register", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }

  try {
    // Hash the password so it's not stored as plain text
    const hashedPassword = await bcrypt.hash(password, 10);

    const stmt = db.prepare("INSERT INTO users (email, password) VALUES (?, ?)");
    stmt.run(email, hashedPassword);

    // Send Discord notification for new registration
    await sendDiscordNotification(email, "Account Created", `New user registered: ${email}`);

    res.json({ message: "Account created successfully! You can now log in." });
  } catch (error) {
    if (error.message.includes("UNIQUE constraint failed")) {
      return res.status(400).json({ error: "An account with this email already exists." });
    }
    res.status(500).json({ error: "Server error. Please try again." });
  }
});

// LOGIN - Sign in to existing account
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);

  if (!user) {
    return res.status(401).json({ error: "No account found with this email." });
  }

  const passwordMatch = await bcrypt.compare(password, user.password);

  if (!passwordMatch) {
    return res.status(401).json({ error: "Incorrect password." });
  }

  // Create a token that lasts 7 days
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({
    token,
    user: { id: user.id, email: user.email },
    message: "Logged in successfully!",
  });
});

// ─── CHAT ROUTES ──────────────────────────────────────────────────────────────

// GET all chats for logged-in user
app.get("/api/chats", verifyToken, (req, res) => {
  const chats = db
    .prepare("SELECT * FROM chats WHERE user_id = ? ORDER BY created_at DESC")
    .all(req.user.userId);

  res.json(chats);
});

// CREATE a new chat
app.post("/api/chats", verifyToken, (req, res) => {
  const stmt = db.prepare("INSERT INTO chats (user_id, title) VALUES (?, ?)");
  const result = stmt.run(req.user.userId, "New Chat");

  const newChat = db.prepare("SELECT * FROM chats WHERE id = ?").get(result.lastInsertRowid);
  res.json(newChat);
});

// DELETE a chat and all its messages
app.delete("/api/chats/:chatId", verifyToken, (req, res) => {
  const chat = db
    .prepare("SELECT * FROM chats WHERE id = ? AND user_id = ?")
    .get(req.params.chatId, req.user.userId);

  if (!chat) {
    return res.status(404).json({ error: "Chat not found." });
  }

  db.prepare("DELETE FROM messages WHERE chat_id = ?").run(req.params.chatId);
  db.prepare("DELETE FROM chats WHERE id = ?").run(req.params.chatId);

  res.json({ message: "Chat deleted." });
});

// GET all messages in a chat
app.get("/api/chats/:chatId/messages", verifyToken, (req, res) => {
  // Make sure this chat belongs to the logged-in user
  const chat = db
    .prepare("SELECT * FROM chats WHERE id = ? AND user_id = ?")
    .get(req.params.chatId, req.user.userId);

  if (!chat) {
    return res.status(404).json({ error: "Chat not found." });
  }

  const messages = db
    .prepare("SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC")
    .all(req.params.chatId);

  res.json({ chat, messages });
});

// SEND a message and get AI response
app.post("/api/chats/:chatId/messages", verifyToken, async (req, res) => {
  const { message } = req.body;
  const chatId = req.params.chatId;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: "Message cannot be empty." });
  }

  // Make sure this chat belongs to the logged-in user
  const chat = db
    .prepare("SELECT * FROM chats WHERE id = ? AND user_id = ?")
    .get(chatId, req.user.userId);

  if (!chat) {
    return res.status(404).json({ error: "Chat not found." });
  }

  // Save user's message to database
  db.prepare("INSERT INTO messages (chat_id, role, content) VALUES (?, ?, ?)").run(
    chatId,
    "user",
    message
  );

  // Update chat title if it's still "New Chat"
  if (chat.title === "New Chat") {
    const newTitle = message.length > 40 ? message.substring(0, 40) + "..." : message;
    db.prepare("UPDATE chats SET title = ? WHERE id = ?").run(newTitle, chatId);
  }

  // Get all messages in this chat to send as context to the AI
  const allMessages = db
    .prepare("SELECT role, content FROM messages WHERE chat_id = ? ORDER BY created_at ASC")
    .all(chatId);

  try {
    // Call the AI
    const aiResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system:
        "You are AuraAI, a helpful, friendly, and intelligent AI assistant. Be concise but thorough. Use markdown formatting when helpful (like code blocks for code). You have a warm, professional personality.",
      messages: allMessages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
    });

    const aiMessage = aiResponse.content[0].text;

    // Save AI response to database
    db.prepare("INSERT INTO messages (chat_id, role, content) VALUES (?, ?, ?)").run(
      chatId,
      "assistant",
      aiMessage
    );

    // Get updated chat title
    const updatedChat = db.prepare("SELECT * FROM chats WHERE id = ?").get(chatId);

    // Send Discord notification
    await sendDiscordNotification(req.user.email, updatedChat.title, message);

    res.json({
      userMessage: { role: "user", content: message },
      aiMessage: { role: "assistant", content: aiMessage },
      chat: updatedChat,
    });
  } catch (error) {
    console.error("AI Error:", error.message);
    res.status(500).json({ error: "AI failed to respond. Check your API key." });
  }
});

// ─── Serve Frontend ───────────────────────────────────────────────────────────
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════╗
  ║          AuraAI is running!       ║
  ║   Open: http://localhost:${PORT}     ║
  ╚═══════════════════════════════════╝
  `);
});
