const { app, BrowserWindow, globalShortcut, desktopCapturer, screen, ipcMain, safeStorage, systemPreferences } = require("electron");
const fs = require("fs");
const path = require("path");
const Anthropic = require("@anthropic-ai/sdk").default;

const SHORTCUT = "CommandOrControl+Shift+Space";
const MODEL = "claude-opus-5-5";
const SYSTEM_PROMPT = `You are a screen assistant. You get a screenshot of the user's screen.
Find the questions or tasks visible on it and answer each one.
- Multiple choice: give the letter/option and a one-line reason.
- Short answer: answer in one to three sentences.
- Ordering/sequencing: give the correct order as a numbered list.
- Anything else: briefly explain what is on screen and what to do next.
If the user asks a follow-up, answer it using the screenshot. Be concise. Use plain text.`;

let win;
let lastScreenshot = null;
let history = [];

const keyFile = () => path.join(app.getPath("userData"), "api-key.bin");

function loadApiKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  try {
    return safeStorage.decryptString(fs.readFileSync(keyFile()));
  } catch {
    return null;
  }
}

function saveApiKey(key) {
  fs.writeFileSync(keyFile(), safeStorage.encryptString(key));
}

async function captureScreen() {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const { width, height } = display.size;
  const scale = Math.min(1, 1600 / Math.max(width, height));
  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: { width: Math.round(width * scale), height: Math.round(height * scale) },
  });
  const source = sources.find((s) => s.display_id === String(display.id)) ?? sources[0];
  if (!source || source.thumbnail.isEmpty()) {
    throw new Error("Couldn't capture the screen. On a Mac, allow Screen Recording in System Settings → Privacy & Security, then restart the app.");
  }
  return source.thumbnail.toPNG().toString("base64");
}

async function ask(question) {
  const apiKey = loadApiKey();
  if (!apiKey) {
    win.webContents.send("need-key");
    return;
  }
  const client = new Anthropic({ apiKey });

  const content = [];
  if (history.length === 0) {
    content.push({ type: "image", source: { type: "base64", media_type: "image/png", data: lastScreenshot } });
  }
  content.push({ type: "text", text: question || "Answer the questions on my screen." });
  history.push({ role: "user", content });

  win.webContents.send("answer-start", question);
  try {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages: history,
    });
    stream.on("text", (t) => win.webContents.send("answer-chunk", t));
    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") {
      win.webContents.send("answer-chunk", "\n(Claude declined to answer this one.)");
    }
    history.push({ role: "assistant", content: final.content });
  } catch (err) {
    history.pop();
    let msg = err.message;
    if (err instanceof Anthropic.AuthenticationError) msg = "That API key didn't work. Click 'API key' to change it.";
    else if (err instanceof Anthropic.RateLimitError) msg = "Too many requests right now. Wait a moment and try again.";
    win.webContents.send("answer-chunk", `\nError: ${msg}`);
  }
  win.webContents.send("answer-end");
}

async function lookAtScreen() {
  win.hide();
  await new Promise((r) => setTimeout(r, 250));
  try {
    lastScreenshot = await captureScreen();
    history = [];
    win.show();
    win.webContents.send("reset");
    await ask("");
  } catch (err) {
    win.show();
    win.webContents.send("reset");
    win.webContents.send("answer-chunk", err.message);
    win.webContents.send("answer-end");
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 420,
    height: 560,
    alwaysOnTop: true,
    title: "Screen Helper",
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false },
  });
  win.loadFile("index.html");
}

app.whenReady().then(() => {
  createWindow();
  if (process.platform === "darwin") systemPreferences.getMediaAccessStatus("screen");
  globalShortcut.register(SHORTCUT, lookAtScreen);

  ipcMain.on("look", lookAtScreen);
  ipcMain.on("ask", (_e, q) => lastScreenshot && ask(q));
  ipcMain.on("save-key", (_e, key) => saveApiKey(key.trim()));
});

app.on("will-quit", () => globalShortcut.unregisterAll());
app.on("window-all-closed", () => app.quit());
