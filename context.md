# Francis Evan — Portfolio Context

## Project Identity
A premium, minimalist photography and motion portfolio built for Francis Evan (Van). The design emphasizes typography (Cormorant Garamond, DM Mono), smooth transitions, and extreme performance.

## Technology Stack
- **Frontend**: Vanilla HTML5, CSS3, ES6 JavaScript.
- **Bundler**: [Vite](https://vitejs.dev/) for development and production builds.
- **Server fallback**: Python `http.server` (port 5173).
- **Backend/Tooling**: Node.js scripts for image processing (Sharp).

---

## Technical Architecture

### 1. Data Structures (photos.js & videos.js)
The site is data-driven, separating photography and motion content.
- **Photography**: `photos.js` contains the image database with aspect ratios and categories.
- **Motion**: `videos.js` manages motion projects, including video URLs, descriptions, and specialized blur placeholders.
- **Ordering**: Handled by `scripts/sort-photos.js` (newest first).

### 2. Performance Suite
To achieve buttery smooth 60fps on all devices, the site uses:
- **Gaussian Blur Pre-Gen**: Backgrounds and motion-lightbox backdrops are generated as static images to avoid heavy GPU costs.
- **Thumbnail Hand-off**: The lightbox system loads sequential assets (Blur -> Thumb -> Original/Video) to ensure zero-stutter transitions.
- **Resource Pausing**: Background hero animations and glow effects are paused when any lightbox is active.
- **CLS Prevention**: Hardcoded `aspectRatio` metadata ensures layout stability.

### 3. Motion System
The motion section uses a custom player shell built on top of Video.js components.
- **Start Triggers**: A custom start button handles initial playback to satisfy browser mute/autoplay policies.
- **Dynamic Backgrounds**: The motion lightbox uses a dedicated blur layer (`motion-blur-layer`) that mirrors the video thumbnail for an immersive feel.

### 4. Protected Animations
Sections of `style.css` and the JS logic are marked with `/* !!! DONT TOUCH !!! */`. These blocks contain performance-critical transition timings. Modification is restricted to avoid breaking the frame-rate balance.

---

## Development Workflow

### Adding New Content
1. **Upload**: Place assets in `/photos` or relevant video directories.
2. **Metadata**: Update the arrays in `photos.js` or `videos.js`.
3. **Sequence**:
    - `npm run sort`
    - `node scripts/add-ratios.js`
    - `node scripts/generate-thumbs.js`
    - `node scripts/generate-blur.js`

### Testing
- **Local**: `npm run dev -- --host`
- **Firefox**: Verify lightbox navigation and blur rendering performance.

---

## Guidelines for AI Assistant
- **Maintain Minimalism**: Do not suggest heavy libraries. Stick to Vanilla.
- **Visual Excellence**: Animations must be smooth. Use transform and opacity only.
- **Strict Adherence**: Never remove "PROTECT" comments or modify the logic within them without explicit permission.
