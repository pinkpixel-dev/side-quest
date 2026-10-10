# Side Quest

Side Quest is a small outdoor quest game. It gives you a tiny real-world mission, you go outside and take a photo of what you found, and Gemma decides whether you found it. If you did, a creature inspired by your photo hatches into your collection.

Gemma (Google's open-weight model) runs in your browser on your own GPU. Nothing about the quest, the judging, or the creature goes to an AI API.

Play it at [side-quest.pinkpixel.dev](https://side-quest.pinkpixel.dev).

I built this for the Hacktoberfest 2026 "Touch Grass" challenge. The joke I couldn't let go of: the AI gives you a reason to leave the AI.

## How a quest goes

1. Tell it roughly where and when you are: park, city, beach, the weather, the season, the time of day. You can also type a place like "London" if you want.
2. Gemma writes a quest for that, something like "find something outside that looks like it has a face."
3. Go find it and take a photo.
4. Gemma looks at the photo. If it matches, a creature hatches. If it doesn't, you get a short reason and can try again.

There are also scavenger hunts: a short list of things to find on one walk, checked all at once at the end.

## Two ways to play

### On a desktop or laptop

Open the site, click **Wake Gemma**, and play. The model is about 3.4 GB and downloads once, then stays cached in the browser. You'll want Wi-Fi for that first load.

Gemma needs WebGPU, so use a recent desktop Chrome or Edge. Solo play doesn't need an account, and your photos never leave the device.

### With your phone

Phones can't really run Gemma. My iPhone 12 kills the tab about 500 MB into the download. So the phone does the walking and your computer does the thinking:

1. On your computer, go to **Account** and sign in with GitHub. That computer becomes your home base.
2. Wake Gemma there and leave the tab open.
3. Scan the QR code on the home base screen with your phone's camera. Your phone is now signed in to the same account.
4. Go outside. Quests and photos go through the site to your computer, Gemma judges them there, and the creatures show up on your phone.

The phone keeps working without signal. Photos wait in a queue and send when you're back online. Your collection syncs to every device signed into the account.

Open the QR link in Safari on an iPhone, not a Home Screen shortcut. A Home Screen web app keeps its own cookies, so the sign-in from the camera won't carry over.

## Privacy

- **Solo:** photos stay in the browser's storage on that device.
- **Signed in:** photos go through the site to your computer and stay stored on the server (Cloudflare R2) until you delete your account. The account page has a delete button that removes the account, every stored photo, and every row tied to it.
- No location tracking. The place you type is just text for Gemma's prompt.
- GitHub sign-in only reads your public profile (name, username, avatar). The GitHub token isn't kept.

## Running it locally

You need a recent Node.js. I'm on 22, and `npm run home` runs the server's TypeScript directly with Node, so older versions may not handle that.

```bash
npm install
npm run dev
```

Open http://localhost:5173. That's enough for solo play.

### With accounts

The hosted API is a Cloudflare Worker. To run it locally you need a GitHub OAuth app with the callback `http://localhost:5173/api/auth/callback`. Then create `.dev.vars` in the repo root:

```ini
APP_ORIGIN=http://localhost:5173
GITHUB_CLIENT_ID=your-local-client-id
GITHUB_CLIENT_SECRET=your-local-client-secret
```

Set up the local database once, then run the API and the app side by side:

```bash
npm run db:migrate:local
npm run dev:api
npm run dev
```

Use `localhost:5173` rather than `127.0.0.1:5173`. The sign-in cookie is tied to the hostname, so mixing the two breaks the GitHub redirect.

### Without the hosted site

There's also a fully private option where nothing leaves your machine. `npm run home` builds the app, starts a small server on your computer, and opens a temporary cloudflared tunnel so your phone can reach it. It prints a QR code to pair the phone. Photos are kept in `~/.side-quest`. It needs `cloudflared` installed.

```bash
npm run home
```

## Tests

```bash
npm test
```

The Worker tests run the real Worker from `wrangler.jsonc` with local D1 and R2, so they need nothing set up beyond `npm install`.

## Deploying

The site runs on Cloudflare Workers with a D1 database and an R2 bucket. With `wrangler` logged in and the production secret set (`npx wrangler secret put GITHUB_CLIENT_SECRET`):

```bash
npm run db:migrate
npm run deploy
```

`db:migrate` applies any new files in `worker/migrations` to the production database.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

Apache 2.0. See [LICENSE](LICENSE).

Made with 💖 by [Pink Pixel](https://pinkpixel.dev)
