import * as webllm from "https://esm.run/@mlc-ai/web-llm";

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const starterFiles = () => ({
  "index.html": "<!doctype html>\n<html><head><meta charset=\"utf-8\"><title>Hello</title></head><body><h1>Hello, Stuffnest!</h1><p>Edit index.html and preview.</p></body></html>",
  "Main.java": "public class Main {\n  public static void main(String[] args) {\n    System.out.println(\"Hello from Java!\");\n  }\n}",
  "main.cpp": "#include <iostream>\nint main() { std::cout << \"Hello from C++!\\n\"; return 0; }",
  "main.py": "print('Hello from Python')"
});
let engine = null, busy = false, chats = read("sn-code-chats", []), activeChat = null;
let files = read("sn-code-files", null) || starterFiles(), activeFile = "index.html";
let currentView = "chat", selectedRemote = null, repoName = "", repoBranch = "main";
let runtimeList = [], cancelRequested = false, requestCounter = 0, pyodidePromise = null;

// Small progressive enhancement layer: motion, quick prompts, visible work status,
// and a first-party StuffChat link without adding dependencies to the static page.
const enhancementStyles = document.createElement("style");
enhancementStyles.textContent = `
#messages{scroll-behavior:smooth}.msg{animation:sn-msg-in .22s ease-out both}@keyframes sn-msg-in{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
#thinkingStrip{display:flex;align-items:center;gap:8px;padding:7px 12px;color:#aab8d6;font-size:11px;border-bottom:1px solid #293143;background:linear-gradient(90deg,#111827,#121521)}#thinkingStrip .pulse{width:7px;height:7px;border-radius:50%;background:#a18bff;box-shadow:0 0 12px #9b83ff;animation:sn-pulse 1s infinite alternate}@keyframes sn-pulse{to{opacity:.3;transform:scale(.7)}}
#quickPrompts{display:flex;gap:6px;overflow:auto;padding:7px 12px 0;scrollbar-width:thin}#quickPrompts button{white-space:nowrap;font-size:10px;padding:5px 8px;border-radius:99px;background:#161c29;color:#bdc8df}
#stuffChatLink{display:flex;align-items:center;justify-content:center;text-decoration:none;background:linear-gradient(135deg,#7c9cff,#a477ff);color:#091020;border-radius:7px;font-size:11px;font-weight:800;padding:7px;margin:6px 0}
#workPlan{margin-top:7px;padding:8px 10px;border:1px solid #30384a;border-radius:8px;background:#111722;color:#bdc8dd;font-size:11px;white-space:pre-wrap}
#contextPicker{max-width:170px;background:#0d1018;border:1px solid #293143;border-radius:6px;padding:5px;color:#ccd4e5;font-size:10px}
@media(prefers-reduced-motion:reduce){.msg,#thinkingStrip .pulse{animation:none}}
`;
document.head.append(enhancementStyles);

function saveAll() {
  try { localStorage.setItem("sn-code-chats", JSON.stringify(chats.slice(0, 40))); localStorage.setItem("sn-code-files", JSON.stringify(files)); }
  catch { if ($("#chatStatus")) $("#chatStatus").textContent = "Browser storage is full; download/export important work."; }
}
function persistFiles() {
  try { localStorage.setItem("sn-code-files", JSON.stringify(files)); }
  catch { setOutput("Storage is full. Download/export your project to keep changes."); }
}
function escapeHTML(text) { const el = document.createElement("span"); el.textContent = text; return el.innerHTML; }
function setOutput(message, status = "") { $("#output").textContent = message; if (status) $("#runnerStatus").textContent = status; }
function showLoading(title, detail, step = "Preparing…", progress = 0) {
  $("#loadingTitle").textContent = title; $("#loadingDetail").textContent = detail;
  $("#loadingStep").textContent = step; $("#loadingBar").style.width = `${Math.max(0, Math.min(100, progress))}%`;
  $("#loadingOverlay").classList.remove("hide");
}
function updateLoading(step, progress = 0) { $("#loadingStep").textContent = step; $("#loadingBar").style.width = `${Math.max(0, Math.min(100, progress))}%`; }
function hideLoading() { $("#loadingOverlay").classList.add("hide"); }
$("#cancelWork").onclick = () => { cancelRequested = true; engine?.interruptGenerate?.(); $("#loadingDetail").textContent = "Stop requested. Waiting for the current model step to finish…"; };

function appendPlain(parent, text) {
  for (const chunk of text.split(/(`[^`]+`)/g)) {
    if (/^`[^`]+`$/.test(chunk)) { const code = document.createElement("code"); code.className = "inlinecode"; code.textContent = chunk.slice(1, -1); parent.append(code); }
    else parent.append(document.createTextNode(chunk));
  }
}
async function copyText(text, message = "Copied.") {
  try { await navigator.clipboard.writeText(text); setOutput(message); }
  catch { setOutput("Clipboard access blocked. Select the text and copy manually."); }
}
function addCodeBlock(parent, code, language = "code") {
  const box = document.createElement("div"); box.className = "codeblock";
  const head = document.createElement("div"); head.className = "codehead";
  const label = document.createElement("span"); label.textContent = language || "code";
  const copy = document.createElement("button"); copy.textContent = "Copy"; copy.onclick = () => copyText(code, "Code copied.");
  head.append(label, copy); const pre = document.createElement("pre"); pre.textContent = code; box.append(head, pre); parent.append(box);
}
function renderRich(parent, text) {
  parent.replaceChildren(); const re = /```([\w+#.-]*)\s*\n([\s\S]*?)```/g; let cursor = 0, match;
  while ((match = re.exec(text))) { if (match.index > cursor) appendPlain(parent, text.slice(cursor, match.index)); addCodeBlock(parent, match[2].replace(/\n$/, ""), match[1] || "code"); cursor = re.lastIndex; }
  if (cursor < text.length) appendPlain(parent, text.slice(cursor));
}
function addChatMessage(role, content) {
  const row = document.createElement("div"); row.className = `msg ${role === "assistant" ? "ai" : ""}`;
  const avatar = document.createElement("div"); avatar.className = "avatar"; avatar.textContent = role === "assistant" ? "AI" : "YOU";
  const bubble = document.createElement("div"); bubble.className = "bubble";
  const who = document.createElement("div"); who.className = "who"; who.textContent = role === "assistant" ? "Stuffnest Code" : "You";
  const body = document.createElement("div"); body.className = "text"; renderRich(body, content); bubble.append(who, body); row.append(avatar, bubble); $("#messages").append(row); return body;
}
function newChat() {
  activeChat = { id: crypto.randomUUID?.() || String(Date.now()), title: "New conversation", messages: [], updated: Date.now() };
  chats.unshift(activeChat); saveAll(); renderChatList(); renderChat();
}
function renderChatList() {
  const list = $("#chatExplorer"); list.replaceChildren();
  for (const chat of chats.slice(0, 20)) { const button = document.createElement("button"); button.textContent = chat.title || "New conversation"; button.className = "fileitem"; button.onclick = () => { activeChat = chat; renderChat(); }; list.append(button); }
}
function renderChat() {
  if (!activeChat) activeChat = chats[0] || null;
  if (!activeChat) { newChat(); return; }
  const box = $("#messages"); box.replaceChildren();
  if (!activeChat.messages.length) addChatMessage("assistant", "Hi! I’m your local coding partner. Load a model, choose a quick prompt, or paste your code. I can explain, debug, refactor, generate code, and help with your Stuffnest project.");
  else activeChat.messages.forEach((m) => addChatMessage(m.role, m.content));
  requestAnimationFrame(() => { box.scrollTop = box.scrollHeight; });
}

// Hook into the existing layout with helpful actions and StuffChat navigation.
const stuffChat = document.createElement("a"); stuffChat.id = "stuffChatLink"; stuffChat.href = "../stuffchat.html"; stuffChat.target = "_blank"; stuffChat.rel = "noopener"; stuffChat.textContent = "☁ Open StuffChat"; stuffChat.title = "Open StuffChat in a new tab";
$(".explorer-content").append(stuffChat);
const strip = document.createElement("div"); strip.id = "thinkingStrip"; strip.innerHTML = '<span class="pulse"></span><span id="thinkingText">Ready when you are · AI runs on this device</span><span style="margin-left:auto" id="modelChip">LOCAL</span>';
$("#view-chat").prepend(strip);
const quick = document.createElement("div"); quick.id = "quickPrompts";
for (const [label, prompt] of [["Explain code", "Explain this code step by step:"], ["Find bug", "Review this code for bugs and suggest fixes:"], ["Make a website", "Create a polished responsive website for:"], ["Write tests", "Write useful tests for:"]]) {
  const b = document.createElement("button"); b.textContent = label; b.onclick = () => { const input = $("#prompt"); input.value = prompt + (activeFile && files[activeFile] ? `\n\n${files[activeFile]}` : ""); input.focus(); }; quick.append(b);
}
$(".composer").prepend(quick);
const ctxPicker = document.createElement("select"); ctxPicker.id = "contextPicker"; ctxPicker.title = "Add local file as prompt context"; ctxPicker.innerHTML = '<option value="">Add file context…</option>';
$(".composefoot .row").prepend(ctxPicker);
ctxPicker.onchange = () => { const name = ctxPicker.value; if (name && files[name]) $("#prompt").value += `\n\nFile ${name}:\n\`\`\`${name.split(".").pop()}\n${files[name]}\n\`\`\``; ctxPicker.value = ""; $("#prompt").focus(); };
function updateContextPicker() { const selected = ctxPicker.value; ctxPicker.replaceChildren(new Option("Add file context…", "")); for (const name of Object.keys(files).sort()) ctxPicker.add(new Option(name, name)); if (selected) ctxPicker.value = selected; }

const viewNames = { chat: "AI Chat", ide: "Browser IDE", github: "GitHub Repositories", game: "Break time" };
function changeView(name) {
  currentView = name; $$('[data-view]').forEach((b) => b.classList.toggle("active", b.dataset.view === name));
  $$(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${name}`));
  $("#title").textContent = viewNames[name]; $("#subtitle").textContent = ({ chat: "Private · saved on this device", ide: "Explorer · editor · preview", github: "Public GitHub files · shared workspace", game: "Take a short focus break" })[name];
  $("#explorerHeading").textContent = ({ chat: "CHAT", ide: "EXPLORER", github: "GITHUB", game: "BREAK" })[name];
  $("#chatExplorer").classList.toggle("hide", name !== "chat"); $("#ideExplorer").classList.toggle("hide", name !== "ide"); $("#githubExplorer").classList.toggle("hide", name !== "github"); $("#gameExplorer").classList.toggle("hide", name !== "game");
  $("#clear").classList.toggle("hide", name !== "chat"); if (name === "chat") requestAnimationFrame(() => { $("#messages").scrollTop = $("#messages").scrollHeight; }); updateContextHint();
}
$$('[data-view]').forEach((b) => b.addEventListener("click", () => changeView(b.dataset.view)));

function populateModels() {
  const select = $("#model"), catalog = webllm.prebuiltAppConfig?.model_list || [];
  const coder = catalog.filter((m) => /coder|coding/i.test(`${m.model_id} ${m.model || ""}`));
  const qwen = catalog.filter((m) => /qwen/i.test(m.model_id));
  const small = catalog.filter((m) => /0\.5b|0\.6b|1b|1\.5b|2b/i.test(m.model_id));
  const seen = new Set(), options = [...coder, ...qwen, ...small].filter((m) => { if (seen.has(m.model_id)) return false; seen.add(m.model_id); return true; }).slice(0, 20);
  select.replaceChildren();
  for (const model of options) { const o = new Option(`${model.model_id}${model.vram_required_MB ? ` · ~${Math.round(model.vram_required_MB / 1024)} GB` : ""}`, model.model_id); select.add(o); }
  if (!select.options.length) select.add(new Option("Qwen3 0.6B (catalog fallback)", "Qwen3-0.6B-q4f16_1-MLC"));
  const preferred = [...select.options].findIndex((o) => /0\.6b|1b|1\.5b/i.test(o.text)); if (preferred >= 0) select.selectedIndex = preferred;
  $("#modelChip").textContent = select.options[select.selectedIndex]?.text.split(" ")[0] || "LOCAL";
}
populateModels(); $("#model").onchange = () => { $("#modelChip").textContent = $("#model").selectedOptions[0]?.text.split(" ")[0] || "LOCAL"; engine = null; $("#aiState").textContent = "Model changed"; $("#aiDetail").textContent = "Load the selected model to continue"; $("#dot").className = "dot"; };
if (navigator.gpu) $("#gpu").textContent = "WebGPU ready";
else { $("#gpu").textContent = "WebGPU unavailable"; $("#aiState").textContent = "WebGPU needed"; $("#aiDetail").textContent = "Try current Chrome/Edge"; $("#dot").className = "dot bad"; }
async function loadModel() {
  if (!navigator.gpu) { alert("WebGPU is unavailable. Try a current Chrome or Edge browser on a supported device."); return; }
  const button = $("#load"); button.disabled = true; $("#aiState").textContent = "Loading model…"; $("#aiDetail").textContent = "First download/compile can take several minutes."; $("#dot").className = "dot loading";
  showLoading("Loading local AI model", "The initial download and GPU compilation may take a while.", "Starting…", 0);
  try {
    engine = await webllm.CreateMLCEngine($("#model").value, { initProgressCallback: (p) => { const pct = Math.round((p.progress || 0) * 100); $("#progress").style.width = `${pct}%`; $("#aiDetail").textContent = p.text || "Downloading/compiling…"; updateLoading(p.text || "Preparing model…", pct); } });
    $("#aiState").textContent = "Ready"; $("#aiDetail").textContent = "Model ready · cached in browser"; $("#dot").className = "dot good"; $("#sideDot").className = "dot good"; $("#thinkingText").textContent = "Ready · your prompts stay on-device";
  } catch (e) { $("#aiState").textContent = "Load failed"; $("#aiDetail").textContent = String(e.message || e).slice(0, 180); $("#dot").className = "dot bad"; }
  finally { hideLoading(); button.disabled = false; }
}
$("#load").onclick = loadModel;

function splitIntoChunks(text, maxChars = 3200) {
  const chunks = []; let start = 0;
  while (start < text.length) { let end = Math.min(start + maxChars, text.length); if (end < text.length) { const boundary = Math.max(text.lastIndexOf("\n", end), text.lastIndexOf(". ", end), text.lastIndexOf(" ", end)); if (boundary > start + maxChars * .55) end = boundary + 1; } chunks.push(text.slice(start, end)); start = end; }
  return chunks;
}
function fitConversation(system, messages, budget = 7000) {
  let remaining = budget - system.length; const result = [];
  for (let i = messages.length - 1; i >= 0 && result.length < 5; i--) { const item = messages[i]; if (item.content.length <= remaining) { result.unshift(item); remaining -= item.content.length; } }
  return [{ role: "system", content: system }, ...result];
}
async function infer(messages, onUpdate, maxTokens = 900) {
  let result = ""; const stream = await engine.chat.completions.create({ messages, stream: true, temperature: .2, top_p: .9, max_tokens: maxTokens });
  for await (const chunk of stream) { if (cancelRequested) { engine.interruptGenerate?.(); throw new Error("Cancelled"); } result += chunk.choices?.[0]?.delta?.content || ""; onUpdate?.(result); }
  return result;
}
async function summarizeLargeInput(text, progress) {
  const chunks = splitIntoChunks(text), notes = [];
  for (let i = 0; i < chunks.length; i++) {
    if (cancelRequested) throw new Error("Cancelled");
    const pct = Math.round((i / chunks.length) * 78); progress(`Reading section ${i + 1} of ${chunks.length}`, pct);
    const summary = await infer([{ role: "system", content: "You are a coding-input summarizer. Extract requirements, file paths, exact identifiers, errors, constraints, and important code behavior from this section. Preserve details and do not invent. Use compact bullets, max 130 words." }, { role: "user", content: chunks[i] }], null, 190);
    notes.push(`SECTION ${i + 1}: ${summary}`);
  }
  return notes.join("\n\n");
}
let requestCounterLocal = 0;
async function answerPrompt(prompt, context, progress, onText) {
  const full = context ? `${prompt}\n\nPROJECT CONTEXT:\n${context}` : prompt;
  const parts = splitIntoChunks(full);
  const system = "You are Stuffnest Code, a senior coding assistant. Answer the user's actual question first. Be practical and accurate. For code requests, return complete runnable code in fenced blocks. Give a brief approach summary, not private hidden reasoning. For large inputs, synthesize all requirements and mention uncertainty from summarization.";
  if (parts.length <= 1) return infer(fitConversation(system, [{ role: "user", content: full }]), onText, 1400);
  progress(`Preparing ${parts.length} input sections`, 2);
  const summary = await summarizeLargeInput(full, progress);
  if (cancelRequested) throw new Error("Cancelled");
  progress("Combining the summaries and drafting your answer", 86);
  const combined = `The user supplied a large input split into ${parts.length} sections. Use the notes to cover all relevant requirements. These are summaries, so do not claim details that are absent.\n\n${summary}\n\nUSER'S REQUEST:\n${prompt.slice(0, 2200)}`;
  return infer(fitConversation(system, [{ role: "user", content: combined }]), onText, 1600);
}
async function runChat() {
  if (busy) return; const prompt = $("#prompt").value.trim(); if (!prompt) return;
  if (!engine) { $("#chatStatus").textContent = "Load the on-device model first."; return; }
  $("#prompt").value = ""; busy = true; cancelRequested = false; const id = ++requestCounterLocal;
  $("#send").disabled = true; $("#thinkingText").textContent = "Reading request…";
  if (activeChat.title === "New conversation") activeChat.title = prompt.slice(0, 42);
  activeChat.messages.push({ role: "user", content: prompt }); addChatMessage("user", prompt); const output = addChatMessage("assistant", ""); saveAll(); renderChatList();
  const context = "";
  showLoading("Thinking through your request", "Visible status shows processing steps, not private chain-of-thought.", "Reading request…", 0);
  $("#workPlan")?.remove();
  const plan = document.createElement("div"); plan.id = "workPlan"; plan.textContent = "Approach: identify the goal → check relevant constraints → draft and verify the answer."; output.before(plan);
  try {
    const answer = await answerPrompt(prompt, context, (step, pct) => { if (id !== requestCounterLocal) return; updateLoading(step, pct); $("#thinkingText").textContent = step; $("#chatStatus").textContent = step; }, (text) => { if (id !== requestCounterLocal) return; renderRich(output, text); $("#messages").scrollTop = $("#messages").scrollHeight; updateLoading("Writing the response…", 95); $("#thinkingText").textContent = "Writing response…"; });
    if (id === requestCounterLocal) { activeChat.messages.push({ role: "assistant", content: answer }); saveAll(); $("#thinkingText").textContent = "Done · ready for your next prompt"; }
  } catch (e) { output.textContent = e.message === "Cancelled" ? "Generation stopped." : `Generation failed: ${e.message || e}. Try a smaller model or split the request into focused tasks.`; $("#thinkingText").textContent = "Ready when you are"; }
  finally { if (id === requestCounterLocal) { hideLoading(); busy = false; $("#send").disabled = false; $("#chatStatus").textContent = "Chats auto-save in this browser."; } }
}
$("#send").onclick = runChat; $("#prompt").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); runChat(); } });
$("#stop").onclick = () => { cancelRequested = true; engine?.interruptGenerate?.(); $("#loadingDetail").textContent = "Stop requested…"; };
$("#newChat").onclick = newChat; $("#clear").onclick = () => { if (activeChat) { activeChat.messages = []; activeChat.title = "New conversation"; saveAll(); renderChat(); } };

function updateContextHint() { $("#contextHint").textContent = currentView === "github" && selectedRemote ? `GitHub file: ${selectedRemote.path}` : activeFile ? `Workspace file: ${activeFile}` : "No file selected"; }
function updateGutter() { if (!$("#gutter")) return; const n = Math.max(1, $("#editor").value.split("\n").length); $("#gutter").textContent = Array.from({ length: n }, (_, i) => i + 1).join("\n"); $("#gutter").scrollTop = $("#editor").scrollTop; }
function saveEditor() { if (activeFile && $("#editor")) { files[activeFile] = $("#editor").value; persistFiles(); updateGutter(); updateContextPicker(); } }
function updateTabs() { const tabs = $("#editorTabs"); tabs.replaceChildren(); for (const name of Object.keys(files)) { const b = document.createElement("button"); b.className = `tab ${name === activeFile ? "active" : ""}`; b.textContent = name.split("/").pop(); b.title = name; b.onclick = () => openFile(name); tabs.append(b); } }
function renderFiles() { const list = $("#fileList"); list.replaceChildren(); for (const name of Object.keys(files).sort()) { const b = document.createElement("button"); b.className = `fileitem ${name === activeFile ? "active" : ""}`; b.textContent = `▤  ${name}`; b.onclick = () => openFile(name); list.append(b); } $("#editor").value = files[activeFile] || ""; updateGutter(); updateTabs(); updateContextHint(); updateContextPicker(); }
function openFile(name) { saveEditor(); activeFile = name; $("#editor").value = files[name] || ""; renderFiles(); }
$("#editor").addEventListener("input", saveEditor); $("#editor").addEventListener("scroll", () => { $("#gutter").scrollTop = $("#editor").scrollTop; });
$("#editor").addEventListener("keydown", (e) => { if (e.key === "Tab") { e.preventDefault(); const pos = e.target.selectionStart; e.target.setRangeText("  ", pos, e.target.selectionEnd, "end"); saveEditor(); } });
$("#addFile").onclick = () => { const name = prompt("New file name, e.g. src/app.js"); if (!name) return; activeFile = name.replace(/^\/+|\.\./g, ""); files[activeFile] = ""; persistFiles(); renderFiles(); $("#editor").focus(); };
$("#fileImport").onchange = async (e) => { for (const f of e.target.files) { files[f.name] = await f.text(); activeFile = f.name; } persistFiles(); renderFiles(); e.target.value = ""; };
function download(name, content, type = "text/plain") { const url = URL.createObjectURL(new Blob([content], { type })); const a = document.createElement("a"); a.href = url; a.download = name.split("/").pop(); a.click(); setTimeout(() => URL.revokeObjectURL(url), 1200); }
$("#downloadFile").onclick = () => { saveEditor(); download(activeFile || "code.txt", files[activeFile] || ""); };
$("#copyFile").onclick = () => { saveEditor(); copyText(files[activeFile] || "", "Current file copied."); };
$("#exportProject").onclick = () => { saveEditor(); download("stuffnest-workspace.json", JSON.stringify({ version: 1, files }, null, 2), "application/json"); };
$("#projectImport").onchange = async (e) => { try { const data = JSON.parse(await e.target.files[0].text()); if (!data.files || typeof data.files !== "object") throw new Error("Invalid workspace file"); files = data.files; activeFile = Object.keys(files)[0] || ""; persistFiles(); renderFiles(); setOutput("Workspace imported."); } catch (error) { alert(`Import failed: ${error.message}`); } e.target.value = ""; };
$("#clearOutput").onclick = () => setOutput("Output cleared.", "READY");
function makeWebPreview() {
  saveEditor(); const name = activeFile || "", content = files[name] || "", ext = name.split(".").pop().toLowerCase(); let html = "";
  if (["html", "htm"].includes(ext)) { html = content; const css = files["style.css"] || files["styles.css"] || "", js = files["script.js"] || files["main.js"] || ""; if (css && !/style\.css|styles\.css/.test(html)) html = html.includes("</head>") ? html.replace("</head>", `<style>${css}</style></head>`) : `<style>${css}</style>${html}`; if (js && !/script\.js|main\.js/.test(html)) { const safe = js.replace(/<\/script/gi, "<\\/script"); html = html.includes("</body>") ? html.replace("</body>", `<script>${safe}</script></body>`) : `${html}<script>${safe}</script>`; } }
  else if (ext === "css") html = `<!doctype html><html><head><style>body{font:16px system-ui;padding:20px}${content}</style></head><body><h2>${escapeHTML(name)}</h2><p>Preview sample</p><button>Sample button</button></body></html>`;
  else if (["js", "mjs"].includes(ext)) { const safe = content.replace(/<\/script/gi, "<\\/script"); html = `<!doctype html><html><body><h3>${escapeHTML(name)}</h3><pre id="log"></pre><script>const L=document.querySelector('#log');console.log=(...x)=>L.textContent+=x.join(' ')+'\\n';try{${safe}}catch(e){L.textContent+=e.stack}</script></body></html>`; }
  else return setOutput(`Cannot preview selected ${name}. Select an HTML, CSS, or JavaScript file.`, "UNSUPPORTED FILE");
  $("#preview").srcdoc = html; setOutput(`Ran selected file: ${name}. Preview is sandboxed.`, `PREVIEW · ${name}`);
}
$("#runWeb").onclick = makeWebPreview;
async function getPyodide() { if (!pyodidePromise) pyodidePromise = import("https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.mjs").then((m) => m.loadPyodide({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.27.7/full/" })); return pyodidePromise; }
$("#runPython").onclick = async () => { saveEditor(); if (!activeFile.endsWith(".py")) return setOutput(`Selected ${activeFile}; choose a .py file first.`, "WRONG FILE TYPE"); setOutput("Starting browser Python; first use downloads the runtime.", "LOADING PYTHON"); try { const py = await getPyodide(); let output = ""; for (const line of files[activeFile].split("\n")) { const m = line.match(/^\s*#\s*packages:\s*(.+)$/); if (m) await py.loadPackage(m[1].split(/[ ,]+/).filter(Boolean)); } py.setStdout({ batched: (s) => output += `${s}\n` }); py.setStderr({ batched: (s) => output += `${s}\n` }); await py.runPythonAsync(files[activeFile]); setOutput(output || "Python finished (no output).", "PYTHON FINISHED"); } catch (e) { setOutput(`Python error: ${e.message}`, "PYTHON FAILED"); } };
async function loadRuntimes() { try { const r = await fetch("https://emkc.org/api/v2/piston/runtimes"); if (r.ok) runtimeList = await r.json(); } catch {} } loadRuntimes();
const native = { java: ["java"], "c++": ["cpp"], rust: ["rs"], go: ["go"], javascript: ["js"], typescript: ["ts"], c: ["c"], csharp: ["cs"], php: ["php"], ruby: ["rb"] };
$("#runNative").onclick = async () => { saveEditor(); if (!activeFile) return setOutput("Select a source file first."); const lang = $("#nativeLang").value, ext = native[lang][0]; if (activeFile.split(".").pop().toLowerCase() !== ext) return setOutput(`Selected ${activeFile} is not ${lang} source (.${ext}). Select the correct file; the runner won't silently switch files.`, "WRONG FILE TYPE"); const version = runtimeList.find((r) => r.language === lang)?.version || "*"; setOutput(`Compiling selected file ${activeFile} with ${lang} ${version}…`, "RUNNING"); const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 60000); try { const r = await fetch("https://emkc.org/api/v2/piston/execute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ language: lang, version, files: [{ name: activeFile.split("/").pop(), content: files[activeFile] || "" }], stdin: $("#stdin").value }), signal: controller.signal }); clearTimeout(timer); const d = await r.json(); if (!r.ok) throw new Error(d.message || `HTTP ${r.status}`); const out = []; if (d.compile?.output) out.push(`[compile]\n${d.compile.output}`); if (d.run?.stdout) out.push(`[stdout]\n${d.run.stdout}`); if (d.run?.stderr) out.push(`[stderr]\n${d.run.stderr}`); if (d.run?.code != null) out.push(`Exit code: ${d.run.code}`); setOutput(out.join("\n") || "Finished with no output.", d.run?.code === 0 ? "SUCCESS" : "FINISHED"); } catch (e) { clearTimeout(timer); setOutput(`${e.name === "AbortError" ? "Timed out after 60s." : e.message} Remote runner sends source to Piston; do not run private code or secrets.`, "RUN FAILED"); } };

async function browseRepo(repo, branch, statusSelector, listSelector) {
  repo = repo.trim().replace(/^https?:\/\/github\.com\//, "").replace(/\/$/, ""); if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) { $(statusSelector).textContent = "Enter owner/repository."; return; }
  repoName = repo; repoBranch = branch.trim() || "main"; $(statusSelector).textContent = "Loading repository tree…"; $(listSelector).replaceChildren();
  try { const r = await fetch(`https://api.github.com/repos/${repo}/git/trees/${encodeURIComponent(repoBranch)}?recursive=1`, { headers: { Accept: "application/vnd.github+json" } }); if (!r.ok) throw new Error(r.status === 404 ? "Repository or branch not found; check branch name." : `GitHub HTTP ${r.status}`); const d = await r.json(), tree = (d.tree || []).filter((f) => f.type === "blob" && f.size < 500000).slice(0, 500); $(statusSelector).textContent = `${tree.length} files · select to inspect/import`; if (listSelector === "#repoFiles") $("#repoName").textContent = repo; for (const f of tree) { const b = document.createElement("button"); b.className = "fileitem"; b.textContent = `▤  ${f.path}`; b.onclick = () => selectRemote(f.path, statusSelector); $(listSelector).append(b); } }
  catch (e) { $(statusSelector).textContent = `Could not browse: ${e.message}`; }
}
async function selectRemote(path, statusSelector = "#repoStatus") { $(statusSelector).textContent = `Fetching ${path}…`; try { const r = await fetch(`https://raw.githubusercontent.com/${repoName}/${encodeURIComponent(repoBranch)}/${path.split("/").map(encodeURIComponent).join("/")}`); if (!r.ok) throw new Error(`HTTP ${r.status}`); selectedRemote = { path, content: await r.text() }; if (statusSelector === "#repoStatus") { $("#remoteFileName").textContent = path; $("#remotePreview").textContent = selectedRemote.content; $("#importRemote").disabled = false; } $(statusSelector).textContent = `Selected ${path}. Open in IDE or ask AI about it.`; updateContextHint(); }
  catch (e) { $(statusSelector).textContent = `Fetch failed: ${e.message}`; }
}
$("#browse").onclick = () => browseRepo($("#repoInput").value, $("#branchInput").value, "#repoStatus", "#repoFiles"); $("#repoInput").addEventListener("keydown", (e) => { if (e.key === "Enter") $("#browse").click(); });
$("#ideBrowse").onclick = () => browseRepo($("#ideRepoInput").value, $("#ideBranchInput").value, "#ideRepoStatus", "#ideRepoFiles");
function importSelectedRemote() { if (!selectedRemote) return; activeFile = selectedRemote.path; files[activeFile] = selectedRemote.content; persistFiles(); renderFiles(); changeView("ide"); setOutput(`Imported ${activeFile}. Edit, run, or download from the shared workspace.`, "FILE IMPORTED"); }
$("#importRemote").onclick = importSelectedRemote;
$("#ideRepoFiles").addEventListener("click", (e) => { const b = e.target.closest("button.fileitem"); if (!b) return; const path = b.textContent.replace(/^▤\s*/, ""); selectRemote(path, "#ideRepoStatus").then(() => { if (selectedRemote?.path === path) importSelectedRemote(); }); });

function getContext() {
  if (currentView === "github" && selectedRemote) return `File ${selectedRemote.path}:\n${selectedRemote.content}`;
  saveEditor(); return activeFile ? `File ${activeFile}:\n${files[activeFile] || ""}` : "No selected file.";
}
function showAssistantAnswer(text) {
  const blocks = [...text.matchAll(/```([\w+#.-]*)\s*\n([\s\S]*?)```/g)], explanation = text.replace(/```[\w+#.-]*\s*\n[\s\S]*?```/g, "").trim();
  $("#sideExplanation").textContent = explanation || (blocks.length ? "Generated code is ready. Review, copy, or apply it." : text || "No explanation returned.");
  if (blocks.length) { $("#generatedCode").textContent = blocks.map((p) => p[2].replace(/\n$/, "")).join("\n\n"); $("#codeLabel").textContent = `GENERATED CODE · ${blocks[0][1] || "code"}`; $("#codePanel").classList.remove("hide"); } else $("#codePanel").classList.add("hide");
}
async function askSidebar() {
  const question = $("#sidePrompt").value.trim(); if (!question) return; if (!engine) { $("#sideExplanation").textContent = "Load a model first."; return; }
  cancelRequested = false; $("#sideSend").disabled = true; $("#codePanel").classList.add("hide"); const context = getContext();
  showLoading("Reviewing your project", "Reading selected file and preparing a coding answer.", "Reading selected file…", 5);
  try { let compactContext = context; if (context.length > 4200) compactContext = `File context summaries:\n${await summarizeLargeInput(context, updateLoading)}`; const msg = `${question}\n\nContext:\n${compactContext}`; const answer = await infer(fitConversation("You are an expert coding assistant. Give a brief approach summary and explanation, then complete code in fenced blocks. Do not claim to save changes.", [{ role: "user", content: msg }]), showAssistantAnswer, 1300); showAssistantAnswer(answer); }
  catch (e) { $("#sideExplanation").textContent = `AI request failed: ${e.message || e}`; }
  finally { hideLoading(); $("#sideSend").disabled = false; }
}
$("#sideSend").onclick = askSidebar; $("#sidePrompt").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); askSidebar(); } });
$("#attachCurrent").onclick = () => { $("#contextHint").textContent = currentView === "github" && selectedRemote ? `GitHub file: ${selectedRemote.path}` : `Workspace file: ${activeFile}`; $("#sideExplanation").textContent = `Attached ${currentView === "github" && selectedRemote ? selectedRemote.path : activeFile}. Large files are summarized in chunks.`; };
$("#copyGenerated").onclick = () => copyText($("#generatedCode").textContent, "Generated code copied.");
$("#applyGenerated").onclick = () => { if (!$("#generatedCode").textContent) return; if (!activeFile) activeFile = "index.html"; files[activeFile] = $("#generatedCode").textContent; persistFiles(); renderFiles(); changeView("ide"); setOutput(`Generated code applied to ${activeFile}. Review before running.`, "CODE APPLIED"); };

let gameTimer = null, score = 0, seconds = 10, best = Number(localStorage.getItem("sn-code-best") || 0);
$("#target").onclick = () => { if (!gameTimer) return; score++; $("#gameScore").textContent = `Score: ${score}`; $("#target").style.transform = `translate(${Math.random() * 100 - 50}px,${Math.random() * 50 - 25}px)`; };
$("#startGame").onclick = () => { clearInterval(gameTimer); score = 0; seconds = 10; $("#target").disabled = false; $("#startGame").disabled = true; $("#gameScore").textContent = "Score: 0"; gameTimer = setInterval(() => { $("#gameTimer").textContent = `${--seconds} seconds · best: ${best}`; if (seconds <= 0) { clearInterval(gameTimer); gameTimer = null; $("#target").disabled = true; $("#startGame").disabled = false; if (score > best) { best = score; localStorage.setItem("sn-code-best", String(best)); } $("#gameScore").textContent = `Time! Score ${score} · best ${best}`; $("#target").style.transform = ""; } }, 1000); };

renderChatList(); renderChat(); renderFiles(); changeView("chat");
