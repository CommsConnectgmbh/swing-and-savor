# swingandsavor.at — Marketing Apex

Static single-page landing for https://swingandsavor.at.
The App itself lives on https://app.swingandsavor.at/ (separate deploy from this repo's root).

## Deploy

Drag-drop or push to a Vercel project with this folder as root:

```bash
cd marketing
vercel deploy --prod
```

Or via Vercel UI: New Project → Import → Root Directory: `marketing/` → Framework: Other → Build: none → Output: `.`

Custom Domain: assign `swingandsavor.at` + `www.swingandsavor.at` to this project.
