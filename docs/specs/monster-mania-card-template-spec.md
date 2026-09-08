# Monster Mania Card Template Specification

**Status:** Production baseline  
**Applies to:** Monster cards and Weapon cards  
**Purpose:** Keep all future card frames, artwork, and GIMP assembly consistent.

---

## 1. Master Canvas

All Monster and Weapon card templates use the same master canvas.

| Property | Specification |
| --- | --- |
| Canvas width | **1060 px** |
| Canvas height | **1484 px** |
| Aspect ratio | **5:7** |
| Color mode | RGBA |
| Background | **Transparent** |
| Export format | PNG |
| Recommended working precision | 8-bit RGBA minimum |

### Non-negotiable

- Do not crop the canvas to the visible frame artwork.
- Do not flatten transparency onto black, white, or another matte.
- The area outside the card frame must remain transparent.
- The large illustration window must remain transparent.
- Monster and Weapon templates must always use the exact same canvas dimensions.

---

## 2. Shared Card Geometry

Monster and Weapon cards should use the same underlying layout even though their decorative frame artwork is different.

The following measurements are the **canonical production targets** for future template work.

### A. Illustration / Character Art Window

| Property | Target |
| --- | --- |
| Left | **165 px** |
| Top | **250 px** |
| Width | **730 px** |
| Height | **510 px** |
| Right | **895 px** |
| Bottom | **760 px** |

This is the primary transparent opening used for monster or weapon artwork.

**Allowed decorative intrusion:** up to approximately 20 px around the edges where the frame bevels or corner hardware overlap the opening visually. The usable artwork composition should still be designed around the 730 × 510 px target area.

### B. Middle Information Bar

| Property | Target |
| --- | --- |
| Left | **145 px** |
| Top | **780 px** |
| Width | **770 px** |
| Height | **160 px** |
| Right | **915 px** |
| Bottom | **940 px** |

The circular Monster/Weapon category medallion overlaps the left side of this region.

Recommended text-safe region inside the bar:

- Left: **305 px**
- Top: **810 px**
- Right: **870 px**
- Bottom: **910 px**

This leaves room for the medallion and keeps text away from the beveled edges.

### C. Lower Rules / Description Panel

| Property | Target |
| --- | --- |
| Left | **155 px** |
| Top | **950 px** |
| Width | **750 px** |
| Height | **285 px** |
| Right | **905 px** |
| Bottom | **1235 px** |

Recommended text-safe region:

- Left: **195 px**
- Top: **990 px**
- Right: **865 px**
- Bottom: **1195 px**

The safe region deliberately avoids the decorative parchment corners and bottom-center crest.

### D. Top Name Banner

The curved parchment banner is decorative, so its outer silhouette can vary slightly between Monster and Weapon cards. The usable text area should remain consistent.

Recommended name-safe region:

| Property | Target |
| --- | --- |
| Left | **195 px** |
| Top | **155 px** |
| Width | **670 px** |
| Height | **110 px** |
| Right | **865 px** |
| Bottom | **265 px** |

Card titles should be horizontally centered within this area.

---

## 3. Shared Layout Ratios

When producing a template at another resolution, scale all measurements proportionally from the 1060 × 1484 master.

| Element | Approx. % of canvas width | Approx. % of canvas height |
| --- | ---: | ---: |
| Illustration window | 69% | 34% |
| Middle information bar | 73% | 11% |
| Lower rules panel | 71% | 19% |
| Name-safe area | 63% | 7% |

**Do not independently stretch width or height.** Maintain the 5:7 aspect ratio.

---

## 4. Border and Frame Rules

Monster and Weapon borders have different themes, but they should feel like two variants of the same card system.

### Shared requirements

- Similar overall visual weight.
- Similar side-border thickness.
- Matching placement of major structural breaks.
- Illustration windows must feel the same size.
- Middle bars must feel the same height.
- Lower parchment panels must feel the same size.
- Major top and bottom crests may extend beyond the normal frame silhouette.
- Decorative gems and spikes may differ, but should not materially shrink the usable content areas.
- Keep the central content column visually aligned from card to card.

### Monster identity

- Silver / dark steel structure.
- Blue and purple crystal accents.
- Blue central top gem.
- Monster-head category medallion.
- Blue crystal bottom centerpiece.

### Weapon identity

- Gold / dark stone structure.
- Orange and amber crystal accents.
- Gold star / compass-like top medallion.
- Crossed-swords category medallion.
- Golden sun/orb bottom centerpiece.

---

## 5. Transparency Rules

Transparency is part of the template design, not an export convenience.

### Must be transparent

1. The full area outside the decorative card silhouette.
2. The complete illustration window.

### Must NOT be transparent

- Top parchment banner.
- Middle dark information bar.
- Lower parchment description panel.
- Frame, gems, medallions, bevels, and decorative hardware.

When checking a finished PNG in GIMP, the illustration window and external background should show the checkerboard transparency grid.

---

## 6. Artwork Asset Specification

Individual monster and weapon illustrations should be created separately from the card frame.

### Master artwork canvas

Use the illustration-window proportions as the basis for standalone art assets:

- **730 × 510 px minimum working area**
- Recommended high-resolution source: **1460 × 1020 px** (2×)
- RGBA PNG
- Transparent background
- No card border
- No typography
- No stats
- No category medallion
- No baked-in shadow that assumes a specific frame

The artwork may extend slightly beyond its nominal window when intentionally layered behind the frame in GIMP, but its important silhouette must remain readable within the canonical 730 × 510 px window.

---

## 7. Monster / Weapon Artwork Consistency

All standalone artwork should follow the same visual-production rules.

- Similar apparent scale within the art window.
- Subject centered around the same visual anchor.
- Avoid placing important details against the outer 30 px of the artwork window.
- Maintain consistent rendering/detail level.
- Keep lighting direction broadly compatible across the deck.
- Do not include borders, labels, names, card-type symbols, or text.
- Weapon illustrations should use a standardized viewing angle unless the weapon requires a different orientation to remain readable.
- Monster illustrations should leave enough negative space around the head and outer silhouette to avoid feeling cramped by the frame.

---

## 8. Recommended GIMP Layer Stack

From top to bottom:

1. **Card text / numbers**
2. **Optional gameplay icons or effect markers**
3. **Card frame template**
4. **Monster or weapon artwork**
5. **Optional artwork-only effects / glow**
6. **Transparent base**

This allows the illustration to sit behind the ornate frame while text remains crisp above it.

---

## 9. Template Alignment Tolerance

For future generated or manually edited templates:

- Canvas size: **0 px tolerance**
- Aspect ratio: **0 tolerance**
- Illustration window position/size: **±10 px**
- Middle bar position/size: **±10 px**
- Lower panel position/size: **±10 px**
- Name-safe region: **±10 px**
- Decorative frame silhouette: flexible, provided it does not violate the shared content geometry

If a generated template falls outside these tolerances, correct it before using it as a production asset.

---

## 10. Production Checklist

Before approving a Monster or Weapon template:

- [ ] Canvas is exactly 1060 × 1484 px.
- [ ] PNG is RGBA.
- [ ] Outside background is transparent.
- [ ] Illustration window is transparent.
- [ ] Illustration window matches the shared target dimensions.
- [ ] Middle bar matches the shared layout.
- [ ] Lower parchment panel matches the shared layout.
- [ ] Top banner text area is consistent.
- [ ] Card frame does not materially intrude into content-safe regions.
- [ ] No card-specific text is baked into the template.
- [ ] No monster or weapon illustration is baked into the template.
- [ ] Category identity icon is correct for the card type.
- [ ] Asset visually aligns with the opposite card type when placed side by side.

---

## 11. Canonical Source-of-Truth Summary

```text
MASTER CANVAS
1060 × 1484 px
5:7 portrait
RGBA PNG
transparent exterior

ILLUSTRATION WINDOW
x: 165
 y: 250
w: 730
h: 510

MIDDLE BAR
x: 145
y: 780
w: 770
h: 160

LOWER PANEL
x: 155
y: 950
w: 750
h: 285

TITLE SAFE AREA
x: 195
y: 155
w: 670
h: 110

ARTWORK SOURCE
730 × 510 minimum
1460 × 1020 recommended working resolution
transparent RGBA PNG
```

These measurements are the baseline Monster Mania card system. Future card frames and artwork should conform to this document rather than being resized independently by eye.
