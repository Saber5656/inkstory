# Title

Book editor shell: book list, page list with thumbnails, reorder, autosave

## Summary

Implement book CRUD and the editor frame of DESIGN §8.2: books tab in the library,
editor route with the page-thumbnail rail, drag-to-reorder, add/delete page, and
debounced autosave. Page content editing arrives in issue 19.

## Context

Books are ordered page collections (DESIGN §7.1: `Book.pageOrder`). The editor is
parent-facing; reliability (autosave, no lost work) matters more than flourish.

## Scope

`src/book/`: `bookStore.ts` (Zustand + repos), editor route layout, PageRail component,
book list UI in `/` Books tab.

## Detailed Requirements

1. Books tab (`/`): grid of book cards (cover = first page's character thumb over its
   background, or placeholder), create ("あたらしい えほん") → creates Book with
   default title (localized "はじめての えほん (n)") → navigates to editor; rename
   (inline, ≤100 chars per schema); delete with confirm dialog naming the title and
   page count (cascade per issue 05).
2. Editor layout: left vertical PageRail (thumbnails, current highlighted), right
   composer area (issue 19 mounts here; placeholder now); top bar: back, book title
   (inline edit), play button (routes to `/books/:id/play`, disabled until ≥1 page).
3. PageRail: add-page button (creates Page with defaults: background `plain_cream`,
   empty text, no character); tap to select; **drag-to-reorder** with touch + pointer
   (use `@dnd-kit/core` — add to ADR-006 dependency table via PR note) updating
   `pageOrder` transactionally; delete page via context long-press/kebab with confirm;
   page thumbnails re-render on content change (cheap canvas snapshot of composed
   layout, 144 px, debounced 1 s).
4. Autosave: every mutation flows store→repo with 500 ms debounce per entity; visible
   "saved" tick in the top bar; leaving the route flushes pending writes
   (`beforeunload` + router guard).
5. Ordering integrity: `pageOrder` is the single source of order; repair rule on load
   (orphan page ids appended, missing ids dropped — logged via console.warn only).
6. Empty states and all strings localized; touch-first per §8.7.

## Acceptance Criteria

- Storage integration tests: create/rename/delete book; add/reorder/delete pages;
  `pageOrder` always consistent (incl. the repair rule fixture).
- Reorder works with keyboard (select + arrow move) as well as drag (a11y).
- Kill-the-tab test (component-level: unmount during pending debounce) loses at most
  the final 500 ms edit — flush verified.
- Deleting a book removes its pages + narration blobs (repo cascade asserted).

## Validation

`pnpm test src/book`; manual tablet pass: create 5-page book, reorder, rename, delete
— recorded in PR.

## Dependencies

03, 05.

## Non-goals

Page composer fields (19), narration (20), player (21), cover art customization (v2).

## Design References

DESIGN.md §7.1, §8.2, §8.7.
