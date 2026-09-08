# Monster Mania Standalone Artwork Specification

**Status:** Production baseline  
**Applies to:** Standalone Monster artwork and Weapon artwork  
**Purpose:** Keep all art assets consistent before they are placed under the approved Monster Mania card templates in GIMP.

---

## 1. Master Artwork Canvas

All standalone artwork should use one shared canvas standard.

| Property | Specification |
| --- | --- |
| Canvas width | **1460 px** |
| Canvas height | **1020 px** |
| Aspect ratio | **73:51** |
| Relationship to card art window | **2× scale of the 730 × 510 card illustration window** |
| Color mode | RGB or RGBA |
| Export format | PNG |
| Background inside canvas | **Opaque illustrated scene** |

### Non-negotiable

- Every standalone Monster or Weapon artwork image must use **1460 × 1020 px**.
- Do not include any card frame, banner, medallion, parchment, border, or UI element.
- Do not crop the art to irregular shapes.
- Do not export with card-edge remnants visible.
- Keep the full canvas filled with illustration.

---

## 2. Purpose of the Artwork Canvas

This standalone artwork is the image that will sit **under** the transparent illustration opening in the card template.

That means the art file should:

- already contain the subject and the scenic background,
- be fully clean on all four edges,
- have no template pieces baked into it,
- and be ready to drop into GIMP beneath the card frame.

---

## 3. General Composition Rules

All art should be composed so the important content reads clearly once placed inside the Monster Mania card window.

### Shared composition targets

| Property | Target |
| --- | --- |
| Safe margin from left edge | **60 px minimum** |
| Safe margin from right edge | **60 px minimum** |
| Safe margin from top edge | **50 px minimum** |
| Safe margin from bottom edge | **50 px minimum** |
| Primary subject readability zone | **central 1240 × 920 px area** |

### Interpretation

- Important subject edges should not be pressed against the canvas borders.
- Scenic background can extend to the edges.
- The subject should have enough breathing room that it still reads well when slightly repositioned in GIMP.

---

## 4. Weapon Artwork Rules

Weapon artwork should show **the weapon in the foreground** with **the environment behind it**.

### Weapon image requirements

- The weapon is the hero subject.
- The background should remain a finished fantasy scene, not transparent.
- Maintain the existing visual style of the approved card illustrations.
- Preserve the original weapon design, orientation, material treatment, and rendering style.
- Remove all visible card-frame remnants from the edges of the crop.
- Expand or repaint the missing environment so the full image feels naturally composed.
- Do not add text, icons, stat rings, category markers, or any other UI elements.

### Weapon framing guidance

- The weapon should typically occupy about **55%–80%** of the canvas width or height, depending on orientation.
- Long weapons may run diagonally as long as the silhouette remains comfortably inside the safe margins.
- The weapon should feel intentional and centered, not clipped or floating awkwardly.

---

## 5. Monster Artwork Rules

Monster artwork should show the monster as the hero subject with a full scenic or atmospheric background.

### Monster image requirements

- The monster is the hero subject.
- Background should be complete and illustrated.
- Keep the same polished fantasy-card illustration style.
- No card frame pieces or UI elements.
- No typography.
- The monster silhouette must remain readable even after placement inside the card window.

### Monster framing guidance

- Prefer the monster’s head / focal area near the visual center of the composition.
- Avoid placing key facial features or limbs inside the outermost **50 px** edge zones.
- The monster should feel large and impressive, but not so zoomed-in that the frame becomes cramped.

---

## 6. Background Rules

Backgrounds are part of the asset and should be finished rather than transparent.

### Required background behavior

- Continue the original scene naturally beyond the current crop.
- Match lighting, depth of field, atmosphere, and color palette from the source image.
- Replace any cropped-out frame areas with believable environment details.
- Background extensions should feel seamless.

### Not allowed

- Transparent checkerboard background.
- Flat color fill.
- Blurry generative filler that does not match the scene.
- Visible remnants of card bevels, parchment, corner hardware, or medallions.

---

## 7. Style Consistency Rules

All standalone art should maintain a unified deck style.

- Polished fantasy trading-card illustration look.
- Crisp outlines and readable silhouettes.
- High detail on the hero subject.
- Soft atmospheric depth in the background.
- Warm light / fantasy environment treatment when inherited from the original crop.
- Similar apparent quality level across all assets.

For derived images based on existing approved crops, the new art should feel like a **clean expansion of the same image**, not a redesign.

---

## 8. Assembly Guidance for GIMP

Recommended layer order:

1. **Card frame template** (top)
2. **Standalone artwork** (below frame)
3. Optional effects / shadows if needed
4. Typography and card text layers

### Placement guidance

- Scale the 1460 × 1020 artwork down to the card window as needed.
- Align the subject so it reads best inside the frame opening.
- Minor repositioning in GIMP is expected and supported.

---

## 9. QA Checklist

Before approving any standalone artwork, confirm all of the following:

- [ ] Canvas is exactly **1460 × 1020 px**.
- [ ] Aspect ratio is **73:51**.
- [ ] No card border fragments are visible.
- [ ] No parchment banner or medallion pieces are visible.
- [ ] The subject is clearly readable.
- [ ] Background extension is seamless.
- [ ] The image matches the established Monster Mania style.
- [ ] The file is ready to place under the template in GIMP.

---

## 10. Current Baseline Decision

For the current production pass, all standalone weapon images created from approved card crops should:

- use **1460 × 1020 px**,
- preserve the current weapon design exactly,
- remove frame remnants,
- extend the fantasy background naturally,
- and keep the weapon as the clear foreground focal point.

