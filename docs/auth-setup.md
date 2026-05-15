# Auth setup

## OAuth callback адреси

За локална разработка използвай:

- Google: `http://localhost:3000/api/auth/callback/google`
- Discord: `http://localhost:3000/api/auth/callback/discord`

За production замени домейна:

- Google: `https://<домейн>/api/auth/callback/google`
- Discord: `https://<домейн>/api/auth/callback/discord`

## Env променливи

Google OAuth се настройва в Google Cloud Console:

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

Discord OAuth се настройва в Discord Developer Portal:

```env
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
```
