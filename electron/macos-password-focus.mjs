const BLUR_PASSWORD_INPUT = `(() => {
  let field = document.activeElement;
  while (field?.shadowRoot?.activeElement) field = field.shadowRoot.activeElement;
  if (field instanceof HTMLInputElement && field.type === "password") field.blur();
})()`;

function blurPasswordInput(contents) {
  try {
    if (!contents || contents.isDestroyed()) return;
    const frame = contents.focusedFrame ?? contents.mainFrame;
    if (frame && !frame.detached && !frame.isDestroyed()) {
      void frame.executeJavaScript(BLUR_PASSWORD_INPUT).catch(() => {});
    }
  } catch {
    // Electron can detach the frame or destroy its WebContents during a focus change.
  }
}

function blurWindowPasswords(win) {
  if (win.isDestroyed()) return;
  blurPasswordInput(win.webContents);
  const visit = (view) => {
    if (!view.getVisible()) return;
    blurPasswordInput(view.webContents);
    view.children.forEach(visit);
  };
  win.contentView.children.forEach(visit);
}

export function installMacPasswordFocusGuard(app, allWindows, platform = process.platform) {
  if (platform !== "darwin") return;
  app.on("browser-window-created", (_event, win) => {
    for (const event of ["hide", "minimize", "close"]) {
      win.on(event, () => blurWindowPasswords(win));
    }
  });
  app.on("browser-window-blur", (_event, win) => blurWindowPasswords(win));
  app.on("web-contents-created", (_event, contents) => {
    contents.on("blur", () => blurPasswordInput(contents));
  });
  app.on("before-quit", () => allWindows().forEach(blurWindowPasswords));
}

export function releaseMacViewPasswordFocus(contents, win, platform = process.platform) {
  if (platform !== "darwin" || !contents || contents.isDestroyed()) return;
  blurPasswordInput(contents);
  // In Electron 43, hiding a WebContentsView does not explicitly resign its Cocoa first responder.
  // Hand off native focus before detaching or hiding, while the owner is still the key window.
  try {
    if (win && !win.isDestroyed() && win.isFocused() && contents.isFocused()) {
      const host = win.webContents;
      if (host && host !== contents && !host.isDestroyed()) host.focus();
    }
  } catch {
    // The native view can disappear during renderer teardown.
  }
}
