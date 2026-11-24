# Stuffnest Code

A static, GitHub Pages coding workspace with a local WebGPU model, chat, shared IDE/GitHub workspace, and code runners.

## Run

Publish the repository root with GitHub Pages and visit `/ai/`. For local testing, serve the repository over HTTP:

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080/ai/`.

## What changed

- Larger prompts and selected source files are split into chunks and summarized sequentially before the final answer. This makes large inputs possible on models with smaller context windows, but takes longer and summaries can omit details. Very large projects are best handled by selecting relevant files instead of sending the whole repository.
- An animated progress overlay shows loading, current chunk, and generation stages; Stop requests cancellation.
- Model choices are populated from WebLLM's compiled model catalog, filtered to coder/Qwen models where available. Hardware and WebLLM catalog determine what can actually load; a browser cannot run arbitrary model IDs without a compatible compiled artifact.
- VS Code-inspired layout: activity bar, Explorer, file tabs, line-number gutter, editor, preview/output panes, and integrated GitHub repository import in the Explorer. GitHub files import into the same workspace and can be edited, run, and downloaded.
- HTML/CSS/JavaScript previews run in a sandboxed iframe. Python runs in-browser using Pyodide. Java/C++, Rust, Go, Node.js, TypeScript, C, C#, PHP, and Ruby execute through the remote Piston service. Native code is sent to that service; do not send private code or secrets.
- Chats and files persist in local browser storage. Export/download important work because clearing browser data deletes it.

Local inference remains bounded by device memory, GPU, and the model's context window. Chunk summaries are lossy; verify code and requirements before relying on results.
