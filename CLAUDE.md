# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chrome Manifest V3 extension for auto-filling login forms. Vanilla JS, no build tools or package manager. All code is plain JavaScript loaded directly by the browser.

## Development Workflow

No build step. To test changes:
1. Open `chrome://extensions` with Developer Mode enabled
2. "Load unpacked" pointing to this directory (or click the refresh icon to reload)
3. Open the side panel via the extension icon to interact with the UI

## Architecture

**Message-passing hub pattern**: Background service worker is the central data authority. UI layers (sidepanel/popup) and content script communicate with it exclusively via `chrome.runtime.sendMessage`.

### Component Relationships

```
sidepanel/popup  ──sendMessage──►  background.js  ◄──sendMessage──  content.js
     (UI)            (actions)      (storage +        (actions)      (form fill)
                                    encryption)
```

### Message Actions

Background handles: `getSites`, `saveSite`, `updateSite`, `deleteSite`, `getDecryptedCredentials`, `exportSites`, `importSites`

Content script handles: `checkPage`, `manualFill`

### Encryption

Credentials are AES-GCM encrypted in storage. The crypto key is derived via PBKDF2 from a device fingerprint and stored as `cryptoKey` in `chrome.storage.local`. Both `background/background.js` and `content/content.js` implement their own `BackgroundCrypto`/inline crypto class with identical logic.

### Popup vs Side Panel

Both `popup/` and `sidepanel/` implement the same manager pattern with near-identical logic. Side panel has additional features: search filtering, pagination (10 items/page), and link-open buttons. Popup auto-closes after manual fill; side panel stays open.

### Content Script

Injected on all URLs at `document_idle`. Handles auto-fill by detecting login forms via `utils/siteDetector.js` (input name/id patterns, type="password", common CSS selectors). Dispatches multiple input events (input, change, keyup, native setter override) for React/Angular compatibility. Watches for SPA URL changes via `popstate` and periodic polling.

### Site Data Model

```js
{
  id, name, urlPattern, loginUrl,  // loginUrl is optional, fallback to urlPattern
  username, password,               // encrypted in storage
  autoFill, autoLogin               // booleans
}
```

## Key Conventions

- URL pattern matching uses `*` (any chars) and `?` (single char) wildcards, implemented in `utils/siteDetector.js`
- All storage operations go through background.js; UI never accesses `chrome.storage` directly (except for the `onChanged` listener to refresh lists)
- HTML is sanitized via `escapeHtml()` (createElement + textContent) before DOM insertion
- CSP is strict: `script-src 'self'; object-src 'self'`
