Continue this task in an isolated Git worktree so it cannot touch the main checkout or other Agent sessions.

1. Use Cursor’s built-in `/worktree` flow (or Agents Window → Worktree). Setup: `.cursor/worktrees.json`.
2. Do all edits, installs, and tests only inside that worktree.
3. Do not restart shared MCP ports unless they are down.
4. When done, summarize the branch/worktree path; merge back only via `/apply-worktree` or an explicit user ask.

Trailing text after this command is the task to run in isolation.
