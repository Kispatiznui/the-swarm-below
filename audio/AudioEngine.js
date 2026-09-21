"use strict";

/* =========================================================
   THE SWARM BELOW — AUDIO SYSTEM
   AudioEngine.js

   Owns the AudioContext lifecycle, the master output chain,
   and the single "intensity" value that every procedural
   layer listens to. This file does not generate any sound
   by itself — it hosts AudioAmbience (and, in later phases,
   AudioSFX / boss identity modules) and exposes a small,
   stable API for game.js to call into:

       audio.enable()          — must run from a user gesture
       audio.disable()         — safe suspend, keeps the graph
       audio.setMasterVolume(v)
       audio.setIntensity(v, rampSeconds)
       audio.update(state)     — called once per game frame
       audio.debugAmbient()    — console-driven smoke test
       audio.dispose()         — full teardown

   PHASE 1 SCOPE: engine + procedural ambience only. No SFX,
   no boss identities yet — those are separate files added in
   later phases without touching this one.
========================================================= */

class AudioEngine {

    constructor() {

        this.ctx = null;

        this.masterGain = null;
        this.limiter = null;

        this.ambience = null;

        this.enabled = false;
        this.supported =
            typeof window !== "undefined" &&
            (window.AudioContext || window.webkitAudioContext);

        this.intensity = 0;

        this._unlockAttached = false;

        this._warnedUnsupported = false;
    }

    /* =====================================================
       LIFECYCLE
    ===================================================== */

    /* Must be called from inside a real user gesture handler
       (click, keydown, pointerdown). Browsers refuse to start
       an AudioContext otherwise. Safe to call more than once —
       later calls just resume an already-built graph. */

    enable() {

        if (!this.supported) {

            this._warnUnsupported();
            return;
        }

        if (!this.ctx) {

            this._buildGraph();
        }

        if (this.ctx.state === "suspended") {

            this.ctx.resume().catch(() => {});
        }

        this.enabled = true;

        if (this.ambience) {

            this.ambience.start();
        }
    }

    /* Suspends processing without destroying any node. Cheap
       to re-enable later via enable(). Used for a clean "off"
       state — this project does not currently call this from
       gameplay, it exists so the API is complete and safe to
       wire into a future settings/mute toggle without having
       to design lifecycle behaviour later. */

    disable() {

        this.enabled = false;

        if (this.ctx && this.ctx.state === "running") {

            this.ctx.suspend().catch(() => {});
        }
    }

    setMasterVolume(value) {

        if (!this.masterGain) {
            return;
        }

        const v =
            clampAudioValue(value, 0, 1);

        this.masterGain.gain.setTargetAtTime(
            v,
            this.ctx.currentTime,
            0.15
        );
    }

    /* Full teardown. Not required for a normal play session —
       provided for completeness/cleanup discipline (e.g. if
       this were ever embedded in a page that unmounts the
       game, or during hot-reload style development). */

    dispose() {

        if (this.ambience) {

            this.ambience.stop(true);
            this.ambience = null;
        }

        if (this.ctx) {

            this.ctx.close().catch(() => {});
        }

        this.ctx = null;
        this.masterGain = null;
        this.limiter = null;
        this.enabled = false;
    }

    /* =====================================================
       INTENSITY
    ===================================================== */

    /* value: 0..1. This does NOT just scale volume — it is
       forwarded to AudioAmbience, which reinterprets it per
       layer (filter cutoffs, detune spread, noise band width,
       resonance feedback, modulation speed, stereo movement).
       See AudioAmbience.setIntensity for the actual mapping. */

    setIntensity(value, rampSeconds) {

        this.intensity =
            clampAudioValue(value, 0, 1);

        if (this.ambience) {

            this.ambience.setIntensity(
                this.intensity,
                rampSeconds
            );
        }
    }

    /* Called once per game frame from Game.update(). Derives
       intensity from the real state of the run instead of
       exposing raw gameplay numbers to the ambience layer —
       AudioAmbience only ever has to understand a single 0..1
       value, keeping the two systems decoupled. */

    update(state) {

        if (!this.enabled) {
            return;
        }

        const intensity =
            this._computeIntensity(state);

        this.setIntensity(intensity);
    }

    _computeIntensity(state) {

        const wave =
            state.wave || 1;

        const enemyCount =
            state.enemyCount || 0;

        const healthRatio =
            state.playerHealthRatio !== undefined
                ? state.playerHealthRatio
                : 1;

        /* Slow campaign-length rise: even a quiet wave 30
           carries more underlying tension than wave 2. */

        const campaignPressure =
            clampAudioValue(wave / 37, 0, 1) * 0.30;

        /* How crowded the field currently is. 25 fragments is
           treated as "a lot" for this purpose — it does not
           need to track maxFragments exactly, it only needs to
           feel right. */

        const swarmPressure =
            clampAudioValue(enemyCount / 25, 0, 1) * 0.35;

        /* Being low on health should read as tension even in
           an otherwise quiet moment. */

        const healthPressure =
            clampAudioValue(1 - healthRatio, 0, 1) * 0.15;

        let intensity =
            campaignPressure +
            swarmPressure +
            healthPressure;

        if (state.bossActive) {

            intensity += 0.25;
        }

        /* Tayatna does not simply mean "maximum intensity" —
           her sound identity (Phase 4) reshapes the ambience
           rather than just turning every dial to 1. For now,
           before that identity exists, she is floored at a
           high value so the transition is at least audible;
           AudioAmbience.setTayatnaMode (added in Phase 4) is
           the real hook for her transformation. */

        if (state.tayatnaActive) {

            intensity =
                Math.max(intensity, 0.85);
        }

        return clampAudioValue(intensity, 0, 1);
    }

    /* =====================================================
       DEBUG
    ===================================================== */

    /* Console-driven smoke test, independent of gameplay:

           audio.debugAmbient()

       IMPORTANT: if the page has not registered a user gesture
       yet (no click/keypress anywhere), calling this directly
       from the devtools console will build the graph but the
       browser may keep the context suspended, since a console
       invocation does not count as a user gesture. Click
       anywhere on the page once first, then run this — after
       that, ctx.state stays "running" and this works every
       time, gesture or not. */

    debugAmbient() {

        if (!this.supported) {

            this._warnUnsupported();
            return;
        }

        this.enable();
        this.setIntensity(0.5, 3);

        console.log(
            "[AudioEngine] debugAmbient(): ambience should now " +
            "be audible at intensity 0.5. If you hear nothing, " +
            "click anywhere on the page once (browser audio " +
            "gesture requirement) and call audio.debugAmbient() " +
            "again. Try audio.setIntensity(0) through " +
            "audio.setIntensity(1) to hear the full range."
        );
    }

    /* =====================================================
       INTERNAL
    ===================================================== */

    _buildGraph() {

        const Ctx =
            window.AudioContext ||
            window.webkitAudioContext;

        this.ctx = new Ctx();

        this.masterGain =
            this.ctx.createGain();

        this.masterGain.gain.value = 0.8;

        /* Safety limiter: five procedural layers summing at
           once can clip on load spikes (a wave transition, a
           boss death shake) without ever being *intended* to
           be that loud. This does not affect character — it
           only prevents accidental clipping. */

        this.limiter =
            this.ctx.createDynamicsCompressor();

        this.limiter.threshold.value = -6;
        this.limiter.knee.value = 12;
        this.limiter.ratio.value = 4;
        this.limiter.attack.value = 0.01;
        this.limiter.release.value = 0.25;

        this.masterGain.connect(this.limiter);
        this.limiter.connect(this.ctx.destination);

        this.ambience =
            new AudioAmbience(
                this.ctx,
                this.masterGain
            );
    }

    _warnUnsupported() {

        if (this._warnedUnsupported) {
            return;
        }

        this._warnedUnsupported = true;

        console.warn(
            "[AudioEngine] Web Audio API is not supported in " +
            "this browser. The game will run normally without " +
            "sound."
        );
    }
}

/* Small local clamp so this file has no dependency on
   game.js load order (game.js is expected to load AFTER the
   audio files, not before). */

function clampAudioValue(value, min, max) {

    return Math.max(
        min,
        Math.min(max, value)
    );
}
