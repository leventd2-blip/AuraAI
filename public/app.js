// ============================================
// AuraAI - Frontend JavaScript (app.js)
// Handles login, chat, and all UI interactions
// ============================================

// ─── App State ────────────────────────────────────────────────────────────────
let currentUser = null;    // Logged-in user info
let currentChatId = null;  // Which chat is open
let allChats = [];         // List of all chats
let isSending = false;     // Prevent double-sending

// ─── On Page Load ─────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // Check if user is already logged in (saved token)
  const savedToken = localStorage.getItem("auraai_token");
  const savedUser = localStorage.getItem("auraai_user");

  if (savedToken && savedUser) {
    currentUser = JSON.parse(savedUser);
    showApp();
    loadChats();
  } else {
    showAuthScreen();
  }

  // Configure marked.js (markdown parser)
  marked.setOptions({
    highlight: (code, lang) => {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return hljs.highlightAuto(code).value;
    },
    breaks: true,
  });
});

// ─── AUTH FUNCTIONS ────────────────────────────────────────────────────────────

// Switch between Login and Register tabs
function switchTab(tab) {
  const loginForm = document.getElementById("form-login");
  const registerForm = document.getElementById("form-register");
  const tabLogin = document.getElementById("tab-login");
  const tabRegister = document.getElementById("tab-register");

  clearAuthMessages();

  if (tab === "login") {
    loginForm.classList.remove("hidden");
    registerForm.classList.add("hidden");
    tabLogin.classList.add("active");
    tabRegister.classList.remove("active");
  } else {
    loginForm.classList.add("hidden");
    registerForm.classList.remove("hidden");
    tabLogin.classList.remove("active");
    tabRegister.classList.add("active");
  }
}

// Show error message on auth screen
function showAuthError(msg) {
  const el = document.getElementById("auth-error");
  el.textContent = msg;
  el.classList.remove("hidden");
  document.getElementById("auth-success").classList.add("hidden");
}

// Show success message on auth screen
function showAuthSuccess(msg) {
  const el = document.getElementById("auth-success");
  el.textContent = msg;
  el.classList.remove("hidden");
  document.getElementById("auth-error").classList.add("hidden");
}

// Clear all auth messages
function clearAuthMessages() {
  document.getElementById("auth-error").classList.add("hidden");
  document.getElementById("auth-success").classList.add("hidden");
}

// Handle login form submission
async function handleLogin() {
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const btnText = document.getElementById("login-btn-text");

  if (!email || !password) {
    showAuthError("Please fill in both fields.");
    return;
  }

  // Show loading state
  btnText.textContent = "Logging in...";
  document.querySelector(".auth-btn").disabled = true;
  clearAuthMessages();

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      showAuthError(data.error || "Login failed.");
      return;
    }

    // Save token and user info
    localStorage.setItem("auraai_token", data.token);
    localStorage.setItem("auraai_user", JSON.stringify(data.user));
    currentUser = data.user;

    // Show the main app
    showApp();
    await loadChats();
  } catch (error) {
    showAuthError("Cannot connect to server. Make sure it's running.");
  } finally {
    btnText.textContent = "Log In";
    document.querySelector(".auth-btn").disabled = false;
  }
}

// Handle register form submission
async function handleRegister() {
  const email = document.getElementById("register-email").value.trim();
  const password = document.getElementById("register-password").value;

  if (!email || !password) {
    showAuthError("Please fill in both fields.");
    return;
  }

  clearAuthMessages();

  try {
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      showAuthError(data.error || "Registration failed.");
      return;
    }

    showAuthSuccess("Account created! You can now log in.");
    switchTab("login");
    document.getElementById("login-email").value = email;
  } catch (error) {
    showAuthError("Cannot connect to server. Make sure it's running.");
  }
}

// Handle logout
function handleLogout() {
  localStorage.removeItem("auraai_token");
  localStorage.removeItem("auraai_user");
  currentUser = null;
  currentChatId = null;
  allChats = [];

  showAuthScreen();
}

// ─── SCREEN SWITCHING ──────────────────────────────────────────────────────────

function showAuthScreen() {
  document.getElementById("auth-screen").classList.remove("hidden");
  document.getElementById("app-screen").classList.add("hidden");
}

function showApp() {
  document.getElementById("auth-screen").classList.add("hidden");
  document.getElementById("app-screen").classList.remove("hidden");
  document.getElementById("user-email-display").textContent = currentUser.email;
}

// ─── CHAT LIST FUNCTIONS ────────────────────────────────────────────────────────

// Load all chats from the server
async function loadChats() {
  try {
    const res = await fetch("/api/chats", {
      headers: { Authorization: "Bearer " + localStorage.getItem("auraai_token") },
    });

    if (res.status === 401) {
      handleLogout();
      return;
    }

    allChats = await res.json();
    renderChatList();
  } catch (error) {
    console.error("Failed to load chats:", error);
  }
}

// Render chat list in sidebar
function renderChatList() {
  const chatList = document.getElementById("chat-list");

  if (allChats.length === 0) {
    chatList.innerHTML = '<div class="no-chats">No chats yet.<br/>Click "New Chat" to start!</div>';
    return;
  }

  chatList.innerHTML = allChats
    .map(
      (chat) => `
      <div class="chat-item ${chat.id === currentChatId ? "active" : ""}"
           id="chat-item-${chat.id}"
           onclick="openChat(${chat.id})">
        <span class="chat-item-title">💬 ${escapeHtml(chat.title)}</span>
        <button class="chat-item-delete" onclick="deleteChat(event, ${chat.id})" title="Delete chat">✕</button>
      </div>
    `
    )
    .join("");
}

// Create a new chat
async function createNewChat() {
  try {
    const res = await fetch("/api/chats", {
      method: "POST",
      headers: { Authorization: "Bearer " + localStorage.getItem("auraai_token") },
    });

    const newChat = await res.json();
    allChats.unshift(newChat); // Add to top of list
    renderChatList();
    openChat(newChat.id);
  } catch (error) {
    console.error("Failed to create chat:", error);
  }
}

// Open a chat and load its messages
async function openChat(chatId) {
  currentChatId = chatId;

  // Mark active in sidebar
  document.querySelectorAll(".chat-item").forEach((el) => el.classList.remove("active"));
  const activeItem = document.getElementById(`chat-item-${chatId}`);
  if (activeItem) activeItem.classList.add("active");

  // Hide welcome screen, show messages
  document.getElementById("welcome-screen").classList.add("hidden");
  const messagesContainer = document.getElementById("messages-container");
  messagesContainer.classList.remove("hidden");
  messagesContainer.innerHTML = "";

  // Close sidebar on mobile
  document.getElementById("sidebar").classList.remove("open");

  try {
    const res = await fetch(`/api/chats/${chatId}/messages`, {
      headers: { Authorization: "Bearer " + localStorage.getItem("auraai_token") },
    });

    const data = await res.json();

    // Update title in topbar
    document.getElementById("current-chat-title").textContent = data.chat.title;

    // Render all messages
    if (data.messages.length === 0) {
      messagesContainer.innerHTML = `
        <div style="text-align:center; color: var(--text-muted); padding: 60px 20px; font-size: 14px;">
          Start the conversation below 👇
        </div>
      `;
    } else {
      data.messages.forEach((msg) => appendMessage(msg.role, msg.content, false));
      scrollToBottom();
    }
  } catch (error) {
    console.error("Failed to load messages:", error);
  }
}

// Delete a chat
async function deleteChat(event, chatId) {
  event.stopPropagation(); // Don't open the chat when clicking delete

  if (!confirm("Delete this chat? This cannot be undone.")) return;

  try {
    await fetch(`/api/chats/${chatId}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + localStorage.getItem("auraai_token") },
    });

    allChats = allChats.filter((c) => c.id !== chatId);

    if (currentChatId === chatId) {
      currentChatId = null;
      document.getElementById("messages-container").classList.add("hidden");
      document.getElementById("welcome-screen").classList.remove("hidden");
      document.getElementById("current-chat-title").textContent = "Select or create a chat";
    }

    renderChatList();
  } catch (error) {
    console.error("Failed to delete chat:", error);
  }
}

// ─── MESSAGING ─────────────────────────────────────────────────────────────────

// Send a message
async function sendMessage() {
  if (isSending) return;

  const input = document.getElementById("message-input");
  const message = input.value.trim();

  if (!message) return;

  // Create a chat if none is selected
  if (!currentChatId) {
    await createNewChat();
    await new Promise((r) => setTimeout(r, 100)); // Small wait
  }

  input.value = "";
  input.style.height = "auto";
  isSending = true;
  document.getElementById("send-btn").disabled = true;

  // Show user message immediately
  const messagesContainer = document.getElementById("messages-container");
  messagesContainer.classList.remove("hidden");

  // Remove "start the conversation" text if present
  const placeholder = messagesContainer.querySelector("div[style]");
  if (placeholder) placeholder.remove();

  appendMessage("user", message, true);
  showTypingIndicator();

  try {
    const res = await fetch(`/api/chats/${currentChatId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + localStorage.getItem("auraai_token"),
      },
      body: JSON.stringify({ message }),
    });

    const data = await res.json();
    hideTypingIndicator();

    if (!res.ok) {
      appendMessage(
        "ai",
        "❌ Error: " + (data.error || "Something went wrong. Please try again."),
        true
      );
      return;
    }

    // Show AI response
    appendMessage("assistant", data.aiMessage.content, true);

    // Update chat title in sidebar and topbar
    const chatIndex = allChats.findIndex((c) => c.id === currentChatId);
    if (chatIndex !== -1) {
      allChats[chatIndex].title = data.chat.title;
      renderChatList();
    }
    document.getElementById("current-chat-title").textContent = data.chat.title;
  } catch (error) {
    hideTypingIndicator();
    appendMessage("ai", "❌ Connection error. Is the server running?", true);
  } finally {
    isSending = false;
    document.getElementById("send-btn").disabled = false;
    input.focus();
  }
}

// Quick start from welcome screen examples
async function quickStart(message) {
  await createNewChat();
  document.getElementById("message-input").value = message;
  await sendMessage();
}

// Add a message bubble to the screen
function appendMessage(role, content, animate) {
  const container = document.getElementById("messages-container");
  const isUser = role === "user";

  const div = document.createElement("div");
  div.className = `message ${isUser ? "user" : "ai"}`;

  if (isUser) {
    div.innerHTML = `
      <div class="message-content">${escapeHtml(content)}</div>
    `;
  } else {
    // Parse markdown for AI messages
    div.innerHTML = `
      <div class="message-avatar">✦</div>
      <div class="message-content">${marked.parse(content)}</div>
    `;
    // Apply syntax highlighting to code blocks
    setTimeout(() => {
      div.querySelectorAll("pre code").forEach((block) => {
        hljs.highlightElement(block);
      });
    }, 0);
  }

  container.appendChild(div);

  if (animate) {
    scrollToBottom();
  }
}

// Show typing indicator
function showTypingIndicator() {
  document.getElementById("typing-indicator").classList.remove("hidden");
  scrollToBottom();
}

// Hide typing indicator
function hideTypingIndicator() {
  document.getElementById("typing-indicator").classList.add("hidden");
}

// Scroll messages to the bottom
function scrollToBottom() {
  const container = document.getElementById("messages-container");
  container.scrollTop = container.scrollHeight;
}

// ─── UI HELPERS ────────────────────────────────────────────────────────────────

// Handle keyboard shortcuts in textarea
function handleKeyDown(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
}

// Auto-resize textarea as user types
function autoResize(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 160) + "px";
}

// Toggle sidebar on mobile
function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
}

// Safely escape HTML to prevent XSS attacks
function escapeHtml(text) {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}

// Allow pressing Enter on auth inputs
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !document.getElementById("auth-screen").classList.contains("hidden")) {
    const loginForm = document.getElementById("form-login");
    if (!loginForm.classList.contains("hidden")) {
      handleLogin();
    } else {
      handleRegister();
    }
  }
});
