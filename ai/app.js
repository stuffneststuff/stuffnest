import * as webllm from "https://esm.run/@mlc-ai/web-llm";

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const starterFiles = () => ({
  "index.html": "<!doctype html>\n<html><head><meta charset=\"utf-8\"><title>Hello</title></head><body><h1>Hello, Stuffnest!</h1><p>Edit index.html and preview.</p></body></html>",
  "Main.java": "public class Main {\n  public static void main(String[] args) {\n    System.out.println(\"Hello from Java!\");\n  }\n}",
  "main.cpp": "#include <iostream>\nint main() {\n  std::cout << \"Hello from C++!\\n\";\n  return 0;\n}",
  "main.py": "print('Hello from Python')"
});
let engine = null, busy = false, chats = read("sn-code-chats", []), activeChat = null;
let files = read("sn-code-files", null) || starterFiles(), activeFile = "index.html";
let currentView = "chat", selectedRemote = null, runtimeList = [], assistantTurns = [];

function save() {
  try { localStorage.setItem("sn-code-chats", JSON.stringify(chats.slice(0, 40))); localStorage.setItem("sn-code-files", JSON.stringify(files)); }
  catch { if ($("#chatStatus")) $("#chatStatus").textContent = "Browser storage is full; download/export important work."; }
}
function escapeHTML(text) { const el = document.createElement("span"); el.textContent = text; return el.innerHTML; }
function addCodeBlock(parent, code, language = "code") {
  const box = document.createElement("div"); box.className = "codeblock";
  const head = document.createElement("div"); head.className = "codehead";
  const label = document.createElement("span"); label.textContent = language || "code";
  const copy = document.createElement("button"); copy.textContent = "Copy"; copy.onclick = () => copyText(code, "Code copied.");
  head.append(label, copy); const pre = document.createElement("pre"); pre.textContent = code;
  box.append(head, pre); parent.append(box);
}
function renderRich(parent, text) {
  parent.replaceChildren();
  const re = /```([\w+#.-]*)\s*\n([\s\S]*?)```/g; let cursor = 0, match;
  while ((match = re.exec(text))) {
    if (match.index > cursor) appendPlain(parent, text.slice(cursor, match.index));
    addCodeBlock(parent, match[2].replace(/\n$/, ""), match[1] || "code"); cursor = re.lastIndex;
  }
  if (cursor < text.length) appendPlain(parent, text.slice(cursor));
}
function appendPlain(parent, text) {
  const chunks = text.split(/(`[^`]+`)/g);
  for (const chunk of chunks) {
    if (/^`[^`]+`$/.test(chunk)) { const code = document.createElement("code"); code.className = "inlinecode"; code.textContent = chunk.slice(1, -1); parent.append(code); }
    else parent.append(document.createTextNode(chunk));
  }
}
async function copyText(text, message = "Copied.") {
  try { await navigator.clipboard.writeText(text); setOutput(message); }
  catch { setOutput("Clipboard access was blocked. Select the text and copy it manually."); }
}
function setOutput(message, status = "") { $("#output").textContent = message; if (status) $("#runnerStatus").textContent = status; }
function newChat() {
  activeChat = { id: crypto.randomUUID?.() || String(Date.now()), title: "New conversation", messages: [], updated: Date.now() };
  chats.unshift(activeChat); save(); renderChatList(); renderChat();
}
function renderChatList() {
  const list = $("#chatList"); list.replaceChildren();
  for (const chat of chats.slice(0, 12)) {
    const button = document.createElement("button"); button.textContent = chat.title || "New conversation";
    button.onclick = () => { activeChat = chat; renderChat(); }; list.append(button);
  }
}
function renderChat() {
  if (!activeChat) activeChat = chats[0] || null;
  if (!activeChat) { newChat(); return; }
  const box = $("#messages"); box.replaceChildren();
  if (!activeChat.messages.length) addChatMessage("assistant", "Hi! Load the local AI to chat, or use the IDE without AI. I can help explain, debug, refactor, generate code, and write tests.");
  else activeChat.messages.forEach((m) => addChatMessage(m.role, m.content));
}
function addChatMessage(role, content) {
  const row = document.createElement("div"); row.className = `msg ${role === "assistant" ? "ai" : ""}`;
  const avatar = document.createElement("div"); avatar.className = "avatar"; avatar.textContent = role === "assistant" ? "AI" : "YOU";
  const bubble = document.createElement("div"); bubble.className = "bubble";
  const who = document.createElement("div"); who.className = "who"; who.textContent = role === "assistant" ? "Stuffnest Code" : "You";
  const body = document.createElement("div"); body.className = "text"; renderRich(body, content);
  bubble.append(who, body); row.append(avatar, bubble); $("#messages").append(row); row.scrollIntoView({ block: "end" }); return body;
}
function changeView(name) {
  currentView = name;
  $$(".nav").forEach((b) => b.classList.toggle("active", b.dataset.view === name));
  $$(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${name}`));
  $("#title").textContent = ({ chat: "AI Chat", ide: "Browser IDE", github: "GitHub Repositories", game: "Break time" })[name];
  $("#subtitle").textContent = name === "chat" ? "Private by default · conversations saved on this device" : name === "ide" ? "Code editor · preview · language runner" : name === "github" ? "Public repository files · import, inspect, edit locally" : "Take a short focus break";
  $("#assistantSide").classList.toggle("hide", !["ide", "github"].includes(name));
  $("#clear").classList.toggle("hide", name !== "chat");
}
$$(".nav").forEach((b) => b.addEventListener("click", () => changeView(b.dataset.view)));
if (navigator.gpu) $("#gpu").textContent = "WebGPU available";
else { $("#gpu").textContent = "WebGPU unavailable"; $("#aiState").textContent = "WebGPU needed"; $("#aiDetail").textContent = "Try current Chrome or Edge"; $("#dot").className = "dot bad"; }

async function loadModel() {
  if (!navigator.gpu) { alert("WebGPU is unavailable. Try a current Chrome or Edge browser on a supported device."); return; }
  const button = $("#load"); button.disabled = true; $("#aiState").textContent = "Loading model…";
  $("#aiDetail").textContent = "The first download/compile can take several minutes. Keep this tab open; progress appears here."; $("#dot").className = "dot loading";
  try {
    engine = await webllm.CreateMLCEngine($("#model").value, { initProgressCallback: (p) => { $("#progress").style.width = `${Math.round((p.progress || 0) * 100)}%`; $("#aiDetail").textContent = p.text || "Downloading/compiling model…"; } });
    $("#aiState").textContent = "Ready"; $("#aiDetail").textContent = "Model ready · cached in browser"; $("#dot").className = "dot good"; $("#sideDot").className = "dot good";
  } catch (error) { $("#aiState").textContent = "Could not load"; $("#aiDetail").textContent = String(error.message || error).slice(0, 180); $("#dot").className = "dot bad"; }
  finally { button.disabled = false; }
}
async function streamAnswer(messages, onUpdate) {
  let result = "";
  const stream = await engine.chat.completions.create({ messages, stream: true, temperature: 0.2, top_p: 0.9, max_tokens: 1800 });
  for await (const chunk of stream) { result += chunk.choices?.[0]?.delta?.content || ""; onUpdate(result); }
  return result;
}
async function sendChat() {
  if (busy) return; const prompt = $("#prompt").value.trim(); if (!prompt) return;
  if (!engine) { $("#chatStatus").textContent = "Load the on-device model first."; return; }
  $("#prompt").value = ""; busy = true; $("#send").disabled = true;
  activeChat.messages.push({ role: "user", content: prompt });
  if (activeChat.title === "New conversation") activeChat.title = prompt.slice(0, 42);
  addChatMessage("user", prompt); const output = addChatMessage("assistant", "Thinking…"); save(); renderChatList();
  try {
    const answer = await streamAnswer([{ role: "system", content: "You are Stuffnest Code, a senior coding assistant. Be accurate and practical. Include runnable code in fenced blocks when requested. Explain important trade-offs. You cannot inspect files unless their content is provided in the chat." }, ...activeChat.messages.slice(-18)], (text) => { renderRich(output, text); $("#messages").scrollTop = $("#messages").scrollHeight; });
    activeChat.messages.push({ role: "assistant", content: answer }); save();
  } catch (error) { output.textContent = `Generation failed: ${error.message || error}. Try a shorter prompt or reload the model.`; }
  finally { busy = false; $("#send").disabled = false; $("#chatStatus").textContent = "Chats auto-save in this browser."; }
}
$("#load").onclick = loadModel; $("#send").onclick = sendChat;
$("#prompt").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } });
$("#stop").onclick = () => { engine?.interruptGenerate?.(); $("#chatStatus").textContent = "Stop requested."; };
$("#newChat").onclick = newChat;
$("#clear").onclick = () => { if (!activeChat) return; activeChat.messages = []; activeChat.title = "New conversation"; save(); renderChat(); };

function persistFiles() { try { localStorage.setItem("sn-code-files", JSON.stringify(files)); } catch { setOutput("Storage is full. Download/export your project to keep changes."); } }
function saveEditor() { if (activeFile) { files[activeFile] = $("#editor").value; persistFiles(); } }
function renderFiles() {
  const list = $("#fileList"); list.replaceChildren();
  for (const name of Object.keys(files).sort()) {
    const b = document.createElement("button"); b.className = `fileitem ${name === activeFile ? "active" : ""}`; b.textContent = name;
    b.onclick = () => { saveEditor(); activeFile = name; $("#editor").value = files[name]; renderFiles(); updateContextHint(); }; list.append(b);
  }
  $("#editor").value = files[activeFile] || ""; updateContextHint();
}
function updateContextHint() { $("#contextHint").textContent = currentView === "github" && selectedRemote ? `GitHub: ${selectedRemote.path}` : activeFile ? `Current file: ${activeFile}` : "No file selected"; }
$("#editor").addEventListener("input", saveEditor);
$("#editor").addEventListener("keydown", (e) => { if (e.key === "Tab") { e.preventDefault(); const pos = e.target.selectionStart; e.target.setRangeText("  ", pos, e.target.selectionEnd, "end"); saveEditor(); } });
$("#addFile").onclick = () => { const name = prompt("New filename, e.g. utils.js"); if (!name) return; activeFile = name.split(/[\\/]/).pop(); files[activeFile] = ""; persistFiles(); renderFiles(); };
$("#fileImport").onchange = async (e) => { for (const file of e.target.files) { files[file.name] = await file.text(); activeFile = file.name; } persistFiles(); renderFiles(); e.target.value = ""; };
function download(name, content, type = "text/plain") { const url = URL.createObjectURL(new Blob([content], { type })); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
$("#downloadFile").onclick = () => { saveEditor(); download(activeFile || "code.txt", files[activeFile] || ""); };
$("#copyFile").onclick = () => { saveEditor(); copyText(files[activeFile] || "", "Current file copied."); };
$("#exportProject").onclick = () => { saveEditor(); download("stuffnest-project.json", JSON.stringify({ version: 1, files }, null, 2), "application/json"); };
$("#projectImport").onchange = async (e) => { try { const data = JSON.parse(await e.target.files[0].text()); if (!data.files || typeof data.files !== "object") throw new Error("Not a workspace export"); files = data.files; activeFile = Object.keys(files)[0] || ""; persistFiles(); renderFiles(); setOutput("Workspace imported."); } catch (error) { alert(`Import failed: ${error.message}`); } e.target.value = ""; };
$("#clearOutput").onclick = () => setOutput("Output cleared.", "Runner ready");
$("#runWeb").onclick = () => {
  saveEditor(); let html = files["index.html"] || "<!doctype html><html><body></body></html>";
  const css = files["style.css"] || files["styles.css"] || "", js = files["script.js"] || files["main.js"] || "";
  if (css) html = html.includes("</head>") ? html.replace("</head>", `<style>${css}</style></head>`) : `<style>${css}</style>${html}`;
  if (js) { const safeJS = js.replace(/<\/script/gi, "<\\/script"); html = html.includes("</body>") ? html.replace("</body>", `<script>${safeJS}</script></body>`) : html + `<script>${safeJS}</script>`; }
  $("#preview").srcdoc = html; setOutput("Preview refreshed in a sandboxed iframe. Files named index.html, style.css, and script.js are combined automatically.", "Web preview");
};
let pyodidePromise = null;
async function getPyodide() {
  if (!pyodidePromise) pyodidePromise = import("https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.mjs").then((m) => m.loadPyodide({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.27.7/full/" }));
  return pyodidePromise;
}
$("#runPython").onclick = async () => {
  saveEditor(); const code = files[activeFile] || ""; $("#runnerStatus").textContent = "Loading Python"; setOutput("Starting browser Python. The first run downloads the runtime; keep the tab open.");
  try {
    const py = await getPyodide(); let output = "";
    for (const line of code.split("\n")) { const match = line.match(/^\s*#\s*packages:\s*(.+)$/); if (match) { const packages = match[1].split(/[ ,]+/).filter(Boolean); $("#runnerStatus").textContent = `Loading ${packages.join(", ")}`; await py.loadPackage(packages); } }
    py.setStdout({ batched: (s) => { output += `${s}\n`; } }); py.setStderr({ batched: (s) => { output += `${s}\n`; } });
    await py.runPythonAsync(code); setOutput(output || "Python finished (no output).", "Python finished");
  } catch (error) { setOutput(`Python error: ${error.message || error}`, "Python failed"); }
};
async function loadRuntimes() { try { const response = await fetch("https://emkc.org/api/v2/piston/runtimes"); if (response.ok) runtimeList = await response.json(); } catch { /* Runtime versions can fall back to wildcard. */ } }
loadRuntimes();
const nativeConfig = { java: ["java", "Main.java"], "c++": ["cpp", "main.cpp"], rust: ["rs", "main.rs"], go: ["go", "main.go"], javascript: ["js", "main.js"], typescript: ["ts", "main.ts"], c: ["c", "main.c"], csharp: ["cs", "main.cs"], php: ["php", "main.php"], ruby: ["rb", "main.rb"] };
$("#runNative").onclick = async () => {
  saveEditor(); const language = $("#nativeLang").value, [extension, suggested] = nativeConfig[language];
  const filename = Object.keys(files).find((n) => n.toLowerCase().endsWith(`.${extension}`)) || (activeFile?.toLowerCase().endsWith(`.${extension}`) ? activeFile : suggested);
  const source = files[filename] ?? files[activeFile] ?? ""; const runtime = runtimeList.find((r) => r.language === language); const version = runtime?.version || "*";
  $("#runnerStatus").textContent = `Running ${language}`; setOutput(`Compiling and running ${filename} using ${language} ${version}…`, "Running");
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch("https://emkc.org/api/v2/piston/execute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ language, version, files: [{ name: filename, content: source }], stdin: $("#stdin").value }), signal: controller.signal });
    clearTimeout(timeout); const data = await response.json(); if (!response.ok) throw new Error(data.message || `Runner returned HTTP ${response.status}`);
    const output = []; if (data.compile?.output) output.push(`[compile]\n${data.compile.output}`); if (data.run?.stdout) output.push(`[stdout]\n${data.run.stdout}`); if (data.run?.stderr) output.push(`[stderr]\n${data.run.stderr}`); if (data.compile?.code != null) output.push(`Compile exit code: ${data.compile.code}`); if (data.run?.code != null) output.push(`Exit code: ${data.run.code}`); if (data.run?.signal) output.push(`Signal: ${data.run.signal}`);
    setOutput(output.join("\n") || "Process finished with no output.", data.run?.code === 0 ? "Finished successfully" : "Finished");
  } catch (error) { clearTimeout(timeout); setOutput(`${error.name === "AbortError" ? "Runner timed out after 60 seconds." : `Runner error: ${error.message}`} Remote Java/C++ execution needs internet access and sends the source to Piston. Never run private code or secrets.`, "Runner failed"); }
};

let repoName = "", repoBranch = "main";
async function browseRepo() {
  const repo = $("#repoInput").value.trim().replace(/^https?:\/\/github\.com\//, "").replace(/\/$/, "");
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) { $("#repoStatus").textContent = "Enter a repository as owner/name."; return; }
  repoBranch = $("#branchInput").value.trim() || "main"; repoName = repo; $("#repoStatus").textContent = "Loading repository tree…"; $("#repoFiles").replaceChildren();
  try {
    const response = await fetch(`https://api.github.com/repos/${repo}/git/trees/${encodeURIComponent(repoBranch)}?recursive=1`, { headers: { Accept: "application/vnd.github+json" } });
    if (!response.ok) throw new Error(response.status === 404 ? "Repository or branch not found. Enter the correct branch name." : `GitHub API HTTP ${response.status}`);
    const data = await response.json(); const tree = (data.tree || []).filter((file) => file.type === "blob" && file.size < 500000).slice(0, 500);
    $("#repoName").textContent = repo; $("#repoStatus").textContent = `${tree.length} files listed · click one to inspect it`;
    for (const file of tree) { const button = document.createElement("button"); button.textContent = file.path; button.onclick = () => selectRemote(file.path); $("#repoFiles").append(button); }
  } catch (error) { $("#repoStatus").textContent = `Could not browse: ${error.message}`; }
}
async function selectRemote(path) {
  $("#repoStatus").textContent = `Fetching ${path}…`;
  try {
    const response = await fetch(`https://raw.githubusercontent.com/${repoName}/${encodeURIComponent(repoBranch)}/${path.split("/").map(encodeURIComponent).join("/")}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    selectedRemote = { path, content: await response.text() }; $("#remoteFileName").textContent = path; $("#remotePreview").textContent = selectedRemote.content; $("#importRemote").disabled = false;
    $("#repoStatus").textContent = "File loaded. Ask the AI about this file in the right-hand panel or import it into the IDE."; updateContextHint();
  } catch (error) { $("#repoStatus").textContent = `File fetch failed: ${error.message}`; }
}
$("#browse").onclick = browseRepo; $("#repoInput").addEventListener("keydown", (e) => { if (e.key === "Enter") browseRepo(); });
$("#importRemote").onclick = () => { if (!selectedRemote) return; activeFile = selectedRemote.path.split("/").pop(); files[activeFile] = selectedRemote.content; persistFiles(); renderFiles(); changeView("ide"); setOutput(`Imported ${selectedRemote.path}. Edit locally, then download the file to upload it yourself.`, "File imported"); };

function setAssistantAnswer(text) {
  const parts = [...text.matchAll(/```([\w+#.-]*)\s*\n([\s\S]*?)```/g)];
  let explanation = text.replace(/```[\w+#.-]*\s*\n[\s\S]*?```/g, "").trim();
  if (!explanation && !parts.length) explanation = text;
  $("#sideExplanation").textContent = explanation || (parts.length ? "Generated code is ready. Review it, then copy or apply it to the editor." : "No explanation returned.");
  if (parts.length) { $("#generatedCode").textContent = parts.map((p) => p[2].replace(/\n$/, "")).join("\n\n"); $("#codeLabel").textContent = `GENERATED CODE${parts[0][1] ? ` · ${parts[0][1]}` : ""}`; $("#codePanel").classList.remove("hide"); }
  else { $("#generatedCode").textContent = ""; $("#codePanel").classList.add("hide"); }
}
function getContext() {
  if (currentView === "github" && selectedRemote) return `Selected public GitHub file: ${selectedRemote.path}\n\n\`${selectedRemote.path}\` content:\n\n${selectedRemote.content.slice(0, 24000)}`;
  saveEditor(); return activeFile ? `Current local file: ${activeFile}\n\n\`${activeFile}\` content:\n\n${(files[activeFile] || "").slice(0, 24000)}` : "No file is selected.";
}
async function askSidebar() {
  const prompt = $("#sidePrompt").value.trim(); if (!prompt) return;
  if (!engine) { $("#sideExplanation").textContent = "Load the on-device model from the left sidebar first."; return; }
  const userContent = `${prompt}\n\nUse the attached code as context. If you propose a code change, put the complete replacement or patch in a fenced code block and keep your explanation outside the code block.\n\n${getContext()}`;
  $("#sideSend").disabled = true; $("#sideExplanation").textContent = "Thinking…"; $("#codePanel").classList.add("hide");
  try {
    const history = assistantTurns.slice(-8); const answer = await streamAnswer([{ role: "system", content: "You are an expert coding assistant inside an IDE. Carefully inspect the provided source. Explain findings and changes in plain language. For code, provide a complete replacement in a fenced code block. Never claim to edit files automatically." }, ...history, { role: "user", content: userContent }], setAssistantAnswer);
    assistantTurns.push({ role: "user", content: userContent }, { role: "assistant", content: answer }); assistantTurns = assistantTurns.slice(-12); setAssistantAnswer(answer);
  } catch (error) { $("#sideExplanation").textContent = `AI request failed: ${error.message || error}`; }
  finally { $("#sideSend").disabled = false; }
}
$("#sideSend").onclick = askSidebar; $("#sidePrompt").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); askSidebar(); } });
$("#attachCurrent").onclick = () => { updateContextHint(); $("#sideExplanation").textContent = currentView === "github" && selectedRemote ? `Attached ${selectedRemote.path} (${selectedRemote.content.length.toLocaleString()} characters) as context.` : `Attached ${activeFile || "no file"} as context.`; };
$("#copyGenerated").onclick = () => copyText($("#generatedCode").textContent, "Generated code copied.");
$("#applyGenerated").onclick = () => { const code = $("#generatedCode").textContent; if (!code) return; if (!activeFile) activeFile = "index.html"; files[activeFile] = code; persistFiles(); renderFiles(); changeView("ide"); setOutput(`AI-generated code applied to ${activeFile}. Review before running.`, "Code applied"); };

let gameTimer = null, score = 0, seconds = 10, best = Number(localStorage.getItem("sn-code-best") || 0);
$("#target").onclick = () => { if (!gameTimer) return; score++; $("#gameScore").textContent = `Score: ${score}`; $("#target").style.transform = `translate(${Math.random() * 100 - 50}px,${Math.random() * 50 - 25}px)`; };
$("#startGame").onclick = () => { clearInterval(gameTimer); score = 0; seconds = 10; $("#target").disabled = false; $("#startGame").disabled = true; $("#gameScore").textContent = "Score: 0"; gameTimer = setInterval(() => { seconds--; $("#gameTimer").textContent = `${seconds} seconds · best: ${best}`; if (seconds <= 0) { clearInterval(gameTimer); gameTimer = null; $("#target").disabled = true; $("#startGame").disabled = false; if (score > best) { best = score; localStorage.setItem("sn-code-best", String(best)); } $("#gameScore").textContent = `Time! Score ${score} · best ${best}`; $("#target").style.transform = ""; } }, 1000); };

renderChatList(); renderChat(); renderFiles(); changeView("chat");
