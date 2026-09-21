"use strict";

/* =========================================================
   THE SWARM BELOW — INPUT ADAPTER
   DeviceDetector.js

   Does not assume the device from navigator.userAgent alone.
   Combines touch capability, pointer type and Pointer Events
   to decide an INITIAL mode, then keeps listening for real
   interaction afterwards so a hybrid device (touch laptop,
   Surface, iPad with a trackpad) can switch live between PC
   and mobile controls instead of being locked into whatever
   was guessed at load time.

   This module only ever DECIDES the mode and exposes it. It
   never touches gameplay — TouchControls.js is the piece that
   actually writes into InputSystem.
========================================================= */

class DeviceDetector {

    constructor() {

        this.current = this._guessInitialMode();

        this.capabilities =
            this._snapshotCapabilities();

        this.listeners = [];

        this._bindModeSwitching();
    }

    onChange(callback) {

        this.listeners.push(callback);
    }

    _guessInitialMode() {

        const hasTouchPoints =
            navigator.maxTouchPoints > 0;

        const coarsePrimary =
            window.matchMedia &&
            window.matchMedia("(pointer: coarse)").matches;

        const finePrimary =
            window.matchMedia &&
            window.matchMedia("(pointer: fine)").matches;

        /* A device with a coarse primary pointer and no fine
           pointer at all (typical phone/tablet) starts in
           mobile mode. Anything with a fine pointer available
           (mouse, trackpad, pen) starts in PC mode, even if it
           also has touch — that covers touch laptops, which
           should default to keyboard/mouse until the user
           actually touches the screen. */

        if (hasTouchPoints && coarsePrimary && !finePrimary) {

            return "mobile";
        }

        return "pc";
    }

    _snapshotCapabilities() {

        return {
            maxTouchPoints: navigator.maxTouchPoints || 0,
            coarsePointer:
                !!(window.matchMedia &&
                window.matchMedia("(pointer: coarse)").matches),
            finePointer:
                !!(window.matchMedia &&
                window.matchMedia("(pointer: fine)").matches),
            anyHover:
                !!(window.matchMedia &&
                window.matchMedia("(hover: hover)").matches)
        };
    }

    /* Pointer Events already unify mouse/touch/pen into one
       event type with a `.pointerType` field — that is the
       single reliable signal used here to decide "which
       control scheme did the player just actually use",
       rather than guessing again from device properties. */

    _bindModeSwitching() {

        window.addEventListener(
            "pointerdown",
            event => {

                if (event.pointerType === "touch") {

                    this._setMode("mobile");
                }

                else if (
                    event.pointerType === "mouse" ||
                    event.pointerType === "pen"
                ) {

                    this._setMode("pc");
                }
            },
            { passive: true }
        );

        window.addEventListener(
            "keydown",
            () => {

                this._setMode("pc");
            }
        );
    }

    _setMode(mode) {

        if (mode === this.current) {
            return;
        }

        this.current = mode;

        document.body.setAttribute(
            "data-input-mode",
            mode
        );

        for (const callback of this.listeners) {

            callback(mode);
        }
    }
}
