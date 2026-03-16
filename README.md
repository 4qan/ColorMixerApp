# Color Mixer

**"Baba, what happens if you mix red and blue?"**

This app exists because my son won't stop asking what colors make when you mix them together, and I got tired of guessing wrong. Now he can find out himself, and the answers are actually backed by real paint science.

**[Try it live](https://4qan.github.io/ColorMixerApp/)**

## What it does

A simple, kid-friendly color mixing app that simulates how real paint behaves. Tap colors, see what you get.

- **Physically accurate mixing** using [Mixbox](https://github.com/scrtwpns/mixbox) (Kubelka-Munk spectral pigment model). Blue + Yellow = Green, not gray.
- **Voice input**: say "mix red and blue" and it does. Great for kids who can't read yet.
- **Adjustable amounts**: sliders to control how much of each color goes in (1x to 10x).
- **30 colors** to pick from, with an expandable palette.
- **Installable PWA**: works offline, add to home screen on any device.
- **No backend, no tracking, no ads.** Single HTML file + Mixbox library.

## Tech

- Single-file vanilla HTML/CSS/JS (no framework, no build step)
- [Mixbox](https://scrtwpns.com/mixbox/) for spectral pigment mixing
- Web Speech API for voice recognition
- Service Worker for offline support
- Deployed via GitHub Pages

## Why Mixbox?

Most color mixing apps average RGB values, which produces wrong results (yellow + blue = gray). Mixbox decomposes colors into pigment concentrations and mixes them using Kubelka-Munk theory, the same physics that governs real paint. The results match what you'd actually see mixing paints on a palette.

Based on: Sochorova & Jamriska, "Practical Pigment Mixing for Digital Painting" (SIGGRAPH Asia 2021).

## License

This project's code is MIT licensed.

**Mixbox** (`mixbox.js`) is Copyright (c) 2022 Secret Weapons and licensed under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/). Non-commercial use only. For commercial licensing, see [scrtwpns.com/mixbox](https://scrtwpns.com/mixbox/).
