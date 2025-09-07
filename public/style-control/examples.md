# Style Configuration Examples

Here are some example style configurations you can use by updating `config.json`:

## Cubist Style (Current)

```json
{
  "name": "cubist-earthy-v1",
  "style": {
    "artistic_movement": "Cubist-style",
    "medium": "colored-pencil/ink texture",
    "palette_description": "Muted earthy palette, geometric fragments",
    "composition": "Full-bleed, edge-to-edge composition that reaches all four sides; seamless continuation to neighboring tiles",
    "constraints": "Do not add frames, borders, margins, text, drop shadows, or vignettes"
  }
}
```

## Impressionist Style

```json
{
  "name": "impressionist-v1",
  "style": {
    "artistic_movement": "Impressionist-style",
    "medium": "soft brushstrokes and oil paint texture",
    "palette_description": "Vibrant colors with visible brushwork, capturing light and atmosphere",
    "composition": "Full-bleed, edge-to-edge composition that reaches all four sides; seamless continuation to neighboring tiles",
    "constraints": "Do not add frames, borders, margins, text, drop shadows, or vignettes"
  }
}
```

## Art Nouveau Style

```json
{
  "name": "art-nouveau-v1",
  "style": {
    "artistic_movement": "Art Nouveau-style",
    "medium": "flowing lines and organic forms",
    "palette_description": "Natural color palette with elegant curves and botanical motifs",
    "composition": "Full-bleed, edge-to-edge composition that reaches all four sides; seamless continuation to neighboring tiles",
    "constraints": "Do not add frames, borders, margins, text, drop shadows, or vignettes"
  }
}
```

## Abstract Expressionist Style

```json
{
  "name": "abstract-expressionist-v1",
  "style": {
    "artistic_movement": "Abstract Expressionist-style",
    "medium": "bold gestural brushstrokes and mixed media",
    "palette_description": "Bold, emotional color palette with dynamic forms and textures",
    "composition": "Full-bleed, edge-to-edge composition that reaches all four sides; seamless continuation to neighboring tiles",
    "constraints": "Do not add frames, borders, margins, text, drop shadows, or vignettes"
  }
}
```

## Minimalist Style

```json
{
  "name": "minimalist-v1",
  "style": {
    "artistic_movement": "Minimalist-style",
    "medium": "clean lines and simple forms",
    "palette_description": "Limited color palette, emphasis on negative space and geometric simplicity",
    "composition": "Full-bleed, edge-to-edge composition that reaches all four sides; seamless continuation to neighboring tiles",
    "constraints": "Do not add frames, borders, margins, text, drop shadows, or vignettes"
  }
}
```

## Watercolor Style

```json
{
  "name": "watercolor-v1",
  "style": {
    "artistic_movement": "Watercolor-style",
    "medium": "transparent washes and wet-on-wet technique",
    "palette_description": "Soft, flowing colors with natural bleeding and transparency effects",
    "composition": "Full-bleed, edge-to-edge composition that reaches all four sides; seamless continuation to neighboring tiles",
    "constraints": "Do not add frames, borders, margins, text, drop shadows, or vignettes"
  }
}
```

## How to Switch Styles

1. **Backup your current `config.json`** (optional)
2. **Replace the `style` section** in `config.json` with any of the examples above
3. **Update the `name`** field to match the new style
4. **Restart your application** for changes to take effect
5. **Generate new tiles** - they will now use the new artistic style!

## Creating Custom Styles

You can create your own styles by modifying these fields:

- **`artistic_movement`**: The main artistic style (e.g., "Photorealistic", "Manga-style", "Pixel art")
- **`medium`**: The artistic medium or technique (e.g., "digital painting", "pencil sketch", "acrylic paint")
- **`palette_description`**: Color and visual characteristics (e.g., "warm sunset colors", "monochromatic blue tones")
- **`composition`**: Layout rules (usually keep the seamless tiling requirement)
- **`constraints`**: What to avoid (usually keep the no-frames rule for seamless tiles)

The AI will interpret these descriptions and apply them to all generated artwork consistently across your infinite canvas.
