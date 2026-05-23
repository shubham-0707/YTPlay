# YTPlay 🎵

Supercharge YouTube Music with keyboard shortcuts and multilingual voice search.

A lightweight Chrome extension that adds keyboard shortcuts and voice search to YouTube Music's web player — no clicking needed.

## Features

### Keyboard Shortcuts (work without clicking the player first)

| Key | Single Press | Double Press |
|-----|-------------|--------------|
| → Right Arrow | Skip forward 10s | Next song |
| ← Left Arrow | Rewind 10s | Previous song |
| ↑ Up Arrow | Volume up 5% | — |
| ↓ Down Arrow | Volume down 5% | — |
| M | Open voice search | — |

### Voice Search

YouTube Music's website doesn't have voice search (the mobile app does, but not the web). YTPillowPlay adds it.

- Press **M** or click the mic icon next to the search bar
- Speak any song, artist, or album name
- Auto-searches after 1 second of silence
- Pauses the current song while listening (so the mic doesn't pick up music)

### Multilingual Support

- **Hinglish mode** (default): Recognizes Hindi/Hinglish and transliterates to Roman script for clean search history
- **English mode**: For English and foreign language songs (Spanish, Korean, etc.)
- Toggle with **Space** key while mic is open
- Switch between 10 languages with **Tab** key
- Your preference persists across sessions

### Supported Languages

Hindi, English, Spanish, Korean, Japanese, French, Arabic, Portuguese, German, Chinese

## Installation

1. Clone this repo or download as ZIP
2. Open Chrome → `chrome://extensions`
3. Enable **Developer mode** (toggle in top-right)
4. Click **"Load unpacked"**
5. Select the `YTPlay` folder
6. Go to [music.youtube.com](https://music.youtube.com) and enjoy!

## How It Works

- Runs as a content script on `music.youtube.com`
- Captures keyboard events in the DOM capture phase — no need to click the player bar first
- Uses Chrome's Web Speech API for voice recognition
- Transliterates Devanagari to Roman via Google Translate API (free tier)
- Injects a mic icon next to the search bar for mouse users
- Uses `localStorage` to persist language preferences

## Compatibility

- **Browsers**: Chrome, Edge, Brave, Opera, Vivaldi (any Chromium-based browser)
- **OS**: Windows, macOS, Linux
- **Manifest**: V3 (latest Chrome extension standard)

## Tech Stack

- Vanilla JavaScript (zero dependencies)
- Chrome Extension Manifest V3
- Web Speech API
- Google Translate API (free transliteration endpoint)

## Screenshots

*Coming soon — voice search overlay and keyboard controls in action*

## Why I Built This

YouTube Music's web player lacks keyboard shortcuts that work without focusing the player, and has no voice search (unlike the mobile app). I wanted hands-free control — skip songs, adjust volume, and search by voice without touching the mouse.

So I built YTPlay. Now I control everything with keyboard shortcuts and voice commands.

## License

MIT
