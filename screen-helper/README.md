# Screen Helper

A small Mac app. Press **⌘ ⇧ Space** and it takes a screenshot, sends it to Claude, and shows
answers to the questions on your screen: multiple choice, short answers, and putting things in
the right order. You can then type follow-up questions about the same screenshot.

## Set up (once)

1. Install Node.js from https://nodejs.org (the "LTS" version).
2. Get an API key from https://console.anthropic.com (Settings → API Keys). Using it costs a small
   amount per question.
3. Open the Terminal app and run:

   ```bash
   cd MausBot_Clone/screen-helper
   npm install
   ```

## Run it

```bash
npm start
```

- The first time, click **API key**, paste your key and click **Save**.
- macOS will ask for **Screen Recording** permission. Allow it in System Settings → Privacy &
  Security → Screen Recording (it may be listed as "Electron"), then quit and run `npm start` again.
- Press **⌘ ⇧ Space** (or click **Look at my screen**) whenever you want help.

## Change how it answers

Edit `SYSTEM_PROMPT` at the top of `main.js`, then restart.
