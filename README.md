# Sunday Circle

Private Sunday Staples design-battle prototype for friends, employees, and top-tier customers.

## What This Version Does

- Shows invited users a private Sunday Circle review flow.
- Supports 15 shoe concepts.
- Lets the founder crop and label images.
- Lets the founder build bracket matchups and logic-tree routes.
- Supports customer group assignment by age range.
- Tracks rewards and feedback locally in the browser.

## Current Pilot Note

This prototype currently stores feedback in browser storage. That means it works well for local testing and demos, but an online employee pilot needs shared storage before responses from different people can appear together in one founder dashboard.

Recommended next production step:

- Deploy the frontend to Vercel.
- Add a shared database or Vercel KV/Redis storage for responses, brackets, image settings, and customer rules.
- Protect the founder dashboard before wider testing.

## Local Use

Open `index.html` in a browser.

Pilot login:

- `maurice@sundaystaples.com`
- `vip@sundaystaples.com`
- `friend@sundaystaples.com`

## Vercel Static Deployment

This folder is ready to import into Vercel as a static project.

No build command is required.

Output directory:

`.` 
