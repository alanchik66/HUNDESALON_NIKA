Use Graphify for repository navigation and keep its local index current.

Available commands from the project root:

- `npm run graphify:check` — check whether the graph needs an update.
- `npm run graphify` — rebuild the local code graph without an LLM/API key.
- `graphify god-nodes --top 15` — find architectural hubs.
- `graphify query "<question>" --budget 1800` — traverse relevant neighbors.
- `graphify path "<node A>" "<node B>"` — find a dependency path.
- `graphify affected "<node>" --depth 2` — find reverse dependencies.
- `npm run graphify:diagnose` — inspect same-endpoint edge collapse risk.

Keep generated graph files local. Never add secrets or generated graph caches to a change.
