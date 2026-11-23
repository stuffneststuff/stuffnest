# Stuffnest Code

A static, GitHub Pages coding workspace with local AI, saved conversations, a multi-file IDE, an integrated code/explanation assistant sidebar, GitHub public-file import, and language runners.

## Run and publish

No build step is required. Publish the repository root with GitHub Pages and visit `/ai/`. For local testing, serve the repository over HTTP (module imports and WebGPU generally do not work from a `file://` URL):

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080/ai/`.

## Features

- **On-device AI:** WebLLM/WebGPU with first-load progress reporting and browser model caching. Chrome/Edge with a capable GPU is recommended. Model loading can take several minutes and requires available memory/storage.
- **AI sidebar on IDE and GitHub views:** Select a local or imported GitHub file, ask for a review, explanation, fix, or refactor. The explanation appears separately from generated code. Copy generated code or apply it to the current IDE file after review.
- **AI chat:** Conversations are saved in local storage. Code blocks have copy buttons.
- **Browser IDE:** Local multi-file editing, autosave, upload/download, project JSON export/import, and sandboxed HTML/CSS/JavaScript preview.
- **Python:** Runs in-browser with Pyodide; the first runtime download can take a while. A line such as `# packages: numpy` requests a Pyodide-supported package.
- **Java, C++, Rust, Go, Node.js, TypeScript, C, C#, PHP, Ruby:** The runner fetches available Piston runtime versions, sends source and optional stdin to the public Piston service, and shows compiler/runtime output and exit codes. Requests are limited to 60 seconds. This is remote execution, not a local compiler; do not send private code, credentials, or secrets. The service may be unavailable or rate-limited.
- **GitHub:** Import individual files from public repositories by `owner/repository` and branch. No token is requested; the app does not push changes. Download edits or export the workspace and upload manually.
- **Local persistence:** Chats, workspace files, and game score stay in browser storage for that browser/profile. Browser data can be cleared; export or download important work.

Third-party services are used for static module/runtime downloads, GitHub public API access, and remote code execution. Review generated code before running it.
