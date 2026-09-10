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

## 1.2.0
- Fixed: sticky/fixed headers no longer get duplicated on every stitched
  segment during full-page capture. The header is now hidden while
  capturing scrolled segments and pasted once, pinned to the top of the
  final image.

## 1.2.1
- Fixed: bottom-docked sticky/fixed toolbars (e.g. action bars pinned to
  the bottom of the viewport) were still being duplicated on every
  stitched segment, same issue as the top header fixed in 1.2.0. Now
  detected and handled the same way — hidden during scroll, pasted once
  at the bottom of the final image.

## 1.3.0
- Fixed: sticky bar detection previously only matched elements pinned
  exactly at the viewport edge (top/bottom ~0px). Sites with stacked or
  offset sticky bars (e.g. a secondary toolbar sitting below a fixed main
  header with `top: 60px`, or a bottom bar with padding/shadow) were not
  detected and kept getting duplicated. Detection now compares each
  candidate's actual position against its own computed top/bottom CSS
  offset, with a looser fallback for `position: fixed` elements.
- Added console diagnostics: after a full-page capture, open the page's
  own DevTools console (F12) to see exactly which elements were detected
  as sticky headers/footers.

## 1.3.1
- Fixed: an exception inside sticky-bar detection (e.g. on pages with
  unusual DOM/CSS) could crash the "detected.headerBottom" lookup with
  a "Cannot read properties of undefined" error, aborting the whole
  full-page capture. Detection now fails safe — on any error it just
  skips sticky-bar handling for that page instead of breaking the
  capture, and logs the error for debugging.

## 1.3.2 (revert of the 2.0.0 CDP experiment)
- Reverted the CDP `captureBeyondViewport` full-page approach introduced
  in 2.0.0. It broke sites that use scroll-driven virtualized rendering
  (e.g. large tables/lists that only render currently-visible rows and
  swap them on real scroll events, common in React apps) — since CDP's
  captureBeyondViewport expands the render area without dispatching real
  scroll events, such pages just showed their initial screen repeated
  instead of actual content further down the page.
- Back to the scroll-and-stitch approach (as of 1.3.1) with generalized
  sticky-bar detection and fail-safe error handling. The `debugger`
  permission has been removed again.
- Sticky-bar duplication on specific sites remains an open issue being
  worked on with real diagnostic data (see the console log added in
  1.3.0/1.3.1).

## 1.4.0
- Simplified sticky-bar detection drastically: dropped the fragile
  "matches its own computed top/bottom offset" comparison (which appears
  to have been silently failing or throwing on some real sites) in favor
  of a much simpler rule — any fixed/sticky element that's wide enough
  and not too tall counts as a bar, classified as top/bottom by which
  half of the viewport it sits in. Each element is checked in isolation
  with its own try/catch, so one exotic element can no longer disable
  detection for the entire page.

## 1.4.1 — the actual root cause fix
- Found and fixed the real bug behind every previous sticky-bar attempt
  since 1.3.0: `chrome.scripting.executeScript({ func })` only injects
  the exact function passed to it — it does NOT bring along other
  top-level functions from background.js via closure. `detectStickyBars`
  and `setStickyBarsHidden` were calling a separate `isCandidateBar`
  helper that simply didn't exist inside the injected page context,
  throwing a silent `ReferenceError` caught by their own try/catch and
  returning zero every single time — on every site, regardless of its
  markup. This is why detection always reported nothing since the 1.3.0
  "generalization" (which introduced the external helper) even though
  1.2.0/1.2.1 worked fine (their logic was inline, no shared helper).
  Fixed by inlining the check directly into both functions.

## 1.5.0
- Added a fast pre-scan pass before the real capture loop: jumps to 6
  sample points across the whole page (no screenshots taken) to detect
  sticky headers/footers up front. This fixes bottom-sticky action bars
  that only become "stuck" (visible) partway down a long page — the
  previous detection window (first two segments only) could miss them
  entirely, causing residual duplication even after the core detection
  bug was fixed in 1.4.1.
- Detection results now apply from segment 0 of the real capture loop
  instead of being discovered mid-way through.

## 1.5.1
- Fixed ghosting/corruption artifacts introduced by the 1.5.0 pre-scan:
  the pre-scan's page-wide maximum header/footer size was used to crop
  the overlay from segment 0 / the last segment, but on pages where
  sticky bar size changes at different scroll depths (e.g. a secondary
  toolbar that only becomes sticky partway down), that maximum didn't
  match what was actually present in the source frame, pasting the wrong
  region on top of the image. Now the pre-scan is only used to decide
  *whether* to bother hiding sticky bars at all; the exact crop size is
  measured directly from the specific frame it's sourced from.

## 1.6.0 — sticky bar duplication fixed at the root
- Replaced the entire detect/classify/hide-per-segment/paste-overlay
  approach with a much simpler and more robust one: before capturing,
  every `position: fixed` or `position: sticky` element on the page
  (above a minimum size, to avoid touching small floating widgets) is
  temporarily forced to `position: static` for the whole capture, then
  restored afterward. With nothing actually "stuck" to the viewport
  during the scroll-and-stitch process, no element can be captured more
  than once — regardless of how many sticky bars a page has, where they
  sit, or at what scroll depth they activate.
- This replaces builds 1.2.0 through 1.5.1, all of which tried to
  classify sticky bars as "header" or "footer" and handle them
  individually — an approach that kept breaking on pages with more than
  one sticky bar or bars whose size changes at different scroll depths.
- `position: sticky` elements are never taken out of normal document
  flow (only `fixed` ones are), so this change cannot affect page height
  or shift other content — it only stops the element from re-pinning
  itself to the viewport while scrolling.

## 1.6.1
- Broadened the size filter in `disableStickyPositioning`: the previous
  "at least 30% of viewport width" rule was tuned for wide top/bottom
  bars and missed narrow sticky sidebars (category filters, cookie
  banners docked to one side, etc.), which kept duplicating. Now uses a
  small absolute minimum (60x20px) instead, while still skipping
  near-full-screen overlays (open modals) to avoid disturbing those.

## 1.6.2
- Fixed: the 1.6.1 "skip near-full-screen overlays" rule excluded
  full-height sticky sidebars (tall but narrow columns), since it only
  checked height. Now only skips elements that are both wide AND tall
  (a much better signal for an actual modal/overlay backdrop) — narrow
  full-height sidebars are neutralized correctly.

## 1.7.0
- Fixed: some sites use a JS scroll-event handler (e.g. a legacy jQuery
  "sticky sidebar" plugin) that reasserts its own inline positioning on
  every scroll, silently undoing a one-time neutralization done before
  the capture loop started. `disableStickyPositioning` is now re-applied
  after every single scroll step (right before each segment capture),
  not just once at the start, so it always gets the "last word" for that
  frame. The original position is only recorded on first encounter per
  element, so repeated calls don't overwrite the true baseline with an
  intermediate site-reasserted value.

## 1.8.0
- Fixed: pages with lazy-loaded content (infinite-scroll product lists,
  footers that mount only after earlier sections load, etc.) were
  getting cut off — page height was measured once at the very start,
  before any of that content had a chance to load, so both the capture
  loop's stopping point and the final canvas height were based on a
  stale, too-short measurement. Added a warm-up pass: scroll all the way
  to the bottom once (no capture) to let lazy content load, re-measure
  the page height, then reset to the top and run the real capture loop
  against the now-accurate height.
