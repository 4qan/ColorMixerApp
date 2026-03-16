# Color Mixer

**"Baba, what happens if you mix red and blue?"**

This app exists because my son won't stop asking what colors make when you mix them together, and I got tired of guessing wrong. Now he can find out himself, and the answers are actually backed by real paint science.

**[Try it live](https://4qan.github.io/ColorMixerApp/)**

## What it does

A simple, kid-friendly color mixing app that simulates how real paint behaves. Tap colors, see what you get.

- **Physically accurate mixing** using [Mixbox](https://github.com/scrtwpns/mixbox) (Kubelka-Munk spectral pigment model). Blue + Yellow = Green, not gray.
- **Intuitive color names** from the [XKCD color survey](https://blog.xkcd.com/2010/05/03/color-survey-results/) (891 names crowdsourced from 200k+ people). Every mix gets a distinct, everyday-English name like "Rust Orange" or "Dull Brown", not generic labels like "Vermilion." Palette colors use XKCD hex values so inputs and outputs are consistent within the same color space.
- **Adjustable amounts**: sliders to control how much of each color goes in (1x to 10x).
- **30 colors** to pick from, with an expandable palette.
- **Installable PWA**: works offline, add to home screen on any device.
- **No backend, no tracking, no ads.** Single HTML file + supporting libraries.

## Tech

- Single-file vanilla HTML/CSS/JS (no framework, no build step)
- [Mixbox](https://scrtwpns.com/mixbox/) for spectral pigment mixing
- [XKCD color survey](https://xkcd.com/color/rgb/) for human-friendly color naming (palette colors also use XKCD hex values)
- Service Worker for offline support
- Deployed via GitHub Pages

## Why Mixbox?

Most color mixing apps average RGB values, which produces wrong results (yellow + blue = gray). Mixbox decomposes colors into pigment concentrations and mixes them using Kubelka-Munk theory, the same physics that governs real paint. The results match what you'd actually see mixing paints on a palette.

Based on: Sochorova & Jamriska, "Practical Pigment Mixing for Digital Painting" (SIGGRAPH Asia 2021).

## License

This project's code is MIT licensed.

**Mixbox** (`mixbox.js`) is Copyright (c) 2022 Secret Weapons and licensed under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/). Non-commercial use only. For commercial licensing, see [scrtwpns.com/mixbox](https://scrtwpns.com/mixbox/).

**XKCD color data** (`xkcd_colors.js`) is derived from the [XKCD color survey](https://xkcd.com/color/rgb/) and is in the [public domain (CC0)](https://creativecommons.org/publicdomain/zero/1.0/).
