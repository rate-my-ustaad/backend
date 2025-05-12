# Censorship

🔍 View Project
Visit: https://censorship.ratemyustaaddev.workers.dev
Dash: https://dash.cloudflare.com/?to=/:account/workers/services/view/censorship

💻 Continue Developing
Change directories: cd censorship
Start dev server: npm run start
Deploy again: npm run deploy

While in your project directory, test Workers AI locally by running wrangler dev:

```
npx wrangler dev
```

## Testing

To run the tests for Firebase JWT validation:

1. Install dependencies (if not already):
   ```sh
   npm install
   ```
2. Start the worker in one terminal:
   ```sh
   npm run dev
   ```
3. In `test/index.spec.js`, set `VALID_TOKEN` to a real Firebase JWT for your project (see comments in the file).
4. In another terminal, run:
   ```sh
   npx vitest run
   ```

- The tests will check:
  - Rejection with missing token
  - Rejection with invalid token
  - Acceptance with a valid Firebase JWT

You can obtain a Firebase JWT by authenticating with Firebase in your app and copying the token.
