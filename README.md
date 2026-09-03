# 2izi Screenshot

Full-page or area screenshots, saved instantly as JPG. No preview tabs, no
extra viewers — one click, one file in your Downloads folder.

🇷🇺 [Читать на русском](README.ru.md)

## Features

- **Full page** — scrolls and stitches the entire page into one image
- **Select area** — macOS-style drag selection with a crosshair cursor and
  live size readout, `Esc` to cancel
- Saves straight to `.jpg` via the browser's downloads API — nothing opens
  in a new tab or editor
- 100% local processing — no data ever leaves your browser (see
  [Privacy Policy](docs/PRIVACY.md))
- English and Russian UI (auto-detected from your browser language)

## Install

**From the Chrome Web Store:** [add your listing URL here once published]

**From source (developer mode):**

1. Download or clone this repository
2. Open `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the `extension/` folder

## How it works

Click the toolbar icon and choose:

- **Full page** — the extension scrolls the page in viewport-sized steps,
  captures each step, and stitches them into a single image using an
  `OffscreenCanvas` in the background service worker.
- **Select area** — a content script draws a full-screen overlay for
  drag-selection; once you release the mouse, the background script
  captures the visible tab and crops it to your selection.

Both paths convert the result to JPEG and hand it to
`chrome.downloads.download` with `saveAs: false`, so the file lands
directly in your Downloads folder.

## Project structure

```
extension/          the actual Chrome extension (load this as unpacked)
  manifest.json
  background.js      full-page stitching, selection crop, JPG download
  content.js          drag-selection overlay
  popup.html/.js       toolbar popup UI
  icons/                16/32/48/128 px icons
  _locales/en, /ru       UI strings
docs/                privacy policy (EN/RU)
store/               Chrome Web Store listing copy (EN/RU)
```

## Permissions

| Permission  | Why |
|-------------|-----|
| `activeTab` | Capture the tab you're viewing, only after you click the icon |
| `scripting` | Inject the selection overlay / scroll helper on the active tab |
| `downloads` | Save the finished JPEG to your Downloads folder |

No host permissions for "all sites," no background activity without your
action. Full details in [docs/PRIVACY.md](docs/PRIVACY.md).

## Known limitations

- Full-page capture can duplicate `position: sticky` / `fixed` headers
  across stitched segments — a known trade-off of the scroll-and-stitch
  approach (vs. using `chrome.debugger`, which triggers a visible
  "extension is debugging this tab" banner).
- Cannot capture `chrome://` pages or the Chrome Web Store — a browser
  restriction, not specific to this extension.

## Support

https://2izi.ru/support

## License

MIT — see [LICENSE](LICENSE).
