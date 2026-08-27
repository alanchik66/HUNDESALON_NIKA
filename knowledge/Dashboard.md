---
cssclass: dashboard-shell
---

# Dashboard

A compact control panel for daily work, decisions, and release flow.

> [!summary] Working profile
> Minimal theme · Style Settings · Obsidian Git backup to `origin/main`

## Quick launcher

```dataviewjs
const today = dv.date('today').toFormat('yyyy-MM-dd');
const cards = [
  { title: 'Today', link: `Daily/${today}`, meta: 'Open the current daily note', tone: 'blue' },
  { title: 'Vault docs', link: 'README', meta: 'Stack, conventions, and entry points', tone: 'neutral' },
  { title: 'Index', link: 'Index', meta: 'Map of the vault', tone: 'neutral' },
  { title: 'Start here', link: 'Start_Here', meta: 'Onboarding and flow', tone: 'neutral' },
  { title: 'Control center', link: '02_Areas/Codex_Control_Center', meta: 'One entry point for Codex work', tone: 'amber' },
  { title: 'Project hub', link: '01_Projects/HUNDESALON_NIKA', meta: 'Active project surface', tone: 'blue' },
  { title: 'Task queue', link: '01_Projects/HUNDESALON_NIKA/Tasks/README', meta: 'Auto-routed task notes', tone: 'green' },
  { title: 'Operations', link: '02_Areas/Operations', meta: 'Rules and workflows', tone: 'green' },
  { title: 'Brand assets', link: '03_Resources/Brand_Assets', meta: 'Approved public assets', tone: 'cyan' },
  { title: 'Decision log', link: '04_Decisions/Decisions', meta: 'Tradeoffs and outcomes', tone: 'amber' },
  { title: 'Code map', link: '05_Code_Map', meta: 'System notes', tone: 'purple' },
  { title: 'QA', link: '06_QA', meta: 'Verification log', tone: 'rose' },
  { title: 'Release', link: '07_Release', meta: 'Shipping notes', tone: 'orange' },
  { title: 'Inbox', link: '00_Inbox/Inbox', meta: 'Raw capture', tone: 'neutral' },
];

const grid = dv.el('div', '', { cls: 'dashboard-grid' });
for (const card of cards) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'dashboard-card dashboard-card--' + card.tone;
  btn.setAttribute('aria-label', card.title + ': ' + card.meta);
  btn.innerHTML = '<span class="dashboard-card__title">' + card.title + '</span><span class="dashboard-card__meta">' + card.meta + '</span>';
  btn.addEventListener('click', () => app.workspace.openLinkText(card.link, dv.current().file.path, false));
  grid.appendChild(btn);
}
```

## Open work

```dataview
TASK
FROM "00_Inbox" OR "01_Projects" OR "02_Areas" OR "04_Decisions" OR "06_QA" OR "07_Release"
WHERE !completed
SORT file.mtime DESC
LIMIT 12
```

## Recent changes

```dataview
LIST
FROM "00_Inbox" OR "01_Projects" OR "02_Areas" OR "03_Resources" OR "04_Decisions" OR "05_Code_Map" OR "06_QA" OR "07_Release"
SORT file.mtime DESC
LIMIT 10
```
