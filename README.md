# AI-powered Closed Feedback Loop System

Private Sunday Staples prototype for collecting structured design feedback from employees, friends, and selected customers.

## What This Version Does

- Provides an Admin area for preparing survey sessions.
- Supports a central shoe concept repository with image upload, labels, pricing, tags, and crop controls.
- Lets Admin users configure First Impressions, Purchase Intent, Occasion Fit, Price & Value, Founder Action, and Results.
- Provides a participant Preview flow optimised for quick mobile-style feedback.
- Stores test responses locally in the browser for pilot testing.
- Shows Results with standout shoe thumbnails, reasons, purchase intent, price confidence, occasion fit, and recommended founder actions.

## Local Use

Open `index.html` in a browser.

Optional local server:

```bash
npm start
```

Then open:

```text
http://127.0.0.1:4173
```

## GitHub / Vercel Deployment

This is a static app and can be uploaded directly to GitHub, then imported into Vercel.

Vercel settings:

- Framework preset: Other
- Build command: leave blank
- Output directory: `.`

## Notes

This pilot currently stores configuration and responses in browser storage. For multi-user employee testing with shared online responses, the next backend step is to connect persistent hosted storage.
