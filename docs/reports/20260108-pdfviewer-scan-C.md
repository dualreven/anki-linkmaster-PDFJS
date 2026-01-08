# PDFViewer Spaghetti Scan Report - C (pdf-annotation)

**Task**: 20260108212150-pdfviewer-spaghetti-scan-C
**Date**: 2026-01-08 23:55:00
**Scope**: `src/frontend/pdf-viewer/features/pdf-annotation/**`

## Executive Summary
The `pdf-annotation` feature is in a **mixed state**.
- **Manager**: `AnnotationManager` (V2) has successfully migrated to `ObservableState`.
- **Sidebar UI**: `AnnotationSidebarUI` has migrated to `store.subscribe` for rendering the list, but retains significant **"Zombie Code"** (unused EventBus handlers) in `subscriptions.js`.
- **Tools (Screenshot, TextHighlight, etc.)**: These are the primary source of "Spaghetti". They rely heavily on **Event-Driven UI updates** (listening to `CREATED`/`DELETED` events to add/remove markers) instead of reacting to state changes. They also manage their own lifecycle synchronization with PDF.js events (`PAGE.RENDERED`, etc.) which often leads to race conditions (evidenced by `setTimeout` usages).

## Detailed Findings

### 1. Mixed State Spaghetti (EventBus + Store)
**Pattern**: UI/Tools listening to EventBus CRUD events (`CREATED`, `DELETED`) to update their view, instead of deriving view from Store state.

| Priority | File | Line | Issue Description |
| :--- | :--- | :--- | :--- |
| **P0** | `src/frontend/pdf-viewer/features/pdf-annotation/tools/screenshot/annotation-event-handlers.js` | 38, 51, 61 | `ScreenshotTool` listens to `JUMP_SUCCESS`, `CREATED`, `DELETED` to render/remove markers. **Risk**: Desync if state changes without event (e.g. bulk load, undo/redo). |
| **P1** | `src/frontend/pdf-viewer/features/pdf-annotation/components/annotation-sidebar-ui/subscriptions.js` | 98-125 | **Zombie Code**. `installAnnotationSidebarSubscriptions` defines handlers for `CREATED`/`UPDATED`/`DELETED`/`LOADED`, but `AnnotationSidebarUI` (which is Store-driven) doesn't pass these callbacks anymore. Should be cleaned up to avoid confusion. |
| **P1** | `src/frontend/pdf-viewer/features/pdf-annotation/tools/screenshot/index.js` | 147 | Listens to `ANNOTATION.DATA.LOADED` to trigger marker restoration. Should be reactive to `store.annotations` changes. |
| **P1** | `src/frontend/pdf-viewer/features/pdf-annotation/tools/text-highlight/event-subscriptions.js` | 38-83 | `TextHighlightTool` heavily event-driven for activation and UI updates. |
| **P2** | `src/frontend/pdf-viewer/features/pdf-annotation/tools/comment/comment-tool-subscriptions.js` | 17, 36 | `CommentTool` listens to `CREATED`/`DELETED` for internal logic. |

### 2. Incomplete Cleanup / Leaks
**Pattern**: `addEventListener` or `setTimeout` usage without guaranteed cleanup.

| Priority | File | Line | Issue Description |
| :--- | :--- | :--- | :--- |
| **P1** | `src/frontend/pdf-viewer/features/pdf-annotation/components/annotation-sidebar-ui.js` | 446 | `setTimeout` in `highlightAndScrollToCard` (3000ms) not cleared on destroy. Risk: trying to access DOM elements after component destruction. |
| **P1** | `src/frontend/pdf-viewer/features/pdf-annotation/tools/screenshot/annotation-event-handlers.js` | 44, 54 | `setTimeout` used to delay marker rendering (100ms/300ms). Fragile timing, likely to workaround rendering race conditions. |
| **P2** | `src/frontend/pdf-viewer/features/pdf-annotation/tools/screenshot/selection-controller.js` | 97-100 | Adds `document` listeners. `deactivate` removes them, but need to ensure `destroy` calls `deactivate` (it seems to, but explicit check recommended). |
| **P2** | `src/frontend/pdf-viewer/features/pdf-annotation/tools/text-highlight/color-picker-dialog.js` | 135, 193 | `addEventListener` on temporary dialog elements. |

### 3. PDF.js Event Coupling
**Pattern**: Direct dependency on `pdfjsEventBus` for rendering markers.

| Priority | File | Line | Issue Description |
| :--- | :--- | :--- | :--- |
| **P1** | `src/frontend/pdf-viewer/features/pdf-annotation/tools/screenshot/index.js` | 171-190 | `ScreenshotTool` manually subscribes to `PAGE.RENDERED`, `SCALE.CHANGING/CHANGED` to manage markers. This logic is duplicated across tools (`TextHighlight` also does it). |
| **P1** | `src/frontend/pdf-viewer/features/pdf-annotation/tools/text-highlight/event-subscriptions.js` | 153-189 | `TextHighlightTool` duplicates the same PDF.js lifecycle logic. |
| **Suggestion**: Centralize "Marker Layer" logic that handles scaling/page-rendering for all tools, driven by the Annotation Store.

## Recommendations

### Refactoring Plan
1.  **Split `AnnotationSidebarUI`**:
    *   Remove legacy event handlers from `subscriptions.js`.
    *   Ensure `subscriptions.js` only contains non-data events (like `SIDEBAR.CLOSED` or `TOOL.DEACTIVATED`).

2.  **Refactor Tools to be Store-Reactive**:
    *   **Goal**: `ScreenshotTool` and `TextHighlightTool` should subscribe to `AnnotationManager.store`.
    *   **Logic**:
        *   `store.subscribe(state => state.annotations)`
        *   Filter annotations by type (e.g., `screenshot`).
        *   Diff with current markers (add new, remove deleted, update changed).
        *   This eliminates the need for `CREATED`/`DELETED`/`DATA.LOADED` event listeners.

3.  **Centralize Marker Rendering**:
    *   Create a `AnnotationLayerAdapter` (or similar) that:
        *   Listens to `PDF.js` events (`PAGE.RENDERED`, `SCALE`).
        *   Subscribes to `AnnotationManager.store`.
        *   Delegates rendering to specific tool renderers (`ScreenshotMarkerRenderer`, `HighlightRenderer`).
    *   This removes duplicated `pdfjsEventBus` logic from individual tools.

### Regression Testing
*   **Test**: `AnnotationSidebarUI` rendering.
    *   Action: Programmatically update `AnnotationManager.store`.
    *   Assert: Sidebar UI updates (add/remove cards).
    *   Verify: *No* EventBus `CREATED`/`DELETED` events are needed for this update.
*   **Test**: `ScreenshotTool` marker restoration.
    *   Action: Load data into `AnnotationManager`.
    *   Assert: Markers appear on the PDF page.
    *   Verify: Works without emitting `ANNOTATION.DATA.LOADED` event (if refactored).

## Commands for Next Step (Refactoring)
*   `rg "installAnnotationSidebarSubscriptions" src/frontend/pdf-viewer/features/pdf-annotation` (To find usage and clean up params)
*   `rg "AnnotationType.SCREENSHOT" src/frontend/pdf-viewer/features/pdf-annotation` (To find screenshot filtering logic to move to selector)

