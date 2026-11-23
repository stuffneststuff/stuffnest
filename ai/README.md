# Stuffnest Code

A static, GitHub Pages coding workspace with a local AI, saved conversations, multi-file IDE, AI coding sidebar, GitHub public-file import, and language runners.

## Run and publish

No build step is required. Publish the repository root with GitHub Pages and visit `/ai/`. For local testing, serve the repository over HTTP:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080/ai/`.

## Features and limitations

- **On-device AI:** WebLLM/WebGPU. The initial download and compilation may take several minutes. Chrome/Edge with a capable GPU is recommended. Prompts are fitted to the model's context window and recent history is trimmed so medium prompts are less likely to overflow; smaller models still have limited reasoning and context.
- **Scrolling:** Chat messages live in a dedicated scroll container; the composer stays fixed at the bottom.
- **AI sidebar:** On IDE and GitHub views, the selected editor file or inspected repository file is supplied as context. Explanations and generated code are separated; code blocks have copy actions and generated code can be applied to the selected editor file.
- **IDE:** Browser HTML/CSS/JavaScript previews execute the selected file in a sandboxed iframe. Python runs in-browser using Pyodide. Java/C++, Rust, Go, Node.js, TypeScript, C, C#, PHP, and Ruby are sent to Piston's remote runner; the runner now executes the selected source file and checks that its extension matches the selected language. Remote code execution is not local; do not send private code or secrets.
- **GitHub:** Import individual public files by `owner/repository` and branch. No token is requested and the app never pushes repository changes.
- **Persistence:** Chats and project files live in this browser's local storage. Export/download anything important.

A small local model cannot match a hosted coding model in reasoning, and device GPU/RAM impose hard limits. If prompts still fail, try the 3B model (if the device supports it), shorten pasted files, or split the request into steps.
