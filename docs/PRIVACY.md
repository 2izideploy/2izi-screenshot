# Privacy Policy — 2izi Screenshot

**Last updated:** September 2026
**Publisher:** TWOIZIRU (2izi.ru)
**Contact / support:** https://2izi.ru/support

## Summary

2izi Screenshot does not collect, store, transmit, or sell any user data. All
processing happens locally, inside your browser, on your device.

## What the extension does

- Captures the visible tab and/or scrolls the page to build a full-page
  image, using Chrome's built-in `tabs.captureVisibleTab` API.
- Crops or stitches the captured image locally using an in-memory canvas.
- Converts the result to a JPEG file and saves it to your computer via
  Chrome's `downloads` API.

No image, URL, page content, or any other data is ever sent to our servers
or to any third party. We do not operate a backend for this extension —
there is nothing for it to talk to.

## Permissions used and why

| Permission   | Why it's needed |
|--------------|------------------|
| `activeTab`  | Lets the extension read and capture the tab you're currently viewing, only after you click the extension icon. |
| `scripting`  | Injects the small helper script that draws the selection overlay and scrolls the page during full-page capture. Runs only on the active tab, only after you trigger an action. |
| `downloads`  | Saves the finished JPEG file to your Downloads folder. |

The extension does not request host permissions for "all sites" and does
not run in the background without your action — it only activates when you
click the toolbar icon and choose "Full page" or "Select area."

## Data retention

Since no data leaves your device, there is nothing for us to retain, and
nothing to delete on request — the extension simply has no user data store.

## Changes to this policy

If this policy changes, the updated version will be published at this same
location and on https://2izi.ru/support.

## Contact

Questions about this policy or the extension: https://2izi.ru/support
