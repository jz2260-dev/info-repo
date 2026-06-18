# Stern IT Service Desk Starter

Open `index.html` to run the prototype. It is a browser-only website, so colleagues do not need Python.

## Edit The Data

Update `knowledge.csv` with your real records. The current starter is mapped to your Topics CSV columns:

- `Topic`
- `University Service`
- `Main Issues`
- `Resolution`
- `More Information`
- `Attachments / Images`
- `Related KBs`
- `Keywords`
- `Escalation`

## Customize The UI

- Colors, spacing, borders, and layout live in `style.css`.
- The page structure and button labels live in `index.html`.
- Search logic, CSV loading, output modes, and edit behavior live in `app.js`.
- `Best Fit` output selection is controlled by `recommendedOutputMode()` in `app.js`.
- Search relevance uses weighted matches plus synonym groups. In Google Sheet mode, synonym groups can be maintained in the `Search Synonyms` tab.

## Free Persistent Editing

Use `apps-script/SETUP_APPS_SCRIPT.md` to connect the site to Google Sheets through Apps Script.

- `config.js` controls whether the app uses CSV mode or Google Sheet mode.
- Leave `APPS_SCRIPT_URL` blank for local CSV mode.
- Paste your Apps Script `/exec` URL into `config.js` for Google Sheet mode.
- Apps Script writes changes to the `Knowledge` tab and audit rows to the `Audit Log` tab.
- Apps Script reads search aliases from the `Search Synonyms` tab. If that tab is missing or unavailable, the website falls back to the built-in aliases in `app.js`.

## Budget Hosting Options

- GitHub Pages or Cloudflare Pages for a low-cost static website.
- Google Sheets plus Apps Script if non-technical admins need to update records often.
- A small database and login layer later if the repository contains sensitive SOPs.
