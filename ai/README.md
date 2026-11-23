# Stuffnest Code

A static GitHub Pages coding workspace with local AI, persistent chats/files, a multi-file browser IDE, a public GitHub file importer, and a mini-game.

## Run and publish

No build step is needed. Publish the repository root with GitHub Pages and visit `/ai/`. For local testing, serve the repository over HTTP (module imports and browser AI do not generally work from `file://`):

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080/ai/`.

## Languages and tools

- **AI chat:** WebLLM with WebGPU; model download/compilation can take several minutes. The browser caches the model after download. A supported Chrome/Edge browser and capable GPU are recommended.
- **HTML/CSS/JavaScript:** Edit the workspace files and use Preview web. Rendering runs in a sandboxed iframe.
- **Python:** Runs in Pyodide in the browser. The runtime downloads on first use. Put `# packages: numpy` (or another Pyodide-supported package) in a Python file to request package loading.
- **Java, C++, Rust, Go, Node.js, TypeScript, C, C#, PHP, Ruby:** Run selected sends the current project source file to the public Piston service. Java expects `Main.java` and C++ expects `main.cpp` for best results. The app supplies stdin, uses the service's reported runtime version when available, and shows compile and execution output. Execution needs internet access and can be rate-limited or unavailable; never send secrets or private code.
- **GitHub:** Import individual files from public repositories by `owner/repository` and branch. No token is requested; the repository is not modified. Download edited files or export the workspace JSON, then upload changes through GitHub yourself.
- **Storage:** Chats, workspace files, and game score are stored in browser local storage. This is browser/profile-specific and can be cleared by browser settings; download/export important work.

The site source is static, but first-time model and Python runtime downloads and remote native-language execution rely on third-party services. The remote runner is not a local Java/C++ installation.
