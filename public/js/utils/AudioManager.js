/**
 * public/js/utils/AudioManager.js
 *
 * Professional Audio Management system for SFX.
 * Centralizes loading, preloading, and balanced playback of sounds.
 */

class AudioManager {
  constructor() {
    this.sounds = {};
    this.registry = {
      heal: { src: "./assets/sfx/heal.wav", volume: 0.4 }, // Balanced volume
      damage: { src: "./assets/sfx/damage.wav", volume: 0.7 }, // Balanced volume
      victory: { src: "./assets/sfx/victorySound.wav", volume: 0.8 },
      defeat: { src: "./assets/sfx/defeatSound.wav", volume: 0.8 },
    };
    this.musicRegistry = {
      main: { src: "./assets/music/main_soundtrack.mp3", volume: 0.4 },
      main2: { src: "./assets/music/main_st_2.mp3", volume: 0.4 },
    };
    this.currentMusic = null;
    this.currentMusicKey = null;
    this.isPlaylistMode = false;
    this.playlist = ["main", "main2"];
    this.playlistIndex = 0;
    this.globalVolume = 0.5; // Master volume
    this.enabled = true;
  }

  /**
   * Preload critical sounds
   */
  preloadAll() {
    for (const key in this.registry) {
      if (!this.sounds[key]) this.loadSound(key);
    }
    for (const key in this.musicRegistry) {
      if (!this.sounds[key]) this.loadSound(key, true);
    }
  }

  /**
   * Internal: Load a sound into memory
   */
  loadSound(key, isMusic = false) {
    const entry = isMusic ? this.musicRegistry[key] : this.registry[key];
    if (!entry) {
      console.warn(`[AudioManager] Sound key "${key}" not found in registry.`);
      return null;
    }

    const src = typeof entry === "string" ? entry : entry.src;
    const audio = new Audio(src);
    audio.load();
    this.sounds[key] = audio;
    return audio;
  }

  /**
   * Plays a sound effect
   * @param {string} key - The key in the registry
   * @param {object} options - overrideVolume, loop, playbackRate
   */
  play(key, options = {}) {
    if (!this.enabled) return;

    let sound = this.sounds[key];
    const entry = this.registry[key];

    // If not loaded, load it on the fly (not ideal but safe)
    if (!sound) {
      sound = this.loadSound(key);
      if (!sound) return;
    }

    // Professional touch: For one-off SFX, we want overlapping sounds
    // Calculate final volume: (Per-SFX volume OR 1.0) * (Master Volume)
    const sfxBaseVolume = entry?.volume ?? 1.0;
    const finalVolume = (options.volume ?? sfxBaseVolume) * this.globalVolume;

    if (!sound.paused) {
      const clone = sound.cloneNode();
      clone.volume = Math.max(0, Math.min(1, finalVolume));
      clone.play().catch((e) => console.warn(`[AudioManager] Play failed:`, e));
    } else {
      sound.volume = Math.max(0, Math.min(1, finalVolume));
      sound.play().catch((e) => console.warn(`[AudioManager] Play failed:`, e));
    }
  }

  /**
   * Plays a music track in loop or starts a playlist
   * @param {string|array} key - The key in the musicRegistry or an array of keys
   */
  playMusic(key) {
    if (!this.enabled) return;

    if (Array.isArray(key)) {
      this.isPlaylistMode = true;
      this.playlist = key;
      this.playlistIndex = 0;
      this._startPlaylistTrack();
      return;
    }

    this.isPlaylistMode = false;
    this._playSingleTrack(key);
  }

  _startPlaylistTrack() {
    const key = this.playlist[this.playlistIndex];
    this._playSingleTrack(key, true);
  }

  _playSingleTrack(key, fromPlaylist = false) {
    if (this.currentMusic) {
      this.currentMusic.pause();
      this.currentMusic.onended = null;
    }

    let music = this.sounds[key];
    const entry = this.musicRegistry[key];

    if (!music) {
      music = this.loadSound(key, true);
      if (!music) return;
    }

    music.loop = !fromPlaylist; // If single track, loop. If playlist, wait for ended.
    const finalVolume = (entry?.volume ?? 1.0) * this.globalVolume;
    music.volume = Math.max(0, Math.min(1, finalVolume));

    if (fromPlaylist) {
      music.onended = () => {
        this.playlistIndex = (this.playlistIndex + 1) % this.playlist.length;
        this._startPlaylistTrack();
      };
    }

    music.play().catch((e) => console.warn(`[AudioManager] Music play failed:`, e));
    this.currentMusic = music;
    this.currentMusicKey = key;
  }

  /**
   * Stops the current playing music
   */
  stopMusic() {
    if (this.currentMusic) {
      this.currentMusic.pause();
      this.currentMusic.currentTime = 0;
      this.currentMusic.onended = null;
      this.currentMusic = null;
    }
  }

  setVolume(v) {
    this.globalVolume = Math.max(0, Math.min(1, v));
  }

  toggleSound(state) {
    this.enabled = state !== undefined ? state : !this.enabled;
  }
}

// Export a singleton instance
export const audioManager = new AudioManager();
export default audioManager;
