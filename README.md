# vanpics-portfolio

my photography & motion portfolio. minimal, typographic, smooth.

[**live site: vanpics.pages.dev**](https://vanpics.pages.dev)

<!-- TODO: HERO SHOT. full-width screenshot of the homepage with the masonry grid (1600px wide is plenty). save as docs/hero.png -->
![vanpics homepage](docs/hero.png)

## why this exists

google photos felt too impersonal for the pictures i actually care about. so i built a place where every photo gets a caption that works like a scrapbook page: sometimes a full diary entry about how and why i took it, sometimes just a vague one-liner. the site is built around that, not just around showing images.

## what it does

- **masonry grid gallery** with category filtering
- **custom lightbox** with thumbnail hand-off and filmstrip nav
- **pre-calculated aspect ratios** so nothing jumps around on load
- **swipe gestures** on mobile
- **blurred glass backgrounds** in the lightbox, generated from the photo's own thumbnail

### demo

<!-- TODO: GIF 1. category filtering in the grid, click a filter and the masonry reflows. 5 to 8 sec, under 5MB. save as docs/filtering.gif -->
![category filtering](docs/filtering.gif)

<!-- TODO: GIF 2. open a photo, thumbnail expands into the lightbox, then scroll through the filmstrip. save as docs/lightbox.gif -->
![lightbox hand-off and filmstrip](docs/lightbox.gif)

<!-- TODO: GIF or phone screenshot. swipe gestures on mobile, ideally a screen recording from your phone. save as docs/mobile.gif -->
![mobile swipe](docs/mobile.gif)

<!-- TODO: OPTIONAL. screenshot of a photo with a long diary-style caption, since the captions are the whole point. save as docs/caption.png -->
![caption example](docs/caption.png)

## stack

- html / css / vanilla js
- [vite](https://vitejs.dev/) for the dev server and static production build
- node + [sharp](https://sharp.pixelplumbing.com/) for image processing
- hosted on cloudflare pages
- fonts: cormorant garamond & dm mono

dev: `npm install && npm run dev`

<!-- TODO: if the darkroom CMS (workers, d1, r2) or the webgl effects live in this repo, add them to the list above. if they live elsewhere, link that repo here. delete this comment either way -->

## license

photos © francis evan. all rights reserved. don't use them without asking.

<!-- TODO: pick a license for the code (MIT is the usual move) and add a LICENSE file, then add a line like "code: MIT" here -->
