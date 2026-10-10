# Changelog

## Unreleased

### 👤 Accounts
- Sign in with GitHub on the hosted site. The computer you sign in on becomes your home base and runs Gemma for your phone.
- Sign your phone in by scanning a one-time QR code on the home base screen. Codes last 2 minutes and refresh on their own.
- New Account page to switch a device between home base and phone, sign out, or delete your account.
- Deleting your account removes every stored photo and every saved row, and signs out all your devices.

### 📡 Hosted home base
- Phones can play through the site now, without running `npm run home`. Finds, scavenger hunts, and pre-written quests go through a Cloudflare Worker, with photos stored in R2.
- The home base checks in less often when there's nothing to do (every 20 seconds instead of every 4).
- `npm run home` still works as the fully private option.

### 🗂️ Collection
- Your creature collection syncs to every device signed into your account, photos included. Creatures from before you signed in get uploaded too.

### 🎨 Interface
- The whole home page fits on one screen on desktop. The specimen sheet is now a wide 4 x 2 page with one featured creature and four small ones, and "How it goes" sits right under the hero.
- The About page now explains where photos go when you're signed in.

### 🐛 Fixes
- If the GPU drops out while Gemma is working ("device lost"), Gemma now shows Retry instead of staying "ready" and failing every photo until you reload.
