# Francis Evan — Portfolio

A high-performance, aesthetically driven photography and motion portfolio. Built with a focus on minimalism, typography, and buttery-smooth interactions.

> "pics by van"

## Features

- **Performance First**: Zero Layout Shift (CLS) via pre-calculated aspect ratios.
- **Hybrid Lightbox**: Custom-built lightbox with thumbnail hand-off and hardware-accelerated animations.
- **Optimization Engine**: Pre-generated Gaussian blur backgrounds to ensure high frame rates on Firefox and mobile devices.
- **Refined UX**: Smooth modal transitions, mobile swipe gestures, and a specialized "Filmstrip" navigation.

## Tech Stack

- **Core**: Semantic HTML5, Vanilla JavaScript (ES6+), Modern CSS.
- **Bundler**: [Vite](https://vitejs.dev/)
- **Processing**: Node.js & Sharp for image automation.
- **Typography**: Cormorant Garamond & DM Mono.

## Getting Started

### Prerequisites

- Node.js (Latest LTS recommended)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Vancis5/vanpics-portfolio.git
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

### Development

Start the Vite dev server:
```bash
npm run dev
```

For mobile testing on your local network:
```bash
npm run dev -- --host
```

## Workflow & Image Processing

The project includes a suite of Node.js utilities to maintain performance:

- **Sort**: `npm run sort` — Sorts the gallery chronologically.
- **Metadata**: `node scripts/add-ratios.js` — Scans photos and updates aspect ratios in the data file.
- **Thumbnails**: `node scripts/generate-thumbs.js` — Generates gallery thumbnails.
- **Optimization**: `node scripts/generate-blur.js` — Generates ultra-fast blurred background assets.

## License

© Francis Evan. All rights reserved. Images and content are the property of the author and may not be used without permission.
