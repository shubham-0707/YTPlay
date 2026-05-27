/**
 * YT Music Arrow Shortcuts v3.0
 *
 * Right Arrow x1  → seek forward 10s
 * Right Arrow x2  → next track
 * Left Arrow x1   → seek backward 10s
 * Left Arrow x2   → previous track
 * Up Arrow        → volume up 5%
 * Down Arrow      → volume down 5%
 * 'M' key         → voice search (multilingual)
 */

(() => {
  "use strict";

  const DOUBLE_TAP_WINDOW_MS = 300;
  const SEEK_SECONDS = 10;
  const VOLUME_STEP = 5;
  const SILENCE_TIMEOUT_MS = 1000;

  let lastRightTime = 0;
  let lastLeftTime = 0;
  let rightTimer = null;
  let leftTimer = null;

  // ─── Player Controls ───────────────────────────────────────────────

  function getVideo() {
    return document.querySelector("video");
  }

  function seekForward(seconds) {
    const video = getVideo();
    if (video) video.currentTime = Math.min(video.currentTime + seconds, video.duration);
  }

  function seekBackward(seconds) {
    const video = getVideo();
    if (video) video.currentTime = Math.max(video.currentTime - seconds, 0);
  }

  function nextTrack() {
    const btn = document.querySelector(".next-button.ytmusic-player-bar")
      || document.querySelector("tp-yt-paper-icon-button.next-button")
      || document.querySelector("[aria-label='Next']")
      || document.querySelector(".next-button");
    if (btn) btn.click();
  }

  function previousTrack() {
    const btn = document.querySelector(".previous-button.ytmusic-player-bar")
      || document.querySelector("tp-yt-paper-icon-button.previous-button")
      || document.querySelector("[aria-label='Previous']")
      || document.querySelector(".previous-button");
    if (btn) btn.click();
  }

  function changeVolume(delta) {
    const video = getVideo();
    if (!video) return;
    const newVol = Math.max(0, Math.min(1, video.volume + delta / 100));
    video.volume = newVol;
    const slider = document.querySelector("#volume-slider");
    if (slider) slider.value = Math.round(newVol * 100);
    showVolumeToast(Math.round(newVol * 100));
  }

  function showVolumeToast(percent) {
    let toast = document.getElementById("ytms-volume-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "ytms-volume-toast";
      Object.assign(toast.style, {
        position: "fixed",
        top: "10%",
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(0,0,0,0.85)",
        color: "#fff",
        padding: "10px 24px",
        borderRadius: "8px",
        fontSize: "15px",
        fontFamily: "'Google Sans', Roboto, sans-serif",
        zIndex: "99999",
        transition: "opacity 0.3s",
        pointerEvents: "none",
      });
      document.body.appendChild(toast);
    }
    toast.textContent = `🔊 ${percent}%`;
    toast.style.opacity = "1";
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => { toast.style.opacity = "0"; }, 800);
  }

  // ─── Voice Search (Multilingual) ──────────────────────────────────

  let micActive = false;
  let recognition = null;
  let wasPlayingBeforeMic = false;

  const LANG_OPTIONS = [
    { code: "hi-IN", label: "हिंदी / Hinglish" },
    { code: "en-US", label: "English" },
    { code: "es-ES", label: "Español" },
    { code: "ko-KR", label: "한국어" },
    { code: "ja-JP", label: "日本語" },
    { code: "fr-FR", label: "Français" },
    { code: "ar-SA", label: "العربية" },
    { code: "pt-BR", label: "Português" },
    { code: "de-DE", label: "Deutsch" },
    { code: "zh-CN", label: "中文" },
  ];
  let hinglishOutput = localStorage.getItem("ytms-hinglish") !== "false";
  let micLang = hinglishOutput ? "hi-IN" : "en-US";
  let currentLangIndex = LANG_OPTIONS.findIndex(l => l.code === micLang);
  if (currentLangIndex < 0) currentLangIndex = 0;

  function injectMicStyles() {
    if (document.getElementById("ytms-mic-styles")) return;
    const style = document.createElement("style");
    style.id = "ytms-mic-styles";
    style.textContent = `
      #ytms-mic-overlay {
        position: fixed;
        inset: 0;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding-top: 12vh;
        background: rgba(0, 0, 0, 0.85);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        z-index: 999999;
        animation: ytms-fade-in 0.15s ease;
      }
      @keyframes ytms-fade-in {
        from { opacity: 0; transform: scale(0.98); }
        to { opacity: 1; transform: scale(1); }
      }
      #ytms-mic-card {
        background: #212121;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 24px;
        padding: 48px 56px;
        min-width: 420px;
        max-width: 540px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 24px;
        box-shadow: 0 24px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05);
        font-family: 'YouTube Sans', 'Google Sans', Roboto, -apple-system, sans-serif;
      }
      #ytms-mic-icon-ring {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        background: #cc0000;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: ytms-pulse 1.5s ease-in-out infinite;
        cursor: pointer;
      }
      @keyframes ytms-pulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(204, 0, 0, 0.4); transform: scale(1); }
        50% { box-shadow: 0 0 0 18px rgba(204, 0, 0, 0); transform: scale(1.05); }
      }
      #ytms-mic-icon-ring svg {
        width: 36px;
        height: 36px;
        fill: #fff;
      }
      #ytms-mic-title {
        color: #fff;
        font-size: 20px;
        font-weight: 500;
        margin-top: -4px;
      }
      #ytms-mic-status {
        color: #aaa;
        font-size: 14px;
        font-weight: 400;
        letter-spacing: 0.3px;
      }
      #ytms-mic-transcript {
        color: #fff;
        font-size: 24px;
        font-weight: 400;
        text-align: center;
        min-height: 36px;
        line-height: 1.4;
        word-break: break-word;
        padding: 0 12px;
      }
      #ytms-mic-divider {
        width: 100%;
        height: 1px;
        background: rgba(255,255,255,0.08);
        margin: 4px 0;
      }
      #ytms-mic-controls {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      #ytms-mic-lang {
        color: #aaa;
        font-size: 13px;
        font-weight: 500;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.1);
        padding: 6px 16px;
        border-radius: 18px;
        cursor: pointer;
        transition: all 0.15s;
      }
      #ytms-mic-lang:hover {
        background: rgba(255,255,255,0.1);
        color: #fff;
        border-color: rgba(255,255,255,0.2);
      }
      #ytms-mic-toggle {
        color: #aaa;
        font-size: 13px;
        font-weight: 500;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.1);
        padding: 6px 16px;
        border-radius: 18px;
        cursor: pointer;
        transition: all 0.15s;
      }
      #ytms-mic-toggle:hover {
        background: rgba(255,255,255,0.1);
        color: #fff;
        border-color: rgba(255,255,255,0.2);
      }
      #ytms-mic-toggle.off {
        color: #666;
        border-color: rgba(255,255,255,0.06);
      }
      #ytms-mic-hint {
        color: #999;
        font-size: 12px;
        margin-top: 4px;
        display: flex;
        gap: 12px;
        align-items: center;
      }
      .ytms-hint-key {
        background: rgba(255,255,255,0.1);
        border: 1px solid rgba(255,255,255,0.2);
        color: #fff;
        padding: 3px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
        font-family: monospace;
      }
      .ytms-hint-item {
        display: flex;
        align-items: center;
        gap: 5px;
      }
    `;
    document.head.appendChild(style);
  }

  function showMicUI() {
    injectMicStyles();
    let overlay = document.getElementById("ytms-mic-overlay");
    if (overlay) overlay.remove();

    overlay = document.createElement("div");
    overlay.id = "ytms-mic-overlay";
    overlay.innerHTML = `
      <div id="ytms-mic-card">
        <div id="ytms-mic-title">Listening...</div>
        <div id="ytms-mic-icon-ring">
          <svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
        </div>
        <div id="ytms-mic-status">Say a song, artist, or album</div>
        <div id="ytms-mic-transcript"></div>
        <div id="ytms-mic-divider"></div>
        <div id="ytms-mic-controls">
          <div id="ytms-mic-lang"></div>
          <div id="ytms-mic-toggle"></div>
        </div>
        <div id="ytms-mic-hint">
          <span class="ytms-hint-item"><span class="ytms-hint-key">Tab</span> language</span>
          <span class="ytms-hint-item"><span class="ytms-hint-key">Space</span> toggle mode</span>
          <span class="ytms-hint-item"><span class="ytms-hint-key">Esc</span> cancel</span>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeMicUI();
    });
    document.getElementById("ytms-mic-lang").addEventListener("click", cycleLang);
    document.getElementById("ytms-mic-toggle").addEventListener("click", toggleHinglish);
    // Set initial state from persisted preference
    const langEl = document.getElementById("ytms-mic-lang");
    const toggleEl = document.getElementById("ytms-mic-toggle");
    if (hinglishOutput) {
      langEl.textContent = "🌐 हिंदी / Hinglish";
      toggleEl.textContent = "🅰️ Hinglish mode — speaks Hindi/Hinglish";
    } else {
      langEl.textContent = "🌐 English";
      toggleEl.textContent = "🅰️ English mode — speaks English/Foreign";
      toggleEl.classList.add("off");
    }
  }

  function toggleHinglish() {
    hinglishOutput = !hinglishOutput;
    localStorage.setItem("ytms-hinglish", hinglishOutput.toString());
    const el = document.getElementById("ytms-mic-toggle");
    if (hinglishOutput) {
      micLang = "hi-IN";
      currentLangIndex = 0;
      if (el) {
        el.textContent = "🅰️ Hinglish mode — speaks Hindi/Hinglish";
        el.classList.remove("off");
      }
      const langEl = document.getElementById("ytms-mic-lang");
      if (langEl) langEl.textContent = "🌐 हिंदी / Hinglish";
    } else {
      micLang = "en-US";
      currentLangIndex = 1;
      if (el) {
        el.textContent = "🅰️ English mode — speaks English/Foreign";
        el.classList.add("off");
      }
      const langEl = document.getElementById("ytms-mic-lang");
      if (langEl) langEl.textContent = "🌐 English";
    }
    // Restart recognition with new lang
    if (recognition) {
      recognition.abort();
      recognition = null;
    }
    startRecognition();
  }

  function closeMicUI() {
    if (recognition) {
      recognition.abort();
      recognition = null;
    }
    micActive = false;
    resumePlayback();
    const overlay = document.getElementById("ytms-mic-overlay");
    if (overlay) overlay.remove();
  }

  function pausePlayback() {
    const video = getVideo();
    if (video && !video.paused) {
      wasPlayingBeforeMic = true;
      video.pause();
    } else {
      wasPlayingBeforeMic = false;
    }
  }

  function resumePlayback() {
    if (wasPlayingBeforeMic) {
      const video = getVideo();
      if (video) video.play();
      wasPlayingBeforeMic = false;
    }
  }

  function cycleLang() {
    currentLangIndex = (currentLangIndex + 1) % LANG_OPTIONS.length;
    micLang = LANG_OPTIONS[currentLangIndex].code;
    const label = LANG_OPTIONS[currentLangIndex].label;
    const el = document.getElementById("ytms-mic-lang");
    if (el) el.textContent = `🌐 ${label}`;
    if (recognition) {
      recognition.abort();
      recognition = null;
    }
    startRecognition();
  }

  function startRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = micLang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 5;

    let silenceTimer = null;

    recognition.onresult = (event) => {
      let interim = "";
      let final = "";

      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      const display = final || interim;
      if (display) {
        const el = document.getElementById("ytms-mic-transcript");
        if (el) el.textContent = `"${display}"`;
        const title = document.getElementById("ytms-mic-title");
        if (title) title.textContent = final ? "Got it! Searching..." : "Listening...";
        const status = document.getElementById("ytms-mic-status");
        if (status) status.textContent = "";
      }

      clearTimeout(silenceTimer);
      if (final || display) {
        silenceTimer = setTimeout(() => {
          const query = (final || display).trim();
          if (query) {
            performSearch(query);
            closeMicUI();
          }
        }, SILENCE_TIMEOUT_MS);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "permission-denied") {
        const title = document.getElementById("ytms-mic-title");
        if (title) title.textContent = "Mic access denied";
        const el = document.getElementById("ytms-mic-transcript");
        if (el) el.textContent = "Allow microphone in browser settings";
        setTimeout(closeMicUI, 2000);
      } else if (event.error === "no-speech") {
        if (micActive) try { recognition.start(); } catch(e) {}
      }
    };

    recognition.onend = () => {
      if (micActive) {
        try { recognition.start(); } catch(e) {}
      }
    };

    try { recognition.start(); } catch(e) {}
  }

  function openVoiceSearch() {
    if (micActive) { closeMicUI(); return; }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition not supported. Please use Chrome.");
      return;
    }

    pausePlayback();
    micActive = true;
    showMicUI();
    startRecognition();
  }

  async function performSearch(query) {
    if (!query) return;
    wasPlayingBeforeMic = false;

    // If Hinglish output is ON and query contains Devanagari, transliterate
    let searchQuery = query;
    if (hinglishOutput && /[ऀ-ॿ]/.test(query)) {
      try {
        const romanized = await transliterateViaGoogle(query);
        if (romanized) searchQuery = romanized;
      } catch (e) {
        // Fallback: use raw query if API fails
        console.warn("[YT Music Shortcuts] Transliteration failed, using raw:", e);
      }
    }

    window.location.href = `https://music.youtube.com/search?q=${encodeURIComponent(searchQuery)}`;
  }

  /**
   * Uses Google Translate API (free tier) to transliterate Devanagari → Roman.
   * This gives proper results: "बैड बनी" → "bad bunny", "सनम रे" → "sanam re"
   */
  async function transliterateViaGoogle(text) {
    // Google Translate's transliterate endpoint
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=hi&tl=en&dt=rm&q=${encodeURIComponent(text)}`;

    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();

    // The romanization is in data[0][i][3] for each segment
    // Or we can use the transliteration from data[3] if available
    // Format: data[0] = [[translated, original, pronunciation, romanized], ...]

    // Try to get romanized form from the response
    let romanized = "";

    // data[0] contains sentence segments
    if (data && data[0]) {
      for (const segment of data[0]) {
        // segment[3] is the romanized/transliterated form of the source
        if (segment && segment[3]) {
          romanized += segment[3];
        }
      }
    }

    // If no romanization found, check if there's a phonetic transcription
    if (!romanized && data && data[0]) {
      for (const segment of data[0]) {
        // segment[0] is the translated text (English) — use as fallback
        if (segment && segment[0]) {
          romanized += segment[0];
        }
      }
    }

    return romanized.trim() || null;
  }

  // ─── Utility ───────────────────────────────────────────────────────

  function isTyping(event) {
    const tag = event.target.tagName.toLowerCase();
    if (tag === "input" || tag === "textarea") return true;
    if (event.target.isContentEditable) return true;
    return false;
  }

  // ─── Main Key Handler ──────────────────────────────────────────────

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape" && micActive) { closeMicUI(); return; }
      if (event.key === "Tab" && micActive) {
        event.stopPropagation();
        event.preventDefault();
        cycleLang();
        return;
      }
      if (event.key === " " && micActive) {
        event.stopPropagation();
        event.preventDefault();
        toggleHinglish();
        return;
      }
      if (isTyping(event)) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const key = event.key;

      if (key === "ArrowRight" && !event.shiftKey) {
        event.stopPropagation();
        event.preventDefault();
        const now = Date.now();
        if (now - lastRightTime < DOUBLE_TAP_WINDOW_MS) {
          clearTimeout(rightTimer); lastRightTime = 0; nextTrack();
        } else {
          lastRightTime = now;
          rightTimer = setTimeout(() => { seekForward(SEEK_SECONDS); lastRightTime = 0; }, DOUBLE_TAP_WINDOW_MS);
        }
        return;
      }

      if (key === "ArrowLeft" && !event.shiftKey) {
        event.stopPropagation();
        event.preventDefault();
        const now = Date.now();
        if (now - lastLeftTime < DOUBLE_TAP_WINDOW_MS) {
          clearTimeout(leftTimer); lastLeftTime = 0; previousTrack();
        } else {
          lastLeftTime = now;
          leftTimer = setTimeout(() => { seekBackward(SEEK_SECONDS); lastLeftTime = 0; }, DOUBLE_TAP_WINDOW_MS);
        }
        return;
      }

      if (key === "ArrowUp") {
        event.stopPropagation(); event.preventDefault(); changeVolume(VOLUME_STEP); return;
      }
      if (key === "ArrowDown") {
        event.stopPropagation(); event.preventDefault(); changeVolume(-VOLUME_STEP); return;
      }
      if ((key === "m" || key === "M") && !event.shiftKey) {
        event.stopPropagation(); event.preventDefault(); openVoiceSearch(); return;
      }
    },
    true
  );

  // ─── Inject Mic Icon next to YT Music Search Bar ───────────────────

  function injectMicButton() {
    if (document.getElementById("ytms-mic-btn")) return;

    const searchBox = document.querySelector("ytmusic-search-box");
    if (!searchBox) {
      setTimeout(injectMicButton, 1000);
      return;
    }

    const btn = document.createElement("button");
    btn.id = "ytms-mic-btn";
    btn.title = "YTPlay — Voice Search (M)";
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z"/>
        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
      </svg>
    `;
    Object.assign(btn.style, {
      background: "rgba(255,255,255,0.08)",
      border: "1px solid rgba(255,255,255,0.15)",
      color: "rgba(255,255,255,0.8)",
      cursor: "pointer",
      padding: "8px",
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "all 0.2s",
      marginLeft: "10px",
      flexShrink: "0",
    });
    btn.addEventListener("mouseenter", () => {
      btn.style.color = "#fff";
      btn.style.background = "rgba(255,255,255,0.15)";
      btn.style.borderColor = "rgba(255,255,255,0.3)";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.color = "rgba(255,255,255,0.8)";
      btn.style.background = "rgba(255,255,255,0.08)";
      btn.style.borderColor = "rgba(255,255,255,0.15)";
    });
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openVoiceSearch();
    });

    // Insert right after the search box element
    searchBox.parentElement.insertBefore(btn, searchBox.nextSibling);
  }

  // Wait for page to fully load, then inject
  if (document.readyState === "complete") {
    injectMicButton();
  } else {
    window.addEventListener("load", injectMicButton);
  }
  // Also observe DOM changes in case of SPA navigation
  const observer = new MutationObserver(() => {
    if (!document.getElementById("ytms-mic-btn")) injectMicButton();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // ─── Spotify-like Synced Lyrics (LRCLIB) v6.1 ────────────────────────

  (function initLyrics() {
    /**
     * ARCHITECTURE v7.0 — "Event-Driven + Single Source of Truth"
     *
     * Key principles:
     * - videoId is the SOLE source of truth for song identity
     * - MutationObserver on title element for instant change detection
     * - video `timeupdate` event drives lyrics sync (no polling for highlight)
     * - video `loadstart`/`playing` events detect stream readiness
     * - Generation counter discards stale async work
     * - NEVER pause or interfere with playback
     */

    let loadedForVideoId = "";
    let loadGeneration = 0;
    let isLoading = false;
    let timings = [];
    let lineEls = [];
    let isSynced = false;
    let activeLine = -1;
    let lastVideoId = "";        // Last videoId we acted on (dedup)
    let streamReady = false;     // Whether new stream has started (currentTime reset)

    // Lyrics cache: avoids re-fetching on tab switches
    const lyricsCache = new Map(); // "title|artist" → lrc result

    function getCurrentVideoId() {
      const params = new URLSearchParams(window.location.search);
      return params.get("v") || "";
    }

    function injectStyles() {
      if (document.getElementById("ytms-lyrics-styles")) return;
      const s = document.createElement("style");
      s.id = "ytms-lyrics-styles";
      s.textContent = `
        /* Hide native lyrics ONLY when our content is present */
        ytmusic-description-shelf-renderer:has(#ytms-lyrics-overlay) .description,
        ytmusic-description-shelf-renderer:has(#ytms-lyrics-loader) .description {
          visibility: hidden !important;
          height: 0 !important;
          overflow: hidden !important;
          position: absolute !important;
        }
        #ytms-lyrics-overlay {
          padding: 32px 8px;
          overflow-y: auto;
          max-height: 65vh;
          scroll-behavior: smooth;
          border-radius: 16px;
          mask-image: linear-gradient(to bottom, transparent 0%, black 5%, black 90%, transparent 100%);
          -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 5%, black 90%, transparent 100%);
        }
        #ytms-lyrics-overlay .ytms-line {
          color: rgba(255,255,255,0.28);
          font-size: 24px;
          font-weight: 700;
          padding: 14px 12px;
          line-height: 1.45;
          border-radius: 8px;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          letter-spacing: -0.3px;
        }
        #ytms-lyrics-overlay .ytms-line:hover {
          color: rgba(255,255,255,0.5);
          background: rgba(255, 0, 0, 0.08);
        }
        #ytms-lyrics-overlay .ytms-line.active {
          background: linear-gradient(90deg, #ff0000, #ff4e45, #ff8c00);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          font-size: 30px;
          font-weight: 800;
          padding: 16px 12px;
          transform: translateX(4px);
          animation: ytms-glow 2s ease-in-out infinite;
        }
        #ytms-lyrics-overlay .ytms-line.past {
          color: rgba(255,255,255,0.4);
        }
        #ytms-lyrics-overlay.nosync .ytms-line {
          color: rgba(255,255,255,0.5);
          font-size: 21px;
          font-weight: 600;
          cursor: default;
        }
        #ytms-lyrics-overlay.nosync .ytms-line:hover {
          background: none;
          color: rgba(255,255,255,0.5);
        }
        @keyframes ytms-glow {
          0%, 100% { text-shadow: 0 0 20px rgba(255,255,255,0.1); }
          50% { text-shadow: 0 0 40px rgba(255,255,255,0.2); }
        }
        #ytms-lyrics-loader {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; padding: 80px 0; gap: 20px;
        }
        #ytms-lyrics-loader .spinner {
          width: 48px; height: 48px;
          border: 4px solid rgba(255,255,255,0.1);
          border-top-color: #fff; border-radius: 50%;
          animation: ytms-spin 0.8s linear infinite;
        }
        #ytms-lyrics-loader .text {
          color: rgba(255,255,255,0.5); font-size: 15px;
          font-family: 'Google Sans', Roboto, sans-serif;
        }
        @keyframes ytms-spin { to { transform: rotate(360deg); } }
      `;
      document.head.appendChild(s);
    }

    function getTrack() {
      const t = document.querySelector("ytmusic-player-bar .title")
        || document.querySelector(".content-info-wrapper .title");
      const a = document.querySelector("ytmusic-player-bar .byline")
        || document.querySelector(".content-info-wrapper .byline");
      return {
        title: t ? t.textContent.trim() : "",
        artist: a ? a.textContent.trim().split("•")[0].trim() : ""
      };
    }

    async function fetchLRC(title, artist) {
      if (!title) return null;
      const cacheKey = `${title}|${artist}`;
      if (lyricsCache.has(cacheKey)) return lyricsCache.get(cacheKey);
      try {
        const r = await fetch(`https://lrclib.net/api/get?${new URLSearchParams({ track_name: title, artist_name: artist })}`);
        if (!r.ok) { lyricsCache.set(cacheKey, null); return null; }
        const d = await r.json();
        let result = null;
        if (d.syncedLyrics) result = { synced: true, text: d.syncedLyrics };
        else if (d.plainLyrics) result = { synced: false, text: d.plainLyrics };
        lyricsCache.set(cacheKey, result);
        return result;
      } catch (e) {}
      return null;
    }

    function parseLRC(text) {
      const out = [];
      for (const line of text.split("\n")) {
        const m = line.match(/^\[(\d+):(\d+)\.(\d+)\]\s*(.*)/);
        if (m && m[4].trim()) {
          out.push({ time: +m[1] * 60 + +m[2] + +m[3] * 0.01, text: m[4].trim() });
        }
      }
      return out;
    }

    function clearLyrics() {
      document.getElementById("ytms-lyrics-overlay")?.remove();
      document.getElementById("ytms-lyrics-loader")?.remove();
      lineEls = [];
      timings = [];
      activeLine = -1;
      isSynced = false;
    }

    /** Render lyrics into the panel. Does NOT touch playback at all. */
    async function loadLyrics(title, artist, videoId) {
      const thisGen = ++loadGeneration;
      isLoading = true;
      streamReady = false;

      // Immediately clear old lyrics
      clearLyrics();
      loadedForVideoId = videoId;

      injectStyles();

      // Start fetching lyrics immediately (don't wait for panel)
      const lrcPromise = fetchLRC(title, artist);

      // Wait for panel to appear (up to 5s)
      const panel = await new Promise((resolve) => {
        const check = () => document.querySelector("ytmusic-description-shelf-renderer");
        const p = check();
        if (p) { resolve(p); return; }
        const start = Date.now();
        const iv = setInterval(() => {
          const p2 = check();
          if (p2) { clearInterval(iv); resolve(p2); return; }
          if (Date.now() - start > 5000) { clearInterval(iv); resolve(null); }
        }, 150);
      });

      if (!panel || thisGen !== loadGeneration) { isLoading = false; return; }

      const wrapper = panel.querySelector(".wrapper") || panel;

      // Show loader
      for (const c of wrapper.children) {
        if (c.style && c.id !== "ytms-lyrics-loader") c.style.display = "none";
      }
      const loader = document.createElement("div");
      loader.id = "ytms-lyrics-loader";
      loader.innerHTML = `<div class="spinner"></div><div class="text">Loading lyrics...</div>`;
      wrapper.appendChild(loader);

      // Await the fetch (which may already be done thanks to parallel start)
      const lrc = await lrcPromise;
      if (thisGen !== loadGeneration) { loader.remove(); isLoading = false; return; }

      loader.remove();

      const overlay = document.createElement("div");
      overlay.id = "ytms-lyrics-overlay";

      if (lrc && lrc.synced) {
        const parsed = parseLRC(lrc.text);
        if (parsed.length > 2) {
          isSynced = true;
          parsed.forEach((item) => {
            const div = document.createElement("div");
            div.className = "ytms-line";
            div.textContent = item.text;
            div.addEventListener("click", () => {
              if (getCurrentVideoId() !== videoId) return;
              if (!streamReady) return;
              const video = getVideo();
              if (video) video.currentTime = item.time;
            });
            overlay.appendChild(div);
            lineEls.push(div);
            timings.push(item.time);
          });
        }
      }

      if (!isSynced) {
        overlay.classList.add("nosync");
        for (const c of wrapper.children) {
          if (c.id !== "ytms-lyrics-overlay" && c.style) c.style.display = "";
        }
        const raw = (wrapper.innerText || "").replace(/\r\n/g, "\n");
        for (const c of wrapper.children) {
          if (c.id !== "ytms-lyrics-overlay" && c.style) c.style.display = "none";
        }
        const fallbackLines = (lrc && lrc.text)
          ? lrc.text.split("\n").filter(l => l.trim())
          : raw.split("\n").filter(l => l.trim());
        fallbackLines.forEach(l => {
          const div = document.createElement("div");
          div.className = "ytms-line";
          div.textContent = l;
          overlay.appendChild(div);
          lineEls.push(div);
        });
      }

      wrapper.appendChild(overlay);
      loadedForVideoId = videoId;
      activeLine = -1;
      isLoading = false;
      // If stream is already at beginning, mark ready immediately
      const v2 = getVideo();
      if (v2 && v2.currentTime < 5) streamReady = true;
    }

    /** Detect song change — videoId is the single source of truth */
    function detectAndLoad() {
      const videoId = getCurrentVideoId();
      if (!videoId) return;
      if (videoId === loadedForVideoId && !isLoading) return; // Same song, nothing to do
      if (videoId === lastVideoId && isLoading) return; // Already loading for this song

      lastVideoId = videoId;
      const { title, artist } = getTrack();
      if (!title) {
        // Title not ready yet, retry shortly
        setTimeout(detectAndLoad, 300);
        return;
      }
      loadLyrics(title, artist, videoId);
    }

    /** Sync highlight to current playback position */
    function syncHighlight() {
      if (!isSynced || lineEls.length === 0 || timings.length === 0) return;
      if (getCurrentVideoId() !== loadedForVideoId) return;

      const v = getVideo();
      if (!v) return;
      const ct = v.currentTime;

      // Wait for stream to actually reset before syncing
      // (after song change, currentTime may still be from previous song)
      if (!streamReady) {
        if (ct < 5) {
          streamReady = true;
        } else {
          // Don't highlight anything — show lyrics at top, unsynced
          if (activeLine !== -1) {
            for (let i = 0; i < lineEls.length; i++) lineEls[i].classList.remove("active", "past");
            activeLine = -1;
            const overlay = document.getElementById("ytms-lyrics-overlay");
            if (overlay) overlay.scrollTop = 0;
          }
          return;
        }
      }

      // Find correct line (binary-search-like from end)
      let idx = -1;
      for (let i = timings.length - 1; i >= 0; i--) {
        if (ct >= timings[i]) { idx = i; break; }
      }

      // Before first lyric — show nothing highlighted
      if (idx < 0) {
        if (activeLine !== -1) {
          for (let i = 0; i < lineEls.length; i++) lineEls[i].classList.remove("active", "past");
          activeLine = -1;
          const overlay = document.getElementById("ytms-lyrics-overlay");
          if (overlay) overlay.scrollTop = 0;
        }
        return;
      }

      if (idx !== activeLine) {
        for (let i = 0; i < lineEls.length; i++) {
          const el = lineEls[i];
          if (i === idx) { el.classList.add("active"); el.classList.remove("past"); }
          else if (i < idx) { el.classList.remove("active"); el.classList.add("past"); }
          else { el.classList.remove("active", "past"); }
        }
        lineEls[idx]?.scrollIntoView({ behavior: "smooth", block: "center" });
        activeLine = idx;
      }
    }

    // ── Start ──
    injectStyles();

    setTimeout(() => {
      // Hook video element for events
      const hookVideo = () => {
        const v = getVideo();
        if (!v) { setTimeout(hookVideo, 500); return; }

        // Use timeupdate for smooth lyrics sync (fires ~4x/sec, no polling needed)
        v.addEventListener("timeupdate", syncHighlight);

        // loadstart fires when a new source is loaded (song auto-advance)
        v.addEventListener("loadstart", () => {
          // Wait a bit for URL to update, then detect
          setTimeout(detectAndLoad, 200);
        });

        // playing event confirms stream is ready
        v.addEventListener("playing", () => {
          // Mark stream ready if currentTime is low (new song started)
          if (!streamReady && v.currentTime < 5) {
            streamReady = true;
          }
          // If we're on a different song than what's loaded, trigger load
          if (getCurrentVideoId() !== loadedForVideoId) {
            detectAndLoad();
          }
        });
      };
      hookVideo();

      // MutationObserver on the title element for instant detection
      const observeTitle = () => {
        const titleEl = document.querySelector("ytmusic-player-bar .title")
          || document.querySelector(".content-info-wrapper .title");
        if (!titleEl) { setTimeout(observeTitle, 500); return; }

        const observer = new MutationObserver(() => {
          // Title changed — check if videoId also changed
          setTimeout(detectAndLoad, 100);
        });
        observer.observe(titleEl, { childList: true, characterData: true, subtree: true });
      };
      observeTitle();

      // Listen for YT Music SPA navigation
      document.addEventListener("yt-navigate-finish", () => setTimeout(detectAndLoad, 200));

      // Tab clicks (force reload when user switches tabs)
      document.addEventListener("click", (e) => {
        if (e.target.closest("tp-yt-paper-tab, [role='tab']")) {
          loadedForVideoId = "";
          lastVideoId = "";
          setTimeout(detectAndLoad, 200);
        }
      }, true);

      // Initial load
      detectAndLoad();

      // Fallback: low-frequency poll (every 2s) for edge cases the events miss
      setInterval(() => {
        if (getCurrentVideoId() !== loadedForVideoId && !isLoading) {
          detectAndLoad();
        }
      }, 2000);
    }, 300);

  })();

  console.log("[YTPlay] v7.0 loaded ✓");
})();
