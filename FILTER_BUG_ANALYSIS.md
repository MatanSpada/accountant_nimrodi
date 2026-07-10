# Filter Bug Analysis

## 1. What the previous implementation attempted

The previous implementation added:

- A `fetchResults(url)` function that fetches the full page, extracts `#payments-results` via `DOMParser`, and swaps it into the live DOM.
- `history.pushState` + `popstate` for URL management without full page reloads.
- A `hasPendingChanges` flag in `initStatusDropdown` to defer `applyFilters()` until the dropdown closes.
- `syncFilterInputsFromUrl(url)` to re-sync the filter bar after each DOM swap.

## 2. Why the dropdown stayed open but the table did not filter immediately

The checkbox `change` handler only set `hasPendingChanges = true` and called `updateStatusTrigger()` (which updates the button label). `applyFilters()` was never called while the panel was open. It was only called inside `closePanel({ applyChanges: true })`, which fires when the user clicks outside, presses Escape, or clicks the trigger again to close the panel. So the dropdown correctly stayed open, but results never updated until it closed.

## 3. Whether the checkbox change event actually triggers a fetch

No. The handler is:

```javascript
cb.addEventListener("change", function () {
  hasPendingChanges = true; // sets flag only
  updateStatusTrigger(); // updates label only
  // applyFilters() is never called here
});
```

## 4. Whether the fetch URL contains the selected status

Only after the panel closes. At that point `applyFilters()` reads the checked checkboxes, builds the URL correctly with `?status=...`, and calls `fetchResults(url)`. So the URL would be correct — but only after close.

## 5. Whether the returned HTML contains filtered results

Yes. The server renders filtered results based on the `status` query param. Once `applyFilters()` eventually fires, the fetch returns the correct filtered HTML.

## 6. Whether the DOM replacement targets the correct element

Yes. The code does `document.getElementById('payments-results')` and `doc.getElementById('payments-results')` and calls `current.replaceWith(newResults)`. Only `#payments-results` is swapped; the filter bar (`.filter-bar`) is outside this element and is never replaced.

## 7. Whether the code replaces only results or replaces the filter controls too

Only results. The filter bar, status checkboxes, date inputs, and customer field are all outside `#payments-results` and are preserved across fetches. The `.filter-clear-link` anchor is separately synced (it lives in `.filter-bar`).

## 8. Whether active chips update immediately or only after reload/close

Only after panel close + fetch. Chips are inside `#payments-results`. They update correctly once `applyFilters()` fires and the DOM swap completes, but that only happens when the dropdown closes.

## 9. Whether any event listener is lost after DOM replacement

No. Because the filter bar (and its checkboxes) is never replaced, all `change` listeners added by `initStatusDropdown` survive each DOM swap. Event delegation on `document` (for link clicks and click-outside) also survives. No re-binding is needed.

## 10. Precise root cause

**The `hasPendingChanges` deferred-apply pattern**: The checkbox `change` handler defers `applyFilters()` to panel close instead of calling it immediately. This is the single root cause of the observed behavior: dropdown stays open, results never change while it is open.

**Secondary bug — date picker click target**: `.date-native` is `position: absolute; inset: 0; opacity: 0; z-index: 1`, placing an invisible overlay on top of the display button. Clicks anywhere in the control hit the native input directly. The `wrap.click` handler guards with `if (event.target === nativeInput) return` and exits early. The `displayButton.click` handler is never reached because the native overlay is above it. The native date input only opens its calendar when the user clicks its own small calendar icon area, not when clicked programmatically via the overlay — so only that tiny area works.

## Fixes applied

1. **Status filtering**: Removed `hasPendingChanges`. Checkbox `change` handler now calls `updateStatusTrigger()` + `applyFilters()` immediately. `closePanel` simplified — no longer calls `applyFilters` on close.
2. **Date picker**: Added `pointer-events: none` to `.date-native` CSS so clicks pass through to the display button. `initDatePickers` click handler simplified to always call `openDatePicker(nativeInput)`.
