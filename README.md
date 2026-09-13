# Nakshatra — Circuit Lab

A local-first digital circuit designer with a real 3D board, live logic simulation, and a secondary personal profile for Nakshatra D.

## Run locally

Requires Node.js 22.13 or later.

- Install dependencies: `npm ci`
- Start the development preview: `npm run dev`
- Open the local URL printed by the server. If port 5173 is occupied, Vite chooses the next available port.
- Verify: `npm test`, `npm run typecheck`, `npm run build`

The preview for this implementation was started at http://localhost:5174/. Nothing has been deployed or pushed.

## Use the lab

The initial circuit is a 4-bit ripple-carry adder with 34 components and 45 connections. Word A = 11, Word B = 6, and carry-in = 0, producing 17 (binary 10001). The inspector groups inputs into four-bit words and shows the five-bit result. Existing designed circuits remain saved; use Load featured circuit to open the new demo. An untouched legacy half-adder upgrades automatically.

- **View:** The navigation dock has explicit Orbit/Edit, Pan, Zoom, Fit, directional movement, and Focus controls. Pan allows left-drag movement; right-drag also pans in 3D. Focus zooms to the selected chip. Arrow keys move the camera when the board is focused, and +/- zoom. The 2D fallback also supports these navigation controls.
- **Add:** Select an input, output, or gate in Components. Click a clear spot on the board, or use Find a spot for keyboard placement.
- **Connect:** Click an output pin on the right of a part, then an input pin on the left of another. The Wire connections panel provides keyboard-accessible source/destination selectors. Wires use obstacle-aware routing, brighter copper/blue traces, and source/destination labels when hovered or selected. Selecting a chip highlights its incident connections and dims unrelated wires. The inspector lists connected components directly.
- **Move:** Choose Top-down, then Edit, and drag a gate. Its wires follow; releasing on an occupied spot rejects the move and preserves the original position. A visible Move button beside the selected gate also supports click-to-reposition. Coordinate fields remain available. Gate dragging is disabled in Pan mode so camera motion and circuit editing are distinct.
- **Inspect:** Click a chip or choose it in Inspect a component. Rename, focus, move, edit coordinates, disconnect inputs, or delete it.
- **Undo:** Use the toolbar or Command/Ctrl Z. Redo uses Command/Ctrl Shift Z or Ctrl Y. Escape cancels placement or wiring.
- **Presets:** The circuit-name menu contains 4-bit ripple-carry adder, Half-adder, Full-adder, Basic gates, and Empty board.
- **Save:** The current circuit autosaves in this browser after edits. Export downloads a JSON file; Import validates it before replacing anything. Edited boards require confirmation before replacement.
- **Mobile:** Expand Components to add parts. The signal and editing controls sit below the board. Scroll the page outside the canvas.

Blue is logic 1, copper is logic 0, and ? is unknown. Dominant inputs are handled correctly: AND(0, ?) = 0 and OR(1, ?) = 1.

This is an educational combinational-logic simulator. It does not model analog voltages, propagation timing, transistor layout, clocks, sequential state, fabrication output, or feedback loops. The moving signal dots are illustrative.

## Implementation

- React and TypeScript on the Sites/Vinext starter.
- Three.js, React Three Fiber, and Drei render procedural chip packages with generated silicon textures, copper pins, PCB traces, and LEDs. Studio environment reflections, clear-coated die surfaces, and sharper shadows improve material definition. The renderer is lazy-loaded.
- Generated processor artwork appears in the masthead and profile. Exact prompts and asset paths are in [generated-assets.md](docs/generated-assets.md).
- `lib/wire-routing.ts` routes traces around component bodies using a small A* search. If a route is completely blocked, a raised jumper preserves visibility.
- `lib/circuit.ts` owns circuit types, truth tables, graph validation, presets, and import validation.
- `lib/circuit-store.ts` applies validated, atomic edits and maintains up to 50 undo steps.
- `hooks/use-circuit-lab.ts` connects the shared store to browser storage and the interface.
- No account, API key, database, or external service is required. Google Fonts are optional visual enhancements with local font fallbacks.
- WebGL failures fall back to a functional SVG schematic with the same controls. Reduced motion disables signal animation by default; offscreen/hidden boards stop their animation loop.
- Personal content and social links come from https://nakshatra82.github.io/.

### Circuit files

Version 1 JSON contains `version`, `name`, `parts`, and `wires`. Parts have stable IDs, a component kind, label, x/z position, and a value for input switches. Wires refer to source and destination IDs and the destination input pin (zero-indexed).

The editor accepts at most 50 parts and 100 wires. Components must fit within x = -16..16 and z = -11..11 without overlap. The board expands for larger circuits; smaller legacy presets retain their compact board. Inputs accept one driver; outputs support fan-out. Unknown versions, malformed files, invalid references, occupied inputs, duplicate IDs, invalid positions, and cycles are rejected atomically. Imported text is rendered as text, never executable markup.

## Verification

`npm test` covers all gate truth tables, every half/full-adder input combination, all 512 four-bit adder combinations, dense-board wire routing, moving a connected gate and undoing the move, fan-out, unknown signals, invalid connections, deletion, undo/redo, atomic batches, preset replacement, JSON round trips, malformed imports, and unavailable browser storage.

Type checking and the production build are also required. Browser screenshots, interaction automation, and visual QA were not requested or performed. Suggested manual acceptance checklist:

1. Load the featured 4-bit circuit. Set both words to 15 and carry-in to 1; expect 31 (11111).
2. Add and wire a NOT gate to a switch and LED, then toggle the switch.
3. Drag a wired gate in Top-down/Edit, undo, redo, and verify its connections. Try an occupied drop target. Switch to Pan and drag across a chip without moving the chip.
4. Export, reload, import, and verify the circuit is unchanged.
5. Attempt a duplicate input connection and feedback loop; verify a clear error and no mutation.
6. Select a chip and trace its highlighted wires, then select a wire to read source/destination labels. Try camera zoom, movement, fit, and focus.
7. Try a narrow screen, keyboard-only editing, reduced motion, and WebGL disabled.

### Optional browser agent tools

When `document.modelContext.registerTool` is supported, the page registers `read_circuit` and `edit_circuit`. They use the same store and validation as the visible UI. Their registration, state changes, invalid inputs, and cleanup have contract unit tests. Native WebMCP execution was not verified in a supporting browser; unsupported browsers run the website normally.

## Hosting

This delivery is local only. The inherited Sites build integration remains available for a later deployment; no Site was registered and no production website was changed. Publishing or pushing to GitHub requires a separate explicit instruction.
