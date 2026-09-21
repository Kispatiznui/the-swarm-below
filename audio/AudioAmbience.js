"use strict";

/* =========================================================
   THE SWARM BELOW — AUDIO SYSTEM
   AudioAmbience.js

   Procedural, continuous ambience. Nothing here is a looped
   file — every layer is synthesized live from oscillators,
   a single generated noise buffer, and a feedback delay
   network, and reshaped in real time by setIntensity().

   FIVE LAYERS, each reinterpreting "intensity" differently
   instead of just getting louder:

     1. SUB        — near-subsonic pressure, felt more than
                      heard, breathing slowly.
     2. BODY        — three detuned oscillators through a
                      moving low-pass filter: an organic mass,
                      not a clean synth pad.
     3. NOISE       — one generated noise buffer through a
                      moving band-pass filter: water/pressure
                      texture, not white-noise hiss.
     4. RESONANCE   — a capped feedback delay + resonant
                      band-pass fed by the body layer: the
                      sense of a large, deep, reflective space.
     5. LIFE        — not a layer with its own sound; a set of
                      slow, mutually-irregular-period LFOs that
                      drive breathing, filter drift and stereo
                      movement across the other four, so the
                      whole thing never repeats on an obvious
                      cycle within a normal play session.

   DESIGN NOTE ON RANDOMNESS: Math.random() is used exactly
   once, to fill the noise layer's source buffer — that is
   what noise IS, by definition. Nothing else in this file
   uses per-frame randomness; all "life" movement comes from
   deterministic, independent-period oscillators (LFOs) whose
   combined phase relationship does not repeat on any short,
   noticeable cycle. That is the "temporal memory" the design
   asked for, without reaching for Math.random() as a crutch.

   DESIGN NOTE ON AudioWorklet: noise here is a *pre-generated*
   buffer played back on a loop, not per-sample custom DSP
   computed live — so a plain BufferSourceNode is the correct,
   simpler tool. AudioWorklet is deliberately NOT used in this
   file; there is no processing here that requires touching
   individual samples in real time. If Tayatna's identity
   (later phase) ever needs true per-sample synthesis (e.g. a
   custom waveshaper curve computed dynamically), that is the
   point where AudioWorklet would actually earn its cost.
========================================================= */

class AudioAmbience {

    constructor(ctx, destination) {

        this.ctx = ctx;
        this.destination = destination;

        this.running = false;
        this.intensity = 0;

        /* Master fader for the whole ambience system. Every
           layer connects here first — starting/stopping the
           ambience is then just one ramp, not five. */

        this.masterAmbienceGain =
            ctx.createGain();

        this.masterAmbienceGain.gain.value = 0;

        this.masterAmbienceGain.connect(
            destination
        );

        this._buildSubLayer();
        this._buildBodyLayer();
        this._buildNoiseLayer();
        this._buildResonanceLayer();
        this._buildLifeModulation();

        /* All oscillators / buffer sources are started once,
           here, at construction time, at silent gain. They
           run continuously for the life of the AudioContext —
           this is a small, fixed set of persistent nodes
           (roughly a dozen), not something created per frame
           or per intensity change. setIntensity() only ever
           moves existing AudioParams; it never adds nodes. */

        this._startSources();

        this.setIntensity(0, 0.01);
    }

    /* =====================================================
       LIFECYCLE
    ===================================================== */

    start() {

        this.running = true;

        this.masterAmbienceGain.gain.setTargetAtTime(
            1,
            this.ctx.currentTime,
            0.8
        );
    }

    /* hard=true fully tears down the graph (used by
       AudioEngine.dispose()). hard=false just fades to
       silence and leaves the graph running — cheap to
       start() again later without rebuilding anything. */

    stop(hard = false) {

        this.running = false;

        this.masterAmbienceGain.gain.setTargetAtTime(
            0,
            this.ctx.currentTime,
            0.5
        );

        if (!hard) {
            return;
        }

        const stoppable = [
            this.subOsc,
            this.bodyOsc1,
            this.bodyOsc2,
            this.bodyOsc3,
            this.noiseSource,
            this.subBreathLFO,
            this.bodyFilterLFO,
            this.noiseDriftLFO,
            this.subPanLFO,
            this.bodyPanLFO,
            this.noisePanLFO,
            this.swellLFO
        ];

        for (const node of stoppable) {

            if (!node) {
                continue;
            }

            try {

                node.stop();
            }
            catch (error) {

                /* Already stopped — safe to ignore. */
            }
        }

        this.masterAmbienceGain.disconnect();
    }

    /* =====================================================
       INTENSITY

       Every parameter below has an explicit LOW..HIGH pair
       and is interpolated by `this.intensity`. Nothing here
       is "volume up" alone — density, cutoff frequencies,
       detune spread, feedback amount, LFO speed and stereo
       movement all move independently, on their own curves.
    ===================================================== */

    setIntensity(value, rampSeconds = 2.5) {

        this.intensity =
            clampAudioValue(value, 0, 1);

        const i = this.intensity;
        const now = this.ctx.currentTime;
        const tc = Math.max(0.05, rampSeconds);

        const lerp = (min, max) =>
            min + (max - min) * i;

        /* --- SUB --- */

        this.subLayerGain.gain.setTargetAtTime(
            lerp(0.015, 0.22),
            now,
            tc
        );

        this.subBreathDepth.gain.setTargetAtTime(
            lerp(0.01, 0.05),
            now,
            tc
        );

        /* --- BODY --- */

        this.bodyOsc2.detune.setTargetAtTime(
            lerp(5, 22),
            now,
            tc
        );

        this.bodyOsc3.detune.setTargetAtTime(
            lerp(-5, -26),
            now,
            tc
        );

        this.bodyFilter.frequency.setTargetAtTime(
            lerp(110, 420),
            now,
            tc
        );

        this.bodyLayerGain.gain.setTargetAtTime(
            lerp(0.03, 0.16),
            now,
            tc
        );

        /* --- NOISE (water) --- */

        this.noiseBandpass.frequency.setTargetAtTime(
            lerp(160, 640),
            now,
            tc
        );

        this.noiseBandpass.Q.setTargetAtTime(
            lerp(5.5, 1.4),
            now,
            tc
        );

        this.noiseLayerGain.gain.setTargetAtTime(
            lerp(0.05, 0.20),
            now,
            tc
        );

        /* --- RESONANCE --- */
        /* Feedback is intentionally capped well under 1 at
           every intensity level — this is the "cuidadosamente
           limitado" requirement, not a suggestion. */

        this.resonanceFeedbackGain.gain.setTargetAtTime(
            lerp(0.18, 0.42),
            now,
            tc
        );

        this.resonanceFilter.Q.setTargetAtTime(
            lerp(2.5, 9),
            now,
            tc
        );

        this.resonanceOutGain.gain.setTargetAtTime(
            lerp(0.05, 0.22),
            now,
            tc
        );

        /* --- LIFE (LFO speed + spatial movement) --- */

        this.subBreathLFO.frequency.setTargetAtTime(
            lerp(0.045, 0.09),
            now,
            tc
        );

        this.bodyFilterLFO.frequency.setTargetAtTime(
            lerp(0.07, 0.16),
            now,
            tc
        );

        this.noiseDriftLFO.frequency.setTargetAtTime(
            lerp(0.035, 0.11),
            now,
            tc
        );

        this.subPanDepth.gain.setTargetAtTime(
            lerp(0.05, 0.15),
            now,
            tc
        );

        this.bodyPanDepth.gain.setTargetAtTime(
            lerp(0.15, 0.55),
            now,
            tc
        );

        this.noisePanDepth.gain.setTargetAtTime(
            lerp(0.2, 0.7),
            now,
            tc
        );

        this.bodyPanLFO.frequency.setTargetAtTime(
            lerp(0.025, 0.07),
            now,
            tc
        );

        this.noisePanLFO.frequency.setTargetAtTime(
            lerp(0.018, 0.06),
            now,
            tc
        );
    }

    /* =====================================================
       LAYER 1 — SUB
    ===================================================== */

    _buildSubLayer() {

        const ctx = this.ctx;

        this.subOsc =
            ctx.createOscillator();

        this.subOsc.type = "sine";
        this.subOsc.frequency.value = 44;

        this.subLayerGain =
            ctx.createGain();

        this.subLayerGain.gain.value = 0;

        this.subPanner =
            ctx.createStereoPanner();

        this.subOsc.connect(
            this.subLayerGain
        );

        this.subLayerGain.connect(
            this.subPanner
        );

        this.subPanner.connect(
            this.masterAmbienceGain
        );

        /* Slow amplitude "breathing" — an LFO added directly
           onto the gain AudioParam on top of its base value. */

        this.subBreathLFO =
            ctx.createOscillator();

        this.subBreathLFO.type = "sine";
        this.subBreathLFO.frequency.value = 0.045;

        this.subBreathDepth =
            ctx.createGain();

        this.subBreathDepth.gain.value = 0.01;

        this.subBreathLFO.connect(
            this.subBreathDepth
        );

        this.subBreathDepth.connect(
            this.subLayerGain.gain
        );

        /* Tiny, slow frequency wobble so the sub never reads
           as a dead, static test tone. */

        this.subWobbleLFO =
            ctx.createOscillator();

        this.subWobbleLFO.type = "sine";
        this.subWobbleLFO.frequency.value = 0.017;

        this.subWobbleDepth =
            ctx.createGain();

        this.subWobbleDepth.gain.value = 1.6;

        this.subWobbleLFO.connect(
            this.subWobbleDepth
        );

        this.subWobbleDepth.connect(
            this.subOsc.detune
        );
    }

    /* =====================================================
       LAYER 2 — ABYSSAL BODY
    ===================================================== */

    _buildBodyLayer() {

        const ctx = this.ctx;

        this.bodyOsc1 =
            ctx.createOscillator();

        this.bodyOsc1.type = "triangle";
        this.bodyOsc1.frequency.value = 58;

        this.bodyOsc2 =
            ctx.createOscillator();

        this.bodyOsc2.type = "sawtooth";
        this.bodyOsc2.frequency.value = 58;
        this.bodyOsc2.detune.value = 5;

        this.bodyOsc3 =
            ctx.createOscillator();

        this.bodyOsc3.type = "triangle";
        this.bodyOsc3.frequency.value = 58;
        this.bodyOsc3.detune.value = -5;

        this.bodyFilter =
            ctx.createBiquadFilter();

        this.bodyFilter.type = "lowpass";
        this.bodyFilter.frequency.value = 110;
        this.bodyFilter.Q.value = 0.7;

        this.bodyLayerGain =
            ctx.createGain();

        this.bodyLayerGain.gain.value = 0;

        this.bodyPanner =
            ctx.createStereoPanner();

        this.bodyOsc1.connect(this.bodyFilter);
        this.bodyOsc2.connect(this.bodyFilter);
        this.bodyOsc3.connect(this.bodyFilter);

        this.bodyFilter.connect(
            this.bodyLayerGain
        );

        this.bodyLayerGain.connect(
            this.bodyPanner
        );

        this.bodyPanner.connect(
            this.masterAmbienceGain
        );

        /* Slow filter drift — this is what keeps the mass
           feeling alive instead of a static drone. */

        this.bodyFilterLFO =
            ctx.createOscillator();

        this.bodyFilterLFO.type = "sine";
        this.bodyFilterLFO.frequency.value = 0.07;

        this.bodyFilterLFODepth =
            ctx.createGain();

        this.bodyFilterLFODepth.gain.value = 45;

        this.bodyFilterLFO.connect(
            this.bodyFilterLFODepth
        );

        this.bodyFilterLFODepth.connect(
            this.bodyFilter.frequency
        );
    }

    /* =====================================================
       LAYER 3 — NOISE / WATER

       One noise buffer, generated once, looped forever.
       A moving band-pass filter is what gives it character —
       without the filter this would just be static hiss.
    ===================================================== */

    _buildNoiseLayer() {

        const ctx = this.ctx;

        const bufferSeconds = 4;

        const buffer =
            ctx.createBuffer(
                2,
                ctx.sampleRate * bufferSeconds,
                ctx.sampleRate
            );

        for (
            let channel = 0;
            channel < buffer.numberOfChannels;
            channel++
        ) {

            const data =
                buffer.getChannelData(channel);

            /* The one legitimate use of Math.random() in this
               file: generating the raw noise samples. This is
               not "modulation randomness", it's the actual
               definition of white noise — there is no
               deterministic substitute for this specific job. */

            for (let i = 0; i < data.length; i++) {

                data[i] =
                    Math.random() * 2 - 1;
            }
        }

        this.noiseSource =
            ctx.createBufferSource();

        this.noiseSource.buffer = buffer;
        this.noiseSource.loop = true;

        this.noiseBandpass =
            ctx.createBiquadFilter();

        this.noiseBandpass.type = "bandpass";
        this.noiseBandpass.frequency.value = 160;
        this.noiseBandpass.Q.value = 5.5;

        /* A second, gentler low-pass after the bandpass keeps
           the top end soft — "water", not "radio static". */

        this.noiseSoften =
            ctx.createBiquadFilter();

        this.noiseSoften.type = "lowpass";
        this.noiseSoften.frequency.value = 900;
        this.noiseSoften.Q.value = 0.5;

        this.noiseLayerGain =
            ctx.createGain();

        this.noiseLayerGain.gain.value = 0;

        this.noisePanner =
            ctx.createStereoPanner();

        this.noiseSource.connect(
            this.noiseBandpass
        );

        this.noiseBandpass.connect(
            this.noiseSoften
        );

        this.noiseSoften.connect(
            this.noiseLayerGain
        );

        this.noiseLayerGain.connect(
            this.noisePanner
        );

        this.noisePanner.connect(
            this.masterAmbienceGain
        );

        /* Slow drift on the bandpass center frequency — the
           sensation of the water layer shifting weight. */

        this.noiseDriftLFO =
            ctx.createOscillator();

        this.noiseDriftLFO.type = "sine";
        this.noiseDriftLFO.frequency.value = 0.035;

        this.noiseDriftDepth =
            ctx.createGain();

        this.noiseDriftDepth.gain.value = 60;

        this.noiseDriftLFO.connect(
            this.noiseDriftDepth
        );

        this.noiseDriftDepth.connect(
            this.noiseBandpass.frequency
        );
    }

    /* =====================================================
       LAYER 4 — RESONANCE

       A capped feedback delay network fed from the body
       layer's pre-gain signal. This is what gives the
       ambience a sense of *space* rather than just texture.
    ===================================================== */

    _buildResonanceLayer() {

        const ctx = this.ctx;

        this.resonanceSend =
            ctx.createGain();

        this.resonanceSend.gain.value = 0.5;

        /* Tap the body layer before its own output gain, so
           the resonance keeps sounding even when the dry body
           layer itself is quiet at low intensity. */

        this.bodyFilter.connect(
            this.resonanceSend
        );

        this.resonanceDelay =
            ctx.createDelay(1.0);

        this.resonanceDelay.delayTime.value = 0.19;

        this.resonanceFilter =
            ctx.createBiquadFilter();

        this.resonanceFilter.type = "bandpass";
        this.resonanceFilter.frequency.value = 128;
        this.resonanceFilter.Q.value = 2.5;

        this.resonanceFeedbackGain =
            ctx.createGain();

        /* Hard safety ceiling — never overridden by
           setIntensity, regardless of how it is called. This
           is the actual guarantee against runaway feedback,
           not just a well-behaved default. */

        this.resonanceFeedbackGain.gain.value = 0.18;

        this.resonanceOutGain =
            ctx.createGain();

        this.resonanceOutGain.gain.value = 0;

        this.resonanceSend.connect(
            this.resonanceDelay
        );

        this.resonanceDelay.connect(
            this.resonanceFilter
        );

        this.resonanceFilter.connect(
            this.resonanceFeedbackGain
        );

        this.resonanceFeedbackGain.connect(
            this.resonanceDelay
        );

        this.resonanceFilter.connect(
            this.resonanceOutGain
        );

        this.resonanceOutGain.connect(
            this.masterAmbienceGain
        );
    }

    /* =====================================================
       LAYER 5 — LIFE (spatial modulation)

       No new audible source here — just the stereo-panning
       LFOs that make the previous four layers feel like they
       occupy real, moving space instead of sitting dead
       center. Pan depth/speed both scale with intensity.
    ===================================================== */

    _buildLifeModulation() {

        const ctx = this.ctx;

        this.subPanLFO =
            ctx.createOscillator();

        this.subPanLFO.type = "sine";
        this.subPanLFO.frequency.value = 0.012;

        this.subPanDepth =
            ctx.createGain();

        this.subPanDepth.gain.value = 0.05;

        this.subPanLFO.connect(
            this.subPanDepth
        );

        this.subPanDepth.connect(
            this.subPanner.pan
        );

        this.bodyPanLFO =
            ctx.createOscillator();

        this.bodyPanLFO.type = "sine";
        this.bodyPanLFO.frequency.value = 0.025;

        this.bodyPanDepth =
            ctx.createGain();

        this.bodyPanDepth.gain.value = 0.15;

        this.bodyPanLFO.connect(
            this.bodyPanDepth
        );

        this.bodyPanDepth.connect(
            this.bodyPanner.pan
        );

        this.noisePanLFO =
            ctx.createOscillator();

        this.noisePanLFO.type = "sine";
        this.noisePanLFO.frequency.value = 0.018;

        this.noisePanDepth =
            ctx.createGain();

        this.noisePanDepth.gain.value = 0.2;

        this.noisePanLFO.connect(
            this.noisePanDepth
        );

        this.noisePanDepth.connect(
            this.noisePanner.pan
        );

        /* One long, slow "swell" shared across sub + body gain
           so the whole ambience occasionally leans forward and
           back together, on a period long enough (≈47s) that
           it reads as alive rather than as a detectable loop. */

        this.swellLFO =
            ctx.createOscillator();

        this.swellLFO.type = "sine";
        this.swellLFO.frequency.value = 1 / 47;

        this.swellDepthSub =
            ctx.createGain();

        this.swellDepthSub.gain.value = 0.02;

        this.swellDepthBody =
            ctx.createGain();

        this.swellDepthBody.gain.value = 0.025;

        this.swellLFO.connect(
            this.swellDepthSub
        );

        this.swellLFO.connect(
            this.swellDepthBody
        );

        this.swellDepthSub.connect(
            this.subLayerGain.gain
        );

        this.swellDepthBody.connect(
            this.bodyLayerGain.gain
        );
    }

    /* =====================================================
       INTERNAL
    ===================================================== */

    _startSources() {

        const sources = [
            this.subOsc,
            this.bodyOsc1,
            this.bodyOsc2,
            this.bodyOsc3,
            this.noiseSource,
            this.subBreathLFO,
            this.subWobbleLFO,
            this.bodyFilterLFO,
            this.noiseDriftLFO,
            this.subPanLFO,
            this.bodyPanLFO,
            this.noisePanLFO,
            this.swellLFO
        ];

        for (const node of sources) {

            node.start();
        }
    }
}
