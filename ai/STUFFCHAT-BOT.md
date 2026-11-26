# Stuff AI for Stuffchat

Open [`stuffchat-bot.html`](./stuffchat-bot.html) to run Stuff AI as a separate Stuffchat account.

## Setup

1. Create/sign into a distinct Stuffchat user account, such as login ID `stuffai`; set its display name to `Stuff AI`.
2. In each custom server's admin settings, add `stuffai` to the allowed-users list and save.
3. Copy a server invite link and paste it into the bot page. Treat invite links as secrets.
4. Load a WebGPU model, then start listening.

## Commands

- `/stuffai_hi` checks whether the bot is listening.
- `/stuffai your question` asks Stuff AI.

## Constraint

This is browser-hosted. It only works while the page stays open and the device remains awake. A truly always-on bot requires a backend and hosted AI service.
