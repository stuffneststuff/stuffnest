# Stuff AI for Stuffchat

Open [`stuffchat-bot.html`](./stuffchat-bot.html) to run Stuff AI as a separate Stuffchat account. It supports `/stuffai_hi` and `/stuffai your question` in custom servers.

## Setup

1. Create/sign into a distinct Stuffchat user account, such as login ID `stuffai`; set its display name to `Stuff AI`.
2. In each custom server's admin settings, add `stuffai` to the allowed-users list and save.
3. Copy a server invite link and paste it into the bot page. Invite links contain the room decryption key; treat them as secrets.
4. Load a WebGPU-compatible model, then start listening.

## Important constraints

This browser-hosted bot only listens while the page is open, the device stays awake, and the model is loaded. It is not an always-on server. It reads messages in the invited custom rooms, decrypts them in the browser, and generates replies locally; replies are encrypted before posting. The main Stuffchat script and `sc/` directory are not modified. Do not configure rooms where the bot should not read messages.

The bot uses Stuffchat's current main Apps Script endpoint. It is separate from the user's account, but messages are posted with the configured bot login ID. Only run one listener tab/device for that account to avoid duplicate replies.
