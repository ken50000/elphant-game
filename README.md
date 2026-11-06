# The Elephant in the Room: put it online with Vercel

Players need no account and no email. They just open your link.
Only you (the facilitator) need a free GitHub and Vercel account, one time.

## Set up (about 10 minutes)

1. **GitHub.** Sign in at github.com. Click **+ > New repository**, name it `elephant-game`, keep it Private, click Create.
2. On the new repository page click **uploading an existing file**. Drag in everything from this folder (the `api`, `lib` and `public` folders, plus `package.json` and `vercel.json`). Click **Commit changes**.
3. **Vercel.** Go to vercel.com, choose **Sign up with GitHub**. Click **Add New > Project**, pick `elephant-game`, click **Deploy**. Leave all settings alone.
4. **Storage (this is what lets everyone's answers reach each other).** In your Vercel project open the **Storage** tab, choose **Create Database**, pick **Upstash for Redis**, choose the free plan, and connect it to the project. Vercel fills in the settings for you.
5. **Passcode.** Open **Settings > Environment Variables**. Add a variable named `FACILITATOR_PASSCODE` with a passcode only you know. Save.
6. **Redeploy.** Open **Deployments**, click the three dots on the latest one, choose **Redeploy**.

## Using it

- **Players:** share your site address (for example `elephant-game.vercel.app`) or the QR code on the facilitator screen.
- **You:** open `your-address/#host`, type the passcode.
- **Before the event:** do a quick test with your own phone, then press More tools > Reset game.
- Without step 4 the game will seem to work but forget things. Don't skip it.
