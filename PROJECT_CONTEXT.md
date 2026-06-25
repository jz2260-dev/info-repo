# Project Context

Use this file as the pinned project memory for future Codex sessions.

## Project

- App name: Stern IT Service Desk
- Purpose: Internal information repository for service desk records, solutions, SOPs, drafts, audit logs, archived records, and deleted record recovery.
- Local preview URL: http://127.0.0.1:8876/index.html
- Hosted site: https://jihny-dev.github.io/info-repo/

## Working Folders

- Codex working folder:
  `C:\Users\jz2260\Documents\Codex\2026-06-16\i-would-like-to-create-a\outputs\info-repo`
- GitHub Desktop folder:
  `C:\Users\jz2260\Documents\GitHub\info-repo`
- GitHub repository:
  `jihny-dev/info-repo`

Current workflow:

1. Continue editing in the Codex working folder.
2. At the end of the day, copy the project contents into the GitHub Desktop folder.
3. Do not replace or delete the GitHub folder's `.git` directory.
4. Review changes in GitHub Desktop.
5. Commit and push.

Important: the Codex working folder is the active source while building. The GitHub Desktop folder can be older until the end-of-day copy/sync is done. If the local preview looks stale, first confirm the preview server is serving the Codex working folder, not the GitHub folder or an older generated folder.

## Main Files

- `index.html`: Page structure.
- `style.css`: UI styling.
- `app.js`: Frontend app logic.
- `config.js`: Local Apps Script web app URL. The active copy is in the Codex working folder above.
- `apps-script/Code.gs`: Google Apps Script backend.
- `apps-script/SETUP_APPS_SCRIPT.md`: Setup/deployment notes.

## Data Model

Website code lives locally and in GitHub.

Operational data lives in Google Sheets:

- `Knowledge`: Published records.
- `Drafts`: Draft versions before publishing.
- `Deleted Records`: Deleted records that can be restored.
- `Record Views`: Hidden usage log for opened records.
- `Audit Log`: Change history.
- `Search Synonyms`: Search relevance keyword mapping.

Archived records remain in `Knowledge` with `Status = Archived`.
They are hidden from the default empty Matches list, but included and labeled when the user searches in the Inquiry field.
Deleted records move from `Knowledge` to `Deleted Records`.
The website Recovery view can restore both archived and deleted records.
Opened records are quietly logged to `Record Views`; this is not shown in the website UI.

## Apps Script Deployment

- Apps Script should be attached to the actual KB Google Sheet.
- The frontend reads the deployed web app URL from `config.js`.
- If only creating a new deployment version of the same web app, `config.js` usually does not need to change.
- If creating a brand new web app deployment URL, update `config.js`.
- After backend structure changes, run `setupSheets` once from Apps Script.
- If the website shows Google Sheet mode but `0 records`, the script may be deployed from the wrong or blank spreadsheet project.

## UI Decisions

- Brand/title: Stern IT Service Desk.
- Primary color: `#57068c`.
- Secondary color: `#330662`.
- Neutral background: `#f2f2f2`.
- Font target: NYU Perstare fallback stack.
- Import/export CSV controls are no longer needed for the hosted version.
- Record cards use a purple title band and white text body.
- Matches, Drafts, and Recovery use the left sidebar area.
- Recovery has its own view and does not show Matches.
- Search results can include archived records when the Inquiry field has text; archived hits show an `Archived` badge and can be restored.
- Record view tracking is hidden from the app UI and writes to the `Record Views` Sheet tab.
- Restore uses a two-click confirmation.
- Archive opens a required reason panel before confirming. Delete uses two-click confirmation.

## Backlog Notes

- Consider adding a review-only duplicate checker later. It should flag likely duplicate records by exact/similar title, matching service/escalation, overlapping issue or resolution text, and reused links/contact info. It should not merge or delete records automatically.

## Records And Drafts

- New records should start as drafts.
- Drafts can have multiple saved versions.
- Draft editing autosaves meaningful changes after a short pause. Manual Save Draft Version still creates an intentional version snapshot.
- Drafts can be deleted to reduce clutter.
- Publishing a draft saves it into `Knowledge` as a record.
- Editing an existing record saves back to Google Sheets when in Google Sheet mode.

## Images

- Preferred image storage: Google Drive folder with share settings that allow intended viewers to access images.
- The Sheet should store direct Drive links or supported attachment references in `Attachments / Images`.
- Images should display inline in the record when the link is usable by the website.

## Quick Start For Future Sessions

1. Read this file first.
2. Confirm the current working folder is the Codex working folder above.
3. Open or refresh `http://127.0.0.1:8876/index.html`.
4. If needed, inspect `app.js`, `style.css`, and `apps-script/Code.gs`.
5. Keep changes local until the user is ready to copy them to GitHub Desktop.
