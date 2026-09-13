# Generated silicon assets

Created with the built-in image-generation tool. Both outputs were visually inspected before integration. WebP versions preserve the artwork while reducing download size. The images are illustrative silicon artwork, not photographs of a fabricated circuit or a literal layout of the simulator’s netlist.

## Files and usage

- `public/assets/silicon-hero.webp`: 1536 × 1024, cinematic processor artwork used in the masthead.
- `public/assets/silicon-hero-mobile.webp`: 768 × 512, responsive version also used in the profile section.
- `public/assets/silicon-die.webp`: 1024 × 1024, applied directly to the top surfaces of the editable 3D gate packages.
- `scripts/prepare-assets.mjs`: repeatable image optimization; accepts the original hero and die image paths as arguments.

## Exact generation prompts

### Cinematic processor

```text
Use case: product-mockup
Asset type: cinematic masthead and about-section image for a dark 3D digital circuit website.
Primary request: Generate one very high-quality photorealistic cinematic product visualization in landscape 1536x1024 or wider.
Scene/backdrop: Dark near-black #101820 studio backdrop seamless at outer edges.
Subject: Single exposed silicon microprocessor mounted on intricately routed dark graphite PCB; gorgeous copper metallic wire-bonding, precision etched die with subtle iridescent blue/purple diffraction, extremely fine semiconductor detail, chamfered metallic package.
Style/medium: Crisp clean studio product photography, physically plausible materials, editorial luxury semiconductor aesthetic.
Composition/framing: Oblique macro camera close-up, chip toward right half, left half falls into deep charcoal negative space.
Lighting/mood: Tasteful icy-blue edge illumination and warm copper highlights, subtle depth of field.
Constraints: One finished image, not a collage or variations. NO words, letters, logos, UI, watermark, generic floating neon sci-fi clutter.
```

### Silicon die texture

```text
Use case: stylized-concept
Asset type: unlit material albedo texture applied to top faces of editable 3D logic gates.
Primary request: Generate one high-quality square image, 1024x1024 or greater: perfectly overhead orthographic flat unlit material albedo texture of an exposed silicon integrated circuit die.
Subject: Many extremely fine lithographic circuits, repeated rectangular memory banks, intricate silver/copper interconnects and dark graphite silicon, restrained petrol blue and violet iridescence, microscopic gold contacts at perimeter.
Composition/framing: Entire image filled edge-to-edge with die artwork, no perspective, no package, no background.
Style/medium: Fine realistic microfabrication detail, crisp geometry.
Lighting/mood: Flat unlit albedo texture with no lighting baked in and NO cast shadows.
Constraints: No oblique angles, no text or logos, no watermark. Do not make a collage or variations.
```
