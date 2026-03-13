# X (Twitter) API — Token CT Mentions

Siren can fetch recent tweets that mention a token's contract address (CA) when you open a token in the Terminal. This helps users see CT buzz around a token before trading.

## Setup

### 1. Create an X Developer Account

1. Go to [developer.x.com](https://developer.x.com)
2. Sign in with your X account
3. Create a **Project** and **App** (if you don't have one)

### 2. Subscribe to Basic Tier

- The **Recent Search** endpoint (`GET /2/tweets/search/recent`) requires **Basic** tier ($100/month)
- Free tier does not include search; you'll get 401/403 if you try

### 3. Generate Bearer Token

1. In your app → **Keys and tokens**
2. Generate **Bearer Token** (OAuth 2.0 App-Only)
3. Copy the token

### 4. Add to Environment

**API (Render):**

```env
TWITTER_BEARER_TOKEN=your_bearer_token_here
```

**Local (`apps/api/.env`):**

```env
TWITTER_BEARER_TOKEN=your_bearer_token_here
```

## How It Works

- **Endpoint:** `GET /api/token-tweets?mint=<CA>`
- **Backend:** Calls X API v2 `https://api.twitter.com/2/tweets/search/recent` with query `"<CA>"` (exact phrase)
- **UI:** In the Unified Buy Panel, when viewing a token, expand **"CT mentions (X)"** to load tweets
- **Rate limits:** X Basic tier has its own limits; the API returns the last 7 days, max 10 tweets per request

## Without TWITTER_BEARER_TOKEN

If the env var is not set, the API returns 503 and the UI shows:

> Set TWITTER_BEARER_TOKEN in API to see tweets.

The rest of the app works normally; tweets are optional.

## Optional: CT Velocity for Token Surfacing

The docs mention using X for "mention velocity" (e.g. "$JPOW" + "fed meeting") to score/surface tokens. That would require additional API usage and logic. The current implementation only shows tweets when a user explicitly opens a token.
