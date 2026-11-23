# Stuffnest Code

A static, GitHub Pages-friendly local-first coding assistant with a browser IDE, saved conversations, GitHub public-file import, and a small break-time game.

## Features

- **On-device AI chat:** Uses WebLLM/WebGPU. The model downloads on first use and is cached by the browser. The first download and compilation can take several minutes; keep the tab open and monitor the progress indicator. Chrome or Edge with WebGPU is recommended. Model quality and speed depend on device memory and GPU.
- **Persistent chats:** Conversations and IDE files are stored in the browser's local storage. They are local to that browser/profile and are not synced. Download important files as a backup.
- **Browser IDE:** Edit files, import from your computer, download edits, copy text, and preview HTML/CSS/JavaScript in a sandboxed iframe using a Blob/srcdoc.
- **Python:** Runs in Pyodide in your browser. The Python runtime downloads on first use. Put a comment such as `# packages: numpy` in a Python file to request a Pyodide-supported package.
- **Java/C++:** Uses the public Piston execution service, so an internet connection is required and code is sent to that service. Do not send secrets or private code. It may be unavailable or rate-limited.
- **GitHub:** Browse public repositories by `owner/repository` and branch, then import selected files into the IDE. This is read-only. Edit locally and download the file to upload through GitHub yourself. No GitHub token is requested or stored.
- **Mini game:** A quick click-the-orb break game with a locally saved best score.

## Publish / run

The app is plain static HTML and needs no build step. GitHub Pages can serve it from the repository root; open `/ai/` once published. For local testing, serve the repository root over HTTP (module imports and WebGPU generally do not work from a `file://` URL):

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080/ai/`.

## Notes

The site source is static, but first-time model/runtime downloads and the Java/C++ runner rely on third-party CDNs/services. A downloaded model may use substantial bandwidth, storage, and GPU memory. Browser storage can be cleared by browser settings, so export work you need to keep.
