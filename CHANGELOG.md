# Changelog

## 1.1.0
- Added extension icons (16/32/48/128)
- Added English + Russian localization (UI text auto-switches with browser language)
- Added privacy policy and Chrome Web Store listing copy (EN/RU)
- Fixed: selection screenshots no longer include the dark selection overlay
  (waited for repaint before capture)
- Fixed: `URL.createObjectURL` unavailable in some service worker contexts —
  switched to manual base64 data URL for downloads

## 1.0.0
- Initial version: full-page capture (scroll + stitch) and area selection,
  both saved directly as JPG with no preview tab
