# ✦ AuraAI

A beautiful, functional AI chat application with user accounts, saved chat history, and Discord notifications.

---

## 📁 File Overview (What Each File Does)

```
AuraAI/
│
├── server.js          ← The backend brain. Handles API, login, AI calls
├── package.json       ← Lists all the tools (packages) the app needs
├── .env               ← YOUR SECRET KEYS (you create this, never share it!)
├── .env.example       ← Template showing what goes in .env
├── .gitignore         ← Tells GitHub what NOT to upload
├── README.md          ← This file!
│
└── public/            ← Everything the user sees in their browser
    ├── index.html     ← The page structure (login screen + chat interface)
    ├── style.css      ← All the colors, layout, and visual design
    └── app.js         ← Makes the page interactive (buttons, sending messages, etc.)
```

---

## 🚀 Setup Guide (Step by Step)

### Step 1: Install Node.js
- Download from: https://nodejs.org
- Choose the **LTS version** (the one that says "Recommended")
- Install it like a normal program

To check it worked, open a terminal and type:
```
node --version
```
You should see something like `v20.0.0`

---

### Step 2: Download this project
Either clone with Git:
```
git clone https://github.com/YOUR_USERNAME/AuraAI.git
cd AuraAI
```

Or download the ZIP from GitHub and extract it, then open a terminal in that folder.

---

### Step 3: Install dependencies
In the AuraAI folder, run:
```
npm install
```
This downloads all the packages listed in `package.json`. Wait for it to finish.

---

### Step 4: Get your Anthropic API Key
1. Go to https://console.anthropic.com
2. Sign up / log in
3. Click "API Keys" in the sidebar
4. Click "Create Key"
5. Copy the key (starts with `sk-ant-...`)

---

### Step 5: Create your .env file
1. Copy the `.env.example` file and rename it to `.env`
2. Open `.env` in any text editor (Notepad, VS Code, etc.)
3. Fill in your values:

```
ANTHROPIC_API_KEY=sk-ant-your-actual-key-here
JWT_SECRET=any-long-random-string-like-this-abc123xyz789
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...your-webhook...
PORT=3000
```

**For JWT_SECRET**: Just type any long random string. Example: `mySecretKey2024SuperLong!`

---

### Step 6: Start the server
```
npm start
```

You should see:
```
╔═══════════════════════════════════╗
║          AuraAI is running!       ║
║   Open: http://localhost:3000     ║
╚═══════════════════════════════════╝
```

---

### Step 7: Open the app
Go to your browser and visit: **http://localhost:3000**

---

## 💬 Discord Notifications

Every time a user sends a message, your Discord channel will receive a notification showing:
- 👤 The user's email
- 📝 The chat title
- 💭 The message content

To set up a webhook:
1. Open your Discord server
2. Go to Server Settings → Integrations → Webhooks
3. Create New Webhook
4. Copy the URL and paste it in your `.env` file

---

## 🔧 Development Mode (Auto-restart on changes)
```
npm run dev
```
This uses `nodemon` to automatically restart when you edit files.

---

## 🌐 Deploying to the Internet (Optional)

### Easiest option: Railway
1. Go to https://railway.app
2. Connect your GitHub repo
3. Add your environment variables (same as .env)
4. Deploy!

### Other options: Render, Fly.io, Heroku

---

## ❓ Troubleshooting

**"Cannot find module..."**
→ Run `npm install` again

**"Invalid API key"**
→ Check your `.env` file. Make sure there are no spaces around the `=` sign.

**The page won't load**
→ Make sure the server is running (`npm start`) and visit http://localhost:3000

**Discord notifications not working**
→ Double-check the webhook URL in your `.env` file
