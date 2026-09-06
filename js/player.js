(() => {
  const TRACKS = [
    {
      slug: "here-comes-the-sun",
      title: "Here Comes the Sun",
      artist: "The Beatles",
      dedication: "For Kuhu didi",
      cover: "covers/here-comes-the-sun.jpeg",
      src: "audio/here_comes_the_sun.mp3",
    },
    {
      slug: "hey-jude",
      title: "Hey Jude",
      artist: "The Beatles",
      dedication: "Take a sad song and make it better",
      cover: "covers/hey-jude.jpeg",
      src: "audio/hey_jude.mp3",
    },
    {
      slug: "somebody-that-i-used-to-know",
      title: "Somebody That I Used to Know",
      artist: "Gotye · feat. Kimbra",
      dedication: "Now and then I think of when we were together",
      cover: "covers/somebody-that-i-used-to-know.jpeg",
      src: "audio/somebody_that_i_used_to_know.mp3",
    },
    {
      slug: "loser",
      title: "Loser",
      artist: "Tame Impala",
      dedication: "For Kuhu didi",
      cover: "covers/loser.jpeg",
      src: "audio/loser.mp3",
    },
    {
      slug: "sunflower",
      title: "Sunflower",
      artist: "Post Malone & Swae Lee",
      dedication: "For Kuhu didi",
      cover: "covers/sunflower.jpeg",
      src: "audio/sunflower.mp3",
    },
  ];

  const audio = document.getElementById("audio");
  const playBtn = document.getElementById("playBtn");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const progress = document.getElementById("progress");
  const progressFill = document.getElementById("progressFill");
  const progressKnob = document.getElementById("progressKnob");
  const timeCurrent = document.getElementById("timeCurrent");
  const timeDuration = document.getElementById("timeDuration");
  const audioNote = document.getElementById("audioNote");
  const artistLabel = document.getElementById("artistLabel");
  const titleEl = document.getElementById("songTitle");
  const dedicationLabel = document.getElementById("dedicationLabel");
  const liveCard = document.getElementById("liveCard");
  const artSlot = document.getElementById("artSlot");
  const repeatBtn = document.getElementById("repeatBtn");
  const tapGate = document.getElementById("tapGate");
  const tapGateSub = document.getElementById("tapGateSub");

  if (!audio || !playBtn || !progress || !progressFill || !liveCard || !artSlot) return;

  let seeking = false;
  let currentIndex = 0;
  let loadGen = 0;
  let loopSong = true;
  let seekRatio = 0;
  let mediaSessionReady = false;

  function setLoop(enabled) {
    loopSong = enabled;
    audio.loop = enabled;
    if (repeatBtn) {
      repeatBtn.classList.toggle("is-on", enabled);
      repeatBtn.setAttribute("aria-pressed", String(enabled));
      repeatBtn.setAttribute(
        "aria-label",
        enabled ? "Repeat song on" : "Repeat song off"
      );
    }
  }

  setLoop(true);
  repeatBtn?.addEventListener("click", () => setLoop(!loopSong));

  function audioUrl(src) {
    try {
      return new URL(src, window.location.href).href;
    } catch {
      return src;
    }
  }

  function coverUrl(src) {
    try {
      return new URL(src, window.location.href).href;
    } catch {
      return src;
    }
  }

  function pickIndexFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const slug = (params.get("song") || params.get("t") || "").trim().toLowerCase();
    const idx = TRACKS.findIndex((t) => t.slug === slug);
    return idx >= 0 ? idx : 0;
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function hideAudioNote() {
    if (audioNote) audioNote.hidden = true;
  }

  function showAudioNote() {
    if (audioNote) audioNote.hidden = false;
  }

  function showTapGate(reason) {
    if (!tapGate) return;
    if (tapGateSub && reason) tapGateSub.textContent = reason;
    tapGate.hidden = false;
  }

  function hideTapGate() {
    if (tapGate) tapGate.hidden = true;
  }

  function setPlaying(isPlaying) {
    playBtn.classList.toggle("is-playing", isPlaying);
    const title = TRACKS[currentIndex]?.title || "song";
    playBtn.setAttribute(
      "aria-label",
      isPlaying ? `Pause ${title}` : `Play ${title}`
    );
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
    }
  }

  function syncPlayingFromAudio() {
    setPlaying(!audio.paused && !audio.ended);
    if (!audio.paused) hideTapGate();
  }

  function knownDuration() {
    const d = audio.duration;
    return Number.isFinite(d) && d > 0 ? d : 0;
  }

  function clampToSeekable(time) {
    const seekable = audio.seekable;
    if (!seekable || seekable.length === 0) return time;
    const start = seekable.start(seekable.length - 1);
    const end = seekable.end(seekable.length - 1);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return time;
    return Math.min(Math.max(time, start), end);
  }

  function setProgressUi(ratio, currentSec, durationSec) {
    const pct = Math.min(100, Math.max(0, ratio * 100));
    progressFill.style.width = `${pct}%`;
    if (progressKnob) progressKnob.style.left = `${pct}%`;
    progress.setAttribute("aria-valuenow", String(Math.round(pct)));
    if (timeCurrent) timeCurrent.textContent = formatTime(currentSec);
    if (timeDuration) {
      timeDuration.textContent = durationSec > 0 ? formatTime(durationSec) : "0:00";
    }
    if ("mediaSession" in navigator && durationSec > 0) {
      try {
        navigator.mediaSession.setPositionState({
          duration: durationSec,
          playbackRate: audio.playbackRate || 1,
          position: Math.min(currentSec, durationSec),
        });
      } catch {
        /* Safari can throw if values are briefly invalid */
      }
    }
  }

  function updateProgress() {
    const duration = knownDuration();
    if (seeking) {
      if (timeDuration) {
        timeDuration.textContent = duration > 0 ? formatTime(duration) : "0:00";
      }
      if (duration > 0 && timeCurrent) {
        timeCurrent.textContent = formatTime(seekRatio * duration);
      }
      return;
    }
    const cur = audio.currentTime || 0;
    const ratio = duration > 0 ? cur / duration : 0;
    setProgressUi(ratio, cur, duration);
  }

  function updateMediaSession(track) {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: "For Kuhu didi",
      artwork: [
        { src: coverUrl(track.cover), sizes: "600x600", type: "image/jpeg" },
      ],
    });

    if (mediaSessionReady) return;
    mediaSessionReady = true;

    const actionHandlers = {
      play: () => {
        audio.play().catch(() => showTapGate("Tap once to start on iPhone"));
      },
      pause: () => audio.pause(),
      previoustrack: () => loadTrack(currentIndex - 1, { autoplay: true }),
      nexttrack: () => loadTrack(currentIndex + 1, { autoplay: true }),
      seekbackward: (details) => {
        const skip = details.seekOffset || 10;
        audio.currentTime = clampToSeekable(Math.max(0, (audio.currentTime || 0) - skip));
        updateProgress();
      },
      seekforward: (details) => {
        const skip = details.seekOffset || 10;
        const duration = knownDuration();
        audio.currentTime = clampToSeekable(
          Math.min(duration || Infinity, (audio.currentTime || 0) + skip)
        );
        updateProgress();
      },
      seekto: (details) => {
        if (details.seekTime == null) return;
        audio.currentTime = clampToSeekable(details.seekTime);
        updateProgress();
      },
    };

    for (const [action, handler] of Object.entries(actionHandlers)) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        /* older iOS may not support every action */
      }
    }
  }

  function syncChrome(track) {
    if (titleEl) titleEl.textContent = track.title;
    if (artistLabel) artistLabel.textContent = track.artist;
    if (dedicationLabel) {
      dedicationLabel.textContent = track.dedication || "";
      dedicationLabel.hidden = !track.dedication;
    }
    document.title = `${track.title} · Kuhu`;
    liveCard.className = `sp-card live-card theme-${track.slug}`;
    artSlot.innerHTML = `
      <div class="sp-art" aria-hidden="true">
        <img class="sp-cover" src="${track.cover}" alt="" />
      </div>
    `;
    updateMediaSession(track);
    hideAudioNote();
  }

  function isIgnorablePlayError(err) {
    if (!err) return false;
    return err.name === "AbortError" || err.name === "NotAllowedError";
  }

  function loadTrack(index, { autoplay = false } = {}) {
    currentIndex = (index + TRACKS.length) % TRACKS.length;
    const track = TRACKS[currentIndex];
    const gen = ++loadGen;
    const url = audioUrl(track.src);

    hideAudioNote();
    syncChrome(track);
    setPlaying(false);
    seeking = false;
    seekRatio = 0;
    setProgressUi(0, 0, 0);
    audio.loop = loopSong;

    const pageUrl = new URL(window.location.href);
    pageUrl.searchParams.set("song", track.slug);
    history.replaceState(null, "", pageUrl);

    audio.muted = false;
    audio.volume = 1;
    audio.defaultMuted = false;

    if (audio.src !== url) {
      audio.src = url;
    }
    audio.load();

    const onReady = () => {
      if (gen !== loadGen) return;
      hideAudioNote();
      updateProgress();
      if (autoplay) {
        audio.play().catch((err) => {
          if (gen !== loadGen) return;
          if (err && err.name === "NotAllowedError") {
            showTapGate("iPhone needs one tap — then it can play in the background");
            return;
          }
          if (isIgnorablePlayError(err)) return;
          setPlaying(false);
          showAudioNote();
        });
      }
    };

    if (audio.readyState >= 2) {
      onReady();
    } else {
      audio.addEventListener("canplay", onReady, { once: true });
    }
  }

  async function togglePlay() {
    hideAudioNote();
    if (audio.paused) {
      try {
        await audio.play();
        hideTapGate();
      } catch (err) {
        if (err && err.name === "NotAllowedError") {
          showTapGate("Tap once to start on iPhone");
          return;
        }
        if (isIgnorablePlayError(err)) return;
        setPlaying(false);
        if (audio.error && audio.error.code !== 1) showAudioNote();
      }
    } else {
      audio.pause();
    }
  }

  function ratioFromClientX(clientX) {
    const rect = progress.getBoundingClientRect();
    if (!rect.width) return 0;
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  }

  function applySeekRatio(ratio, { commit = false } = {}) {
    seekRatio = ratio;
    const duration = knownDuration();
    if (duration > 0) {
      setProgressUi(ratio, ratio * duration, duration);
      if (commit) {
        const target = clampToSeekable(ratio * duration);
        try {
          audio.currentTime = target;
        } catch {
          /* ignore */
        }
        const cur = audio.currentTime || target;
        setProgressUi(duration > 0 ? cur / duration : ratio, cur, duration);
      }
    } else {
      setProgressUi(ratio, 0, 0);
    }
  }

  playBtn.addEventListener("click", togglePlay);
  prevBtn?.addEventListener("click", () =>
    loadTrack(currentIndex - 1, { autoplay: true })
  );
  nextBtn?.addEventListener("click", () =>
    loadTrack(currentIndex + 1, { autoplay: true })
  );

  let startingPlay = false;
  async function startFromUserGesture() {
    if (startingPlay) return;
    startingPlay = true;
    hideAudioNote();
    try {
      if (audio.error) {
        audio.load();
      }
      if (audio.readyState < 2) {
        await new Promise((resolve, reject) => {
          const onReady = () => {
            cleanup();
            resolve();
          };
          const onErr = () => {
            cleanup();
            reject(new Error("audio error"));
          };
          const cleanup = () => {
            audio.removeEventListener("canplay", onReady);
            audio.removeEventListener("error", onErr);
          };
          audio.addEventListener("canplay", onReady, { once: true });
          audio.addEventListener("error", onErr, { once: true });
        });
      }
      await audio.play();
      hideTapGate();
    } catch (err) {
      if (audio.error && audio.error.code !== 1) showAudioNote();
      else showTapGate("Click again to play");
    } finally {
      startingPlay = false;
    }
  }

  tapGate?.addEventListener("click", (event) => {
    event.preventDefault();
    startFromUserGesture();
  });
  tapGate?.addEventListener(
    "touchend",
    (event) => {
      event.preventDefault();
      startFromUserGesture();
    },
    { passive: false }
  );

  audio.addEventListener("play", () => {
    hideAudioNote();
    hideTapGate();
    syncPlayingFromAudio();
  });
  audio.addEventListener("pause", syncPlayingFromAudio);
  audio.addEventListener("playing", () => {
    hideAudioNote();
    hideTapGate();
    syncPlayingFromAudio();
  });
  audio.addEventListener("waiting", syncPlayingFromAudio);
  audio.addEventListener("timeupdate", updateProgress);
  audio.addEventListener("loadedmetadata", () => {
    hideAudioNote();
    updateProgress();
  });
  audio.addEventListener("durationchange", updateProgress);
  audio.addEventListener("seeked", updateProgress);
  audio.addEventListener("progress", () => {
    if (!seeking) updateProgress();
  });
  audio.addEventListener("ended", () => {
    if (loopSong) {
      audio.currentTime = 0;
      audio.play().catch(() => setPlaying(false));
      return;
    }
    setPlaying(false);
    loadTrack(currentIndex + 1, { autoplay: true });
  });
  audio.addEventListener("error", () => {
    if (!audio.error || audio.error.code === 1) return;
    setPlaying(false);
    showAudioNote();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && !audio.paused) {
      updateProgress();
      updateMediaSession(TRACKS[currentIndex]);
    }
  });

  progress.addEventListener("pointerdown", (event) => {
    seeking = true;
    progress.setPointerCapture(event.pointerId);
    applySeekRatio(ratioFromClientX(event.clientX));
  });
  progress.addEventListener("pointermove", (event) => {
    if (!seeking) return;
    applySeekRatio(ratioFromClientX(event.clientX));
  });
  progress.addEventListener("pointerup", (event) => {
    if (!seeking) return;
    applySeekRatio(ratioFromClientX(event.clientX), { commit: true });
    seeking = false;
  });
  progress.addEventListener("pointercancel", () => {
    seeking = false;
    updateProgress();
  });
  progress.addEventListener("keydown", (event) => {
    const duration = knownDuration();
    if (duration <= 0) return;
    const step = duration * 0.05;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      audio.currentTime = clampToSeekable(
        Math.min(duration, (audio.currentTime || 0) + step)
      );
      updateProgress();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      audio.currentTime = clampToSeekable(
        Math.max(0, (audio.currentTime || 0) - step)
      );
      updateProgress();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.code === "Space" && event.target === document.body) {
      event.preventDefault();
      togglePlay();
    }
  });

  currentIndex = pickIndexFromUrl();
  showTapGate("Click or tap to play — then it can keep going in the background");
  loadTrack(currentIndex, { autoplay: false });
})();
