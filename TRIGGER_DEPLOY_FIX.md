# Trigger.dev Deployment Fix

## Issue: Docker Credential Error

You're getting this error:
```
error getting credentials - err: exec: "docker-credential-desktop": executable file not found in $PATH
```

This happens when Docker is looking for Docker Desktop credentials but can't find them.

## Solutions

### Solution 1: Fix Docker Config (Recommended)

Edit your Docker config file:

```bash
# Open Docker config
nano ~/.docker/config.json
```

Look for this section:
```json
{
  "credsStore": "desktop"
}
```

**Change it to:**
```json
{
  "credsStore": ""
}
```

Or completely remove the `"credsStore"` line.

Save and try deploying again:
```bash
npx trigger.dev@latest deploy
```

### Solution 2: Use Trigger.dev Without Docker

Trigger.dev v3 should work without Docker. If you're still having issues, try:

```bash
# Clear any cached builds
rm -rf .trigger
rm -rf node_modules/.trigger

# Deploy again
npx trigger.dev@latest deploy
```

### Solution 3: Install Docker Desktop

If you don't have Docker Desktop installed:

1. Download from: https://www.docker.com/products/docker-desktop/
2. Install and start Docker Desktop
3. Try deploying again

### Solution 4: Alternative - Deploy via GitHub Actions (Easier!)

Instead of deploying from your local machine, you can deploy from GitHub:

#### 4.1 Push to GitHub

```bash
git add .
git commit -m "Add trigger.dev scheduled reports"
git push
```

#### 4.2 Set Up GitHub Actions

Create `.github/workflows/trigger-deploy.yml`:

```yaml
name: Deploy Trigger.dev

on:
  push:
    branches:
      - main
      - master

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Deploy to Trigger.dev
        env:
          TRIGGER_SECRET_KEY: ${{ secrets.TRIGGER_SECRET_KEY }}
          CRUNCHYBRIDGE_DATABASE_URL: ${{ secrets.CRUNCHYBRIDGE_DATABASE_URL }}
          SUPABASE_DATABASE_URL: ${{ secrets.SUPABASE_DATABASE_URL }}
          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
          RESEND_FROM_EMAIL: ${{ secrets.RESEND_FROM_EMAIL }}
        run: npx trigger.dev@latest deploy
```

#### 4.3 Add Secrets to GitHub

Go to your GitHub repo → Settings → Secrets → Actions:

Add these secrets:
- `TRIGGER_SECRET_KEY` - Your production trigger key
- `CRUNCHYBRIDGE_DATABASE_URL` - Your database URL
- `SUPABASE_DATABASE_URL` - Your Supabase URL
- `RESEND_API_KEY` - Your Resend key
- `RESEND_FROM_EMAIL` - Your sender email

Then push to GitHub - it will auto-deploy!

### Solution 5: Manual Test Without Production Deploy

For now, you can test everything locally without deploying:

1. Keep your local `npx trigger.dev@latest dev` running
2. Test the task from the Trigger.dev dashboard
3. Configure the schedule in the database
4. Deploy to production later when you're ready

The scheduled reports will work in development mode for testing!

---

## Quick Fix Command

Try this one-liner:

```bash
# Remove Docker credential helper and deploy
echo '{}' > ~/.docker/config.json && npx trigger.dev@latest deploy
```

This creates a fresh Docker config without the problematic credential helper.

---

## If Nothing Works

Contact Trigger.dev support - they're very responsive:
- Discord: https://trigger.dev/discord
- Email: help@trigger.dev

Or continue using dev mode locally for now and deploy later!
