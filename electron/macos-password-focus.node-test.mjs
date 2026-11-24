import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { installMacPasswordFocusGuard, releaseMacViewPasswordFocus } from "./macos-password-focus.mjs";

class Input {
  constructor(type) { this.type = type; }
  blur() { this.blurred = true; }
}

function frame(activeElement, requests = []) {
  return {
    detached: false,
    isDestroyed: () => false,
    async executeJavaScript(script) {
      requests.push("blur");
      runInNewContext(script, { document: { activeElement }, HTMLInputElement: Input });
    },
  };
}

function contents(mainFrame) {
  return Object.assign(new EventEmitter(), {
    mainFrame, isDestroyed: () => false, isFocused: () => true,
  });
}

function view(page, children = [], visible = true) {
  return { webContents: page, children, getVisible: () => visible };
}

test("only blurs the active password input, including a focused child frame and open shadow root", () => {
  const mainField = new Input("password");
  const childField = new Input("password");
  const page = contents(frame(mainField));
  page.focusedFrame = frame({ shadowRoot: { activeElement: childField } });
  releaseMacViewPasswordFocus(page, null, "darwin");
  assert.equal(childField.blurred, true);
  assert.equal(mainField.blurred, undefined);

  const textField = new Input("text");
  page.focusedFrame = frame(textField);
  releaseMacViewPasswordFocus(page, null, "darwin");
  assert.equal(textField.blurred, undefined);
});

test("requests password blur on window lifecycle events and includes visible child views", () => {
  const requests = [];
  const app = new EventEmitter();
  const page = contents(frame(new Input("password"), requests));
  const child = contents(frame(new Input("password"), requests));
  const hidden = new Input("password");
  const win = Object.assign(new EventEmitter(), {
    isDestroyed: () => false,
    webContents: page,
    contentView: view(null, [view(child), view(contents(frame(hidden)), [], false)]),
  });
  installMacPasswordFocusGuard(app, () => [win], "darwin");
  app.emit("browser-window-created", {}, win);
  for (const event of ["hide", "minimize", "close"]) win.emit(event);
  app.emit("browser-window-blur", {}, win);
  app.emit("before-quit");
  assert.equal(requests.length, 10);
  assert.equal(hidden.blurred, undefined);

  app.emit("web-contents-created", {}, child);
  child.emit("blur");
  assert.equal(requests.length, 11);
});

test("hands off native focus only when hiding a focused view in the key window", () => {
  const requests = [];
  const page = contents(frame(new Input("password"), requests));
  const host = { isDestroyed: () => false, focus: () => requests.push("focus host") };
  let windowFocused = true;
  const win = { isDestroyed: () => false, isFocused: () => windowFocused, webContents: host };

  releaseMacViewPasswordFocus(page, win, "darwin");
  assert.deepEqual(requests, ["blur", "focus host"]);
  windowFocused = false;
  releaseMacViewPasswordFocus(page, win, "darwin");
  assert.deepEqual(requests, ["blur", "focus host", "blur"]);
});

test("continues teardown when a frame is detached or rejects script execution", async () => {
  const requests = [];
  const page = contents(frame(new Input("password"), requests));
  page.mainFrame.detached = true;
  releaseMacViewPasswordFocus(page, null, "darwin");
  assert.deepEqual(requests, []);

  page.mainFrame = { isDestroyed: () => false, executeJavaScript: () => Promise.reject(new Error("gone")) };
  releaseMacViewPasswordFocus(page, null, "darwin");
  await new Promise((resolve) => setImmediate(resolve));
});

test("leaves the non-macOS focus lifecycle alone", () => {
  const app = new EventEmitter();
  const password = new Input("password");
  installMacPasswordFocusGuard(app, () => [], "linux");
  releaseMacViewPasswordFocus(contents(frame(password)), null, "linux");
  assert.deepEqual(app.eventNames(), []);
  assert.equal(password.blurred, undefined);
});
