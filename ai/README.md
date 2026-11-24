# Stuffnest Code

A static, GitHub Pages coding workspace with local WebGPU AI, chat, a shared IDE/GitHub workspace, and code runners.

## Run

Publish the repository root with GitHub Pages and visit `/ai/`. For local testing, serve the repository over HTTP:

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080/ai/`.

## Interactive features

- **Visible activity status:** Animated progress shows task phases and large-input chunk progress. This is a task/activity summary, not private chain-of-thought. The model is asked for a short approach summary in its answer.
- **Large inputs:** Long prompts and selected code context are split into chunks and summarized sequentially before the final answer. This takes longer and summaries can lose details; select relevant files when possible. There is no unlimited context: memory, browser GPU support, and model limits still apply.
- **Model selection:** Options are taken from the installed WebLLM compiled catalog where available; arbitrary model IDs cannot be loaded unless WebLLM has compiled artifacts for them. The initial download/compile can take several minutes.
- **IDE and GitHub:** VS Code-inspired activity bar, Explorer, tabs, line numbers, editor, preview/output, and GitHub public-file import all use the same local workspace. Imported files can be reviewed, edited, run, and downloaded.
- **StuffChat:** The Explorer provides a shortcut to StuffChat (`../stuffchat.html`) in a separate tab. StuffChat accounts/messages are not merged with local AI conversations; the sites remain separate for privacy and because StuffChat uses its own service.
- **Code execution:** HTML/CSS/JavaScript previews run in a sandboxed iframe. Python uses Pyodide in-browser. Java/C++, Rust, Go, Node.js, TypeScript, C, C#, PHP, and Ruby use the public Piston service; source is sent to that service. Never submit private code or secrets.
- **Persistence:** Chats and project files are saved in browser local storage. Export/download important work because browser data can be cleared.

The local model's quality and speed depend on device GPU, RAM, and model size. Chunk summarization is lossy; verify generated code and requirements.
