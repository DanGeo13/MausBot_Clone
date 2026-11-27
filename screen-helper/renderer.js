const log = document.getElementById("log");
const input = document.getElementById("input");
let current = null;

const keyForm = document.getElementById("keyform");
const keyInput = document.getElementById("keyinput");

function askForKey() {
  keyForm.hidden = false;
  keyInput.focus();
}

keyForm.onsubmit = (e) => {
  e.preventDefault();
  if (!keyInput.value.trim()) return;
  window.helper.saveKey(keyInput.value.trim());
  keyInput.value = "";
  keyForm.hidden = true;
};

document.getElementById("look").onclick = () => window.helper.look();
document.getElementById("key").onclick = askForKey;
document.getElementById("form").onsubmit = (e) => {
  e.preventDefault();
  if (!input.value.trim()) return;
  window.helper.ask(input.value.trim());
  input.value = "";
};

window.helper.on("reset", () => { log.innerHTML = ""; current = null; });
window.helper.on("need-key", () => {
  askForKey();
  const a = document.createElement("div");
  a.className = "a";
  a.textContent = "Paste your API key above and click Save, then press 'Look at my screen' again.";
  log.append(a);
});
window.helper.on("answer-start", (q) => {
  if (q) {
    const qEl = document.createElement("div");
    qEl.className = "q";
    qEl.textContent = q;
    log.append(qEl);
  }
  current = document.createElement("div");
  current.className = "a";
  current.textContent = "Thinking…";
  current.dataset.empty = "1";
  log.append(current);
});
window.helper.on("answer-chunk", (t) => {
  if (!current) { current = document.createElement("div"); current.className = "a"; log.append(current); }
  if (current.dataset.empty) { current.textContent = ""; delete current.dataset.empty; }
  current.textContent += t;
  log.scrollTop = log.scrollHeight;
});
window.helper.on("answer-end", () => { current = null; });
