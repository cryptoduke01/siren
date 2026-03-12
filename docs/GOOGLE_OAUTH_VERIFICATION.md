# Google OAuth App Verification Checklist

Use this checklist when fixing verification issues for the Google OAuth consent screen.

---

## 1. Domain Ownership

**Issue:** "The website of your home page URL is not registered to you"

**Fix:**
1. Go to [Google Search Console](https://search.google.com/search-console)
2. Add property for `https://onsiren.xyz` (and `https://www.onsiren.xyz` if you use www)
3. Verify ownership via **DNS record** (TXT) or **HTML file** upload
4. Follow Google’s verification instructions for your host (Vercel, etc.)

---

## 2. Home Page URL

**Issue:** "Home page is behind a login" / "Home page does not include privacy link" / "Home page does not explain app purpose"

**Fix:** In Google OAuth consent screen, set **Application home page** to:

```
https://onsiren.xyz/landing
```

(or `https://www.onsiren.xyz/landing` if you use www)

The `/landing` page is public and includes:
- App name: **Siren**
- App purpose
- Links to Privacy Policy and Terms of Service

**Alternative:** Use `https://onsiren.xyz/waitlist` if you prefer the waitlist page as your home page.

---

## 3. Privacy Policy Link

**Fix:** Set **Application privacy policy link** to:

```
https://onsiren.xyz/privacy
```

(or `https://www.onsiren.xyz/privacy`)

---

## 4. Terms of Service Link

**Fix:** Set **Application terms of service link** to:

```
https://onsiren.xyz/terms
```

---

## 5. Privacy Policy Format

**Issue:** "Privacy policy URL is improperly formatted"

**Fix:**
- Ensure `/privacy` returns 200 with HTML content
- Use `https://` (not `http://`)
- No redirects to a different domain
- Page must be readable in basic web format (the app’s privacy page is server-rendered HTML)

---

## 6. App Name Consistency

**Issue:** "App name does not match app name on your home page"

**Fix:** Use **Siren** in:
- OAuth consent screen
- Home/landing page heading
- Privacy policy and terms

---

## 7. www vs Non-www

Use the same variant everywhere. If you use `https://www.onsiren.xyz`, use it for:
- Home page URL
- Privacy policy URL
- Terms URL  
- Authorized JavaScript origins in the OAuth client

---

## Quick Reference

| Field              | Value                          |
|--------------------|--------------------------------|
| Home page          | https://onsiren.xyz/landing    |
| Privacy policy     | https://onsiren.xyz/privacy    |
| Terms of service   | https://onsiren.xyz/terms      |
| App name           | Siren                          |
