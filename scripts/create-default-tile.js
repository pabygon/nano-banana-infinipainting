const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function createDefaultTile() {
  const tile = await sharp({
    create: {
      width: 256,
      height: 256,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  })
  .png()
  .toBuffer();

  // Add a simple grid pattern
  const svg = Buffer.from(`
    <svg width="256" height="256" xmlns="http://www.w3.org/2000/svg">
      <rect width="256" height="256" fill="#ffffff"/>
      <g stroke="#707070" stroke-width="1" fill="none">
        <line x1="0" y1="0" x2="256" y2="0"/>
        <line x1="0" y1="256" x2="256" y2="256"/>
        <line x1="0" y1="0" x2="0" y2="256"/>
        <line x1="256" y1="0" x2="256" y2="256"/>
        <line x1="128" y1="0" x2="128" y2="256" stroke-dasharray="4,4"/>
        <line x1="0" y1="128" x2="256" y2="128" stroke-dasharray="4,4"/>
      </g>
    </svg>
  `);

  const finalTile = await sharp(svg)
    .webp({ quality: 90 })
    .toBuffer();

  const publicDir = path.join(__dirname, '..', 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir);
  }

  fs.writeFileSync(path.join(publicDir, 'default-tile.webp'), finalTile);
  console.log('Default tile created at public/default-tile.webp');
}

createDefaultTile().catch(console.error);