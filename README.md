# Mahigos

The collaboration workspace of the **UP Ibalon Alumni Association, Inc. (UPIAA)** — Office of the Secretary (OSEC).

Mahigos brings task/project management, team communication, document collaboration, whiteboards, and meetings into one branded workspace for running the organization's projects.

## Stack

- **React 19 + Vite + TypeScript**
- **Tailwind CSS v4**
- **Firebase** — Authentication, Cloud Firestore, Storage, Hosting
- **lucide-react** for UI icons

## Live

- Hosting: https://mahigos-collab.web.app
- Firebase project: `mahigos-collab`

## Roadmap

| Phase | Scope |
| --- | --- |
| 1 ✅ | Branded shell, loading screen, light/dark themes, auth, Kanban tasks |
| 2 | Task automation, deadlines & reminders, richer boards |
| 3 | Messaging — channels, threads, DMs, presence, async voice/video clips |
| 4 | Documents (co-editing, versions, comments), whiteboards with live cursors |
| 5 | Integrations (Zoom via OSEC account, Google Docs, calendar) + AI summaries |

## Local development

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build to dist/
firebase deploy    # deploy hosting + Firestore rules
```

## Design

Brand follows the UP Ibalon / UPIAA identity: primary red `#EF3422`, the 1974 hexagon
seal (six Bicol provinces + stylized Mayon), *Source Serif 4* wordmark, and subtle 2D
Bicol motifs (Mayon, butanding, sili, pili, banig weave). Light and dark themes.

---

© UP Ibalon Alumni Association, Inc. · Office of the Secretary
