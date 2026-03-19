# FocusBoard

A project to gamify the whole personal improvement tracking stuff.

Track courses, projects, goals, and focus sessions in one place.
Includes a local, privacy-first AI coach powered by Ollama (no external APIs).

Built with React, Vite, Electron, and Zustand.

## Running it

Install deps and start the app:

```bash
npm install
npm run dev
```

For a production build:

```bash
npm run build
```

## Requirements

- Node.js + npm
- Ollama installed and running locally

## Ollama setup (AI Coach)

You need a model downloaded so the local coach can respond.

```bash
ollama run mistral
```

If you use a different model name, update it in the AI view config.
