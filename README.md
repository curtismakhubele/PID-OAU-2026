# PID Facilities Management System — Deployment Guide

This is a static frontend (`index.html`) plus a real backend API (`api/` — an Azure Functions
app) that together make this a genuine multi-user system, not just a browser demo.
**Azure Static Web Apps** is the recommended way to host both — free, and it deploys the
frontend and the linked backend together automatically from one GitHub push.

The `server.js` / `package.json` (root) / `web.config` files are unrelated to this — they're
only for the alternate **Azure Web App** hosting path (see near the bottom) — ignore them for
the Static Web Apps path below. The backend itself lives in the separate `api/` folder.

## Before you deploy — read this

- **Data storage, now with three tiers, automatically:** the app tries a real backend first
  (`api/`, included in this package); if that's not deployed or you're not signed in yet, it
  falls back to this browser's `localStorage` so the app still works standalone. Settings shows
  exactly which mode is active at any time. Only the backend tier is genuinely shared across
  devices and team members — see **Step 4** below to turn that on.
- **WhatsApp and Microsoft 365 (Graph email/SharePoint) features** need one extra Azure AD
  permission grant beyond basic sign-in — described inside the app's own Settings page. Don't
  put real credentials into this static site's code — secrets in client-side JavaScript are
  visible to anyone who views the page source; the backend exists precisely so secrets like the
  storage connection string never have to live in the frontend.

## Step 1 — Push to GitHub

1. Go to [github.com/new](https://github.com/new) and create a new repository (e.g. `pid-facilities`).
   Keep it **Public** or **Private** — either works with Azure Static Web Apps' free tier.
2. On your computer, in this folder (make sure the `api/` folder is included):
   ```bash
   git init
   git add .
   git commit -m "Initial commit — PID Facilities Management System"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/pid-facilities.git
   git push -u origin main
   ```
   (Replace `YOUR-USERNAME` and the repo name with your own.)

   No need to leave anything out — extra files like `server.js` just sit unused in the repo
   and don't affect a Static Web Apps deployment.

## Step 2 — Create the Azure Static Web App

1. Go to the [Azure Portal](https://portal.azure.com) and search for **Static Web Apps** → **Create**.
2. Fill in:
   - **Subscription / Resource group**: your own
   - **Name**: e.g. `pid-facilities`
   - **Plan type**: **Free**
   - **Region**: closest to you (e.g. South Africa North, if available — otherwise West Europe)
   - **Deployment source**: **GitHub**
3. Sign in to GitHub when prompted and select:
   - **Organization**: your account
   - **Repository**: the repo you just created
   - **Branch**: `main`
4. Under **Build Details**:
   - **Build presets**: Custom
   - **App location**: `/`
   - **Api location**: `api`
   - **Output location**: *(leave blank)*
5. Click **Review + Create**, then **Create**.

Azure will commit its **own** GitHub Actions workflow file into your repo automatically at this
step (something like `.github/workflows/azure-static-web-apps-<random-name>.yml`) — it will
already include the right `api_location` since you set it in step 4 above, and will wire up the
`AZURE_STATIC_WEB_APPS_API_TOKEN` secret for you. This repo also ships with a pre-written
`azure-static-web-apps.yml` as a backup/reference (already configured with `api_location: "api"`
too); having both is harmless (worst case, two deployments run instead of one), but if you'd
rather keep it tidy, delete the one this package included once Azure has added its own.

Within a few minutes your app will build and deploy.

## Step 3 — Find your live URL

In the Azure Portal, open your Static Web App resource — the URL is shown at the top
(something like `https://calm-sand-0a1b2c3.azurestaticapps.net`). Every future push to `main`
will auto-redeploy — just commit and push changes to `index.html` like normal.

## Optional — custom domain

In the Static Web App resource, go to **Custom domains** → **Add**, and follow the DNS instructions
Azure gives you (a CNAME or TXT record with your domain registrar).

## Step 4 — Connect the real backend (data shared across your whole team)

The `api/` folder is a real Azure Functions backend, already deployed automatically as part of
Step 2 (Static Web Apps builds and links it for you — no separate resource to create). Two things
still need doing before it actually stores anything:

1. **Give the backend access to storage.** In the Azure Portal, open your **Static Web App**
   resource → **Settings → Environment variables** (sometimes labelled **Configuration**) → add:
   - Name: `AZURE_STORAGE_CONNECTION_STRING`
   - Value: your storage account's connection string (Storage Account → **Access keys** → `key1`
     → **Show** → copy the **Connection string** field — the same place used earlier in this
     project for other features)

   Save, and give it a minute or two to restart.

2. **Turn on Microsoft sign-in.** The backend requires a signed-in user for every request (so
   your facilities data isn't world-writable). Static Web Apps has a **built-in** Microsoft
   provider that needs zero setup for basic sign-in — try visiting `https://<your-app>.azurestaticapps.net/.auth/login/aad`
   directly; if that takes you through a Microsoft login, it's already working and you can skip
   ahead. If you specifically need Microsoft Graph features (Mail.Send, SharePoint) rather than
   just sign-in, those still need the custom Azure AD app registration described in the app's own
   Settings page — that part is unchanged from before.

Once both are done, open **Settings** inside the app itself — the "Data storage" panel will say
**"Connected — saving to the shared backend"** once you're signed in. From then on, every
signed-in team member sees the same live data, on any device.

**If it still says "saved to this browser only":** check the Function App's logs (Static Web App
resource → **Functions** → click a function → **Monitor**) for the actual error — almost always
either the connection string is missing/wrong, or sign-in isn't enabled yet.

## Optional — Microsoft sign-in for Graph features

Basic Microsoft sign-in (needed for the backend above) works out of the box on Static Web Apps.
For the extra Microsoft Graph permissions (sending real email, SharePoint file access), that's
a custom Azure AD app registration — same idea as the Web App version described in the app's
Settings page, with Static Web Apps' own slightly different Portal navigation for where the
client ID/secret get entered. Ask and I'll walk through that specific path when you're ready.

## Alternative — Azure Web App (only if you want server-side code later)

This folder also includes everything needed for **Azure Web App** hosting instead — a tested,
working `server.js` (Express), `package.json`, `package-lock.json`, and `web.config`. This path
makes sense only if you plan to add real server-side logic later (e.g. holding API secrets safely,
a database connection). For a static app like this one, it's more moving parts than you need — the
Static Web Apps path above is simpler and does the same job for this app as it stands today.

## What's real now vs. still ahead

Done, as of this package:
1. ✅ **A backend API** (`api/`, Azure Functions) handling reads/writes for real, instead of only localStorage.
2. ✅ **Shared storage** — Azure Blob Storage under your existing storage account, one dataset the whole team sees.
3. ✅ **Authentication** gating the backend — Static Web Apps' built-in Microsoft sign-in.

Still ahead, if you want to go further:
4. **Finer-grained permissions** — right now, any signed-in user can read/write everything. Role-based
   write restrictions (e.g. only Admins can delete Users) would need checks added inside `api/src/functions/storage.js`.
5. **Azure AD app registration** for real Microsoft Graph access (Mail.Send, SharePoint) — separate
   from the basic sign-in above, described in the app's Settings page.
6. **WhatsApp Business API** account for real automatic WhatsApp messaging — the click-to-chat
   links already work today; automatic sending needs that Meta-side account plus a small addition
   to the `api/` backend to hold its token, mirroring how storage.js already holds the storage
   connection string server-side.

Happy to build any of these next, piece by piece.
