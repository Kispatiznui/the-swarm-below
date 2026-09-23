"use strict";

/* =========================================================
   THE SWARM BELOW — INPUT ADAPTER
   TouchControls.js

   Builds the mobile control surface and feeds it into the
   SAME InputSystem object the keyboard/mouse path already
   writes into (game.input.keys / game.input.mouse). Nothing
   in Witness, DefenseSystem or any ability reads from this
   file directly — they cannot tell whether "q" came from a
   keydown event or from a finger on this pad.

   MOVEMENT: the left stick is deliberately converted into the
   same four WASD booleans keyboard input already produces
   (8-directional), instead of feeding a continuous analog
   vector. This guarantees Witness's physics (acceleration /
   damping / maxSpeed) needed ZERO changes — the trade-off is
   documented, not accidental.

   AIM/ATTACK: the right pad drives game.input.mouse.x/y as an
   aim point projected AIM_DISTANCE ahead of the Witness in the
   drag direction, recomputed every frame (via rAF) so it keeps
   tracking correctly even while the Witness itself is moving.
   Holding the pad also sets mouse.down = true, which is the
   exact same signal a held mouse button already produces for
   THE EYE — no DefenseSystem change needed either.

   ABILITY BUTTONS: rather than building a second, separate set
   of icons, this reuses the *existing* .abilityCard elements
   already in the HUD (they already render the correct cooldown
   bar every frame via Game.updateHUD()) — a card looks and
   behaves identically whether it was reached by reading a
   keyboard legend on PC or tapped directly on mobile.
========================================================= */

const TOUCH_AIM_DISTANCE = 140;

class TouchControls {

    constructor(game, deviceDetector) {

        this.game = game;
        this.deviceDetector = deviceDetector;

        this.joystickPointerId = null;
        this.joystickVector = { x: 0, y: 0 };

        this.aimPointerId = null;
        this.aimVector = { x: 0, y: 0 };
        this.aimActive = false;

        this._buildJoystick();
        this._buildAimPad();
        this._wireAbilityCards();

        this._rafLoop();
    }

    /* =====================================================
       LEFT STICK — MOVEMENT
    ===================================================== */

    _buildJoystick() {

        this.joystickBase =
            document.createElement("div");

        this.joystickBase.id = "touchJoystickBase";
        this.joystickBase.className = "touchPad mobileOnly";

        this.joystickKnob =
            document.createElement("div");

        this.joystickKnob.id = "touchJoystickKnob";
        this.joystickKnob.className = "touchPadKnob";

        this.joystickBase.appendChild(this.joystickKnob);

        document.getElementById("gameWrapper")
            .appendChild(this.joystickBase);

        this.joystickBase.addEventListener(
            "pointerdown",
            event => this._onJoystickStart(event),
            { passive: false }
        );

        window.addEventListener(
            "pointermove",
            event => this._onJoystickMove(event),
            { passive: false }
        );

        window.addEventListener(
            "pointerup",
            event => this._onJoystickEnd(event)
        );

        window.addEventListener(
            "pointercancel",
            event => this._onJoystickEnd(event)
        );
    }

    _onJoystickStart(event) {

        if (this.joystickPointerId !== null) {
            return;
        }

        event.preventDefault();

        this.joystickPointerId = event.pointerId;

        this.joystickBase.setPointerCapture(
            event.pointerId
        );

        this._updateJoystickVector(event);
    }

    _onJoystickMove(event) {

        if (event.pointerId !== this.joystickPointerId) {
            return;
        }

        event.preventDefault();

        this._updateJoystickVector(event);
    }

    _onJoystickEnd(event) {

        if (event.pointerId !== this.joystickPointerId) {
            return;
        }

        this.joystickPointerId = null;
        this.joystickVector = { x: 0, y: 0 };

        this.joystickKnob.style.transform =
            "translate(-50%, -50%)";

        this._applyMovementKeys(0, 0);
    }

    _updateJoystickVector(event) {

        const rect =
            this.joystickBase.getBoundingClientRect();

        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        let dx = event.clientX - centerX;
        let dy = event.clientY - centerY;

        const maxRadius = rect.width / 2;

        const distance =
            Math.min(
                maxRadius,
                Math.hypot(dx, dy)
            );

        const angle =
            Math.atan2(dy, dx);

        dx = Math.cos(angle) * distance;
        dy = Math.sin(angle) * distance;

        this.joystickKnob.style.transform =
            `translate(calc(-50% + ${dx}px), ` +
            `calc(-50% + ${dy}px))`;

        /* Deadzone: small accidental drags do not register as
           movement, matching how a released key would behave. */

        const deadzone = maxRadius * 0.22;

        if (distance < deadzone) {

            this._applyMovementKeys(0, 0);
            return;
        }

        const normX = dx / maxRadius;
        const normY = dy / maxRadius;

        this._applyMovementKeys(normX, normY);
    }

    /* Converts a continuous direction into the same four
       boolean keys Witness.update() already reads — an
       8-directional deadzone bucket, not a full analog value. */

    _applyMovementKeys(normX, normY) {

        const keys = this.game.input.keys;

        const threshold = 0.35;

        keys["w"] = normY < -threshold;
        keys["s"] = normY > threshold;
        keys["a"] = normX < -threshold;
        keys["d"] = normX > threshold;
    }

    /* =====================================================
       RIGHT PAD — AIM + ATTACK (THE EYE)
    ===================================================== */

    _buildAimPad() {

        this.aimBase =
            document.createElement("div");

        this.aimBase.id = "touchAimBase";
        this.aimBase.className = "touchPad mobileOnly";

        this.aimKnob =
            document.createElement("div");

        this.aimKnob.id = "touchAimKnob";
        this.aimKnob.className = "touchPadKnob touchAimKnob";

        this.aimBase.appendChild(this.aimKnob);

        document.getElementById("gameWrapper")
            .appendChild(this.aimBase);

        this.aimBase.addEventListener(
            "pointerdown",
            event => this._onAimStart(event),
            { passive: false }
        );

        window.addEventListener(
            "pointermove",
            event => this._onAimMove(event),
            { passive: false }
        );

        window.addEventListener(
            "pointerup",
            event => this._onAimEnd(event)
        );

        window.addEventListener(
            "pointercancel",
            event => this._onAimEnd(event)
        );
    }

    _onAimStart(event) {

        if (this.aimPointerId !== null) {
            return;
        }

        event.preventDefault();

        this.aimPointerId = event.pointerId;
        this.aimActive = true;

        this.aimBase.setPointerCapture(
            event.pointerId
        );

        this.game.input.mouse.down = true;

        this._updateAimVector(event);
    }

    _onAimMove(event) {

        if (event.pointerId !== this.aimPointerId) {
            return;
        }

        event.preventDefault();

        this._updateAimVector(event);
    }

    _onAimEnd(event) {

        if (event.pointerId !== this.aimPointerId) {
            return;
        }

        this.aimPointerId = null;
        this.aimActive = false;
        this.aimVector = { x: 0, y: 0 };

        this.aimKnob.style.transform =
            "translate(-50%, -50%)";

        this.game.input.mouse.down = false;
    }

    _updateAimVector(event) {

        const rect =
            this.aimBase.getBoundingClientRect();

        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        let dx = event.clientX - centerX;
        let dy = event.clientY - centerY;

        const maxRadius = rect.width / 2;

        const distance =
            Math.min(
                maxRadius,
                Math.hypot(dx, dy)
            );

        const angle =
            Math.atan2(dy, dx);

        dx = Math.cos(angle) * distance;
        dy = Math.sin(angle) * distance;

        this.aimKnob.style.transform =
            `translate(calc(-50% + ${dx}px), ` +
            `calc(-50% + ${dy}px))`;

        if (distance < maxRadius * 0.15) {

            this.aimVector = { x: 0, y: 0 };
            return;
        }

        this.aimVector = {
            x: Math.cos(angle),
            y: Math.sin(angle)
        };
    }

    /* Runs every frame regardless of whether the pad is being
       actively dragged right now, so the aim point keeps
       tracking the Witness's own movement while held, and so
       it settles back onto the Witness the instant the pad is
       released (matching the mouse's own last-known position
       behaviour on PC, without leaving a stale far-off aim). */

    _rafLoop() {

        const game = this.game;

        if (
            this.aimActive &&
            (this.aimVector.x !== 0 || this.aimVector.y !== 0)
        ) {

            game.input.mouse.x =
                clamp(
                    game.witness.x +
                    this.aimVector.x * TOUCH_AIM_DISTANCE,
                    0,
                    canvas.width
                );

            game.input.mouse.y =
                clamp(
                    game.witness.y +
                    this.aimVector.y * TOUCH_AIM_DISTANCE,
                    0,
                    canvas.height
                );
        }

        requestAnimationFrame(
            () => this._rafLoop()
        );
    }

    /* =====================================================
       ABILITY CARDS — reused as tap targets

       Located via the existing cooldown-bar ids already in
       the HUD (cooldownQ, cooldownC, ...), then walking up to
       their containing .abilityCard — no new ids were added
       to game.html for this, keeping the HTML diff minimal.
    ===================================================== */

    _wireAbilityCards() {

        /* THE EYE has no dedicated card/button on purpose — the
           aim pad already fires it (mouse.down while dragging),
           mirroring how holding left-click fires it on PC. A
           separate tap target would be pure redundancy. */

        const bindings = [
            { cooldownId: "cooldownQ", key: "q" },
            { cooldownId: "cooldownC", key: "c" },
            { cooldownId: "cooldownE", key: "e" },
            { cooldownId: "cooldownR", key: "r" },
            { cooldownId: "cooldownF", key: "f" },
            { cooldownId: "cooldownDash", key: " " }
        ];

        for (const binding of bindings) {

            const bar =
                document.getElementById(binding.cooldownId);

            if (!bar) {
                continue;
            }

            const card =
                bar.closest(".abilityCard");

            if (!card) {
                continue;
            }

            card.classList.add("touchTappable");

            card.addEventListener(
                "pointerdown",
                event => {

                    event.preventDefault();

                    this.game.input.keys[binding.key] = true;
                },
                { passive: false }
            );

            const release = () => {

                this.game.input.keys[binding.key] = false;
            };

            card.addEventListener("pointerup", release);
            card.addEventListener("pointercancel", release);
            card.addEventListener("pointerleave", release);
        }
    }
}
