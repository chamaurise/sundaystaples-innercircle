# Sunday Circle

Private Sunday Staples design-battle prototype for friends, employees, and top-tier customers.

## What This Version Does

- Shows invited users a private Sunday Circle review flow.
- Supports 15 shoe concepts.
- Lets the founder crop and label images.
- Lets the founder build bracket matchups and logic-tree routes.
- Supports customer group assignment by age range.
- Tracks rewards and feedback locally in the browser.

## Online Pilot Storage

This version includes a Vercel API route at `api/state.js`.

For shared employee testing, connect Vercel KV or Vercel Redis to the project so these environment variables are available:

- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`

Once connected, the Founder Dashboard syncs:

- responses
- reward approval status
- bracket logic trees
- group assignment rules
- image crop and asset settings
- comparison mode

If KV is not connected, the app falls back to browser storage and shows a setup warning in the Founder Dashboard.

## Local Use

Open `index.html` in a browser.

Pilot login:

- `maurice@sundaystaples.com`
- `vip@sundaystaples.com`
- `friend@sundaystaples.com`

## Vercel Static Deployment

This folder is ready to import into Vercel.

No build command is required.

Output directory:

`.` 

## Deployment Workflow

- GitHub is the source of truth.
- Vercel should be connected to the GitHub repository.
- Pushes to `main` redeploy the app.
- Use Vercel Preview deployments for testing larger dashboard changes before inviting customers.
