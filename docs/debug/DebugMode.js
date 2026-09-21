"use strict";

/* =========================================================
   THE SWARM BELOW — DEVELOPMENT TOOL
   DebugMode.js

   Lets a specific wave or boss be reached instantly instead
   of playing a full run to get there. Every method here goes
   through the SAME state-construction logic the real game
   uses when it naturally arrives at a wave (Game.startNewRun,
   Game.createMap, Game.getMapTierForWave, BOSS_SEQUENCE,
   createBossInstance) — it does not just poke `game.wave` and
   hope the rest of the systems notice.

   INERT BY DEFAULT: this class is only ever instantiated by
   game.js when the page URL contains `?debug=1`. Without that
   flag, this file still loads (harmless — it defines a class
   and does nothing else) but nothing in the normal game path
   ever creates a DebugMode instance, calls any of its methods,
   or exposes `window.debug`. Production behaviour, balance,
   controls and win/lose conditions are completely unaffected.

   WHY A SEPARATE FILE INSTEAD OF INLINING INTO game.js: this
   is exclusively a development concern, not part of the game
   itself — same reasoning that already put audio in its own
   folder. It must be loaded BEFORE game.js (see the <script>
   order in game.html) purely so the class already exists at
   the moment game.js's bottom-of-file bootstrap decides
   whether to instantiate it — everything the methods below
   reference at runtime (BOSS_SEQUENCE, createBossInstance,
   Witness, DefenseSystem, t(), the overlay screen elements)
   only needs to exist by the time a method is actually CALLED
   from the console, long after the whole page has loaded, so
   load order otherwise does not matter here.
========================================================= */

const BOSS_IDENTIFIERS = [
    "HARBINGER",
    "ABERRATION",
    "HOLLOW_CHOIR",
    "DEEP_MAW",
    "WATCHER_BENEATH",
    "UNRAVELING",
    "TAYATNA"
];

/* =========================================================
   ABILITY / STAT METADATA

   Web Audio and the wave system can be inspected directly
   from the live objects — but an upgrade's `apply(game)` is
   an opaque closure (see UpgradeSystem in game.js), so there
   is no way to ask JavaScript "what does this upgrade change
   and by how much" without actually executing it. This table
   is a hand-written mirror of what each apply() body already
   does, used ONLY for human-readable inspection/comparison
   output — it never runs instead of the real apply(), and it
   never substitutes for UpgradeSystem.purchase(), which is
   what actually performs a purchase. If an upgrade's apply()
   is ever edited in game.js, this table must be updated to
   match — that coupling is documented here on purpose so it
   is not missed. */

const UPGRADE_STAT_MAP = {

    sharpEye: { target: "defense", field: "eyeDamage", perLevel: 8 },
    deepReservoir: { target: "witness", field: "maxEnergy", perLevel: 20 },
    hardenedForm: { target: "witness", field: "maxIntegrity", perLevel: 15 },
    thornGrowth: { target: "defense", field: "thornDamage", perLevel: 12 },
    gravityRemembers: { target: "defense", field: "gravityDuration", perLevel: 1000 },
    piercingEye: { target: "defense", field: "eyePierce", perLevel: 1 },
    longChorus: { target: "defense", field: "chorusDamage", perLevel: 25 },
    livingNerve: { target: "witness", field: "energyRegen", perLevel: 0.006 },
    echoHunger: { target: "game", field: "echoMultiplier", perLevel: 0.25 },
    memoryHarvest: { target: "game", field: "memoryDropChance", perLevel: 0.20 }
};

/* Ability key → DefenseSystem field names, used by
   inspectAbility()/listAbilities() to print the stats that
   actually matter for each one, instead of dumping every
   field on DefenseSystem for every ability. */

const ABILITY_STAT_FIELDS = {

    eye: ["eyeDamage", "eyePierce"],
    thorn: ["thornDamage", "thornPush", "thornRange"],
    gravity: ["gravityDuration", "gravityRadius"],
    chorus: ["chorusDamage"],
    mouth: ["mouthThreshold"],
    call: ["callCost", "callAlertDuration"]
};

class DebugMode {

    constructor(game, audio, deviceDetector) {

        this.game = game;
        this.audio = audio || null;
        this.deviceDetector = deviceDetector || null;

        /* One-time snapshot of DefenseSystem/Witness values at
           the moment debug mode was turned on, used as the
           "BASE" reference for inspectAbility()/compareUpgrade().
           Taken here rather than re-deriving it from the class
           source, since the constructors are the single real
           source of truth for base values already. */

        this._baseDefenseSnapshot =
            this._snapshotObject(
                new DefenseSystem(game)
            );

        this._baseWitnessSnapshot =
            this._snapshotObject(
                new Witness(game)
            );

        this.telemetry = this._freshTelemetry();

        this._wrapAbilitiesForTelemetry();

        console.log(
            "%c[DEBUG MODE ACTIVE]",
            "color:#8b0000;font-weight:bold;font-size:13px;",
            "\nThe Swarm Below — development tool enabled " +
            "via ?debug=1. This build is NOT representative " +
            "of normal play.\n\n" +
            "WAVES / BOSSES\n" +
            "  debug.startAtWave(n)\n" +
            "  debug.restartCurrentWave()\n" +
            "  debug.nextWave() / debug.previousWave()\n" +
            "  debug.spawnBoss(id)      — number 1-7 or name\n" +
            "  debug.listBosses()\n\n" +
            "RESOURCES\n" +
            "  debug.setResources({echo, memory, energy, integrity})\n" +
            "  debug.setEcho(n) / setMemory(n) / setEnergy(n) / setIntegrity(n)\n\n" +
            "ABILITIES & UPGRADES\n" +
            "  debug.listAbilities()\n" +
            "  debug.inspectAbility(\"eye\")\n" +
            "  debug.listUpgrades()\n" +
            "  debug.buyUpgrade(id, times)\n" +
            "  debug.maxUpgrade(id, cap)\n" +
            "  debug.compareUpgrade(id, levels)\n" +
            "  debug.buildPreset({ sharpEye: 3, thornGrowth: 2 })\n\n" +
            "SCENARIOS / RESET\n" +
            "  debug.setScenario({ wave, echo, memory, energy, " +
            "integrity, upgrades })\n" +
            "  debug.resetResources() / resetAbilities() / " +
            "resetRun() / resetAll()\n\n" +
            "TELEMETRY\n" +
            "  debug.getTelemetry() / printTelemetry() / resetTelemetry()\n\n" +
            "INPUT\n" +
            "  debug.input()            — device mode, touch capability, viewport"
        );
    }

    /* =====================================================
       CORE: build a clean, consistent state for wave `n`

       This mirrors Game.startNewRun() field-for-field (see
       game.js) instead of only setting `this.wave`, so waves
       reached this way behave exactly like waves reached by
       actually playing — same map tier, same boss trigger
       rules, same clean set of enemies/projectiles/effects.
    ===================================================== */

    startAtWave(n) {

        const game = this.game;

        const wave =
            Math.max(1, Math.floor(n));

        /* --- full cleanup, same fields Game.startNewRun()
           resets, so nothing from a previous test bleeds
           into this one --- */

        game.fragments = [];
        game.projectiles = [];
        game.drops = [];

        game.gravityFields = [];
        game.dangerZones = [];

        game.boss = null;

        game.triggeredBossWaves =
            new Set();

        game.echo = 0;
        game.memory = 0;

        game.kills = 0;
        game.nextUpgradeKills = 10;
        game.totalSpawned = 0;

        game.timeAlive = 0;

        game.combo = 0;
        game.maxCombo = 1;

        game.largestConvergence = 0;

        game.aberrationsKilled = 0;

        game.tayatnaDefeated = false;

        game.waveAdjusted = false;

        game.spawnTimer = 500;

        game.echoMultiplier = 1;

        game.memoryDropChance = 0.025;

        game.witness =
            new Witness(game);

        game.defense =
            new DefenseSystem(game);

        /* Fresh Witness/DefenseSystem instances lose the
           telemetry wrapping applied to the previous ones —
           re-apply it here so usage tracking survives every
           wave jump, not just the first one. */

        this._wrapAbilitiesForTelemetry();

        /* --- the two pieces that differ from wave 1 --- */

        game.wave = wave;

        game.waveTimer =
            game.waveDuration;

        game.createMap(
            game.getMapTierForWave(wave)
        );

        /* Known, intentional limitation: this does NOT grant
           the Memory Fracture upgrades a real run would have
           accumulated by this wave. Simulating a plausible
           upgrade path would be a guess, not a fact, so the
           Witness/DefenseSystem here start at their base
           values regardless of how high `wave` is. You are
           testing wave/boss CONTENT and DIFFICULTY as
           authored, not a specific build. */

        this._hideAllOverlays();

        game.state = "PLAYING";

        game.showEvent(
            t("waveEvent", { n: wave })
        );

        /* Same check the natural wave-increment code path
           runs in Game.update() — if this wave is a boss
           wave, spawn it now instead of waiting for the
           player to reach it. */

        const bossKey =
            BOSS_SEQUENCE[wave];

        if (bossKey) {

            const bossInstance =
                createBossInstance(
                    bossKey,
                    game
                );

            if (bossInstance) {

                game.boss = bossInstance;

                game.triggeredBossWaves.add(
                    wave
                );

                game.showEvent(
                    t(
                        bossInstance.arrivalKey ||
                        "aberrationDescends"
                    )
                );
            }
        }

        game.updateHUD();

        if (this.audio) {

            this.audio.update(
                {
                    wave: game.wave,
                    enemyCount: game.fragments.length,
                    playerHealthRatio: 1,
                    bossActive: !!game.boss,
                    tayatnaActive:
                        !!game.boss &&
                        game.boss.labelKey ===
                        "bossTitleTayatna"
                },
                0.4
            );
        }

        console.log(
            `[DEBUG] Wave ${wave} ready` +
            (bossKey ? ` — boss: ${bossKey}` : " — no boss this wave")
        );
    }

    restartCurrentWave() {

        this.startAtWave(this.game.wave);
    }

    nextWave() {

        this.startAtWave(this.game.wave + 1);
    }

    previousWave() {

        this.startAtWave(
            Math.max(1, this.game.wave - 1)
        );
    }

    reset() {

        this.startAtWave(1);
    }

    /* =====================================================
       DIRECT BOSS TEST

       Independent of wave progression: spawns a boss right
       on top of the player, on a cleared arena, with the
       Witness reset to full health/energy so a bad previous
       test never carries into the next one. Does not touch
       `game.wave` — the boss still uses whatever wave is
       currently set for any wave-dependent scaling (e.g.
       Aberration's HP formula), which is normally the most
       useful thing to test anyway.
    ===================================================== */

    spawnBoss(identifier) {

        const game = this.game;

        const key =
            this._resolveBossKey(identifier);

        if (!key) {

            console.warn(
                `[DEBUG] Unknown boss identifier: ${identifier}. ` +
                "Use debug.listBosses() to see valid values."
            );

            return;
        }

        game.fragments = [];
        game.projectiles = [];
        game.drops = [];
        game.gravityFields = [];
        game.dangerZones = [];

        game.boss = null;

        game.witness =
            new Witness(game);

        /* Same reasoning as in startAtWave(): a fresh Witness
           needs its dash telemetry wrapper re-applied. */

        this._wrapAbilitiesForTelemetry();

        this._hideAllOverlays();

        game.state = "PLAYING";

        const bossInstance =
            createBossInstance(key, game);

        if (!bossInstance) {

            console.warn(
                `[DEBUG] "${key}" has no implemented class yet.`
            );

            return;
        }

        game.boss = bossInstance;

        game.showEvent(
            t(
                bossInstance.arrivalKey ||
                "aberrationDescends"
            )
        );

        game.updateHUD();

        if (this.audio) {

            this.audio.update(
                {
                    wave: game.wave,
                    enemyCount: 0,
                    playerHealthRatio: 1,
                    bossActive: true,
                    tayatnaActive: key === "TAYATNA"
                },
                0.4
            );
        }

        console.log(
            `[DEBUG] Spawned boss: ${key} ` +
            `(current game.wave = ${game.wave}, affects ` +
            "any wave-dependent stat scaling)"
        );
    }

    listBosses() {

        BOSS_IDENTIFIERS.forEach((name, index) => {

            console.log(`${index + 1} → ${name}`);
        });
    }

    /* =====================================================
       INPUT DIAGNOSTICS
    ===================================================== */

    input() {

        const report = {
            deviceMode:
                this.deviceDetector
                    ? this.deviceDetector.current
                    : "unknown (DeviceDetector not loaded)",
            capabilities:
                this.deviceDetector
                    ? this.deviceDetector.capabilities
                    : null,
            maxTouchPoints: navigator.maxTouchPoints || 0,
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight
            },
            orientation:
                window.matchMedia("(orientation: portrait)").matches
                    ? "portrait"
                    : "landscape",
            devicePixelRatio: window.devicePixelRatio || 1,
            activeJoystickPointer:
                window.touchControls
                    ? window.touchControls.joystickPointerId
                    : null,
            activeAimPointer:
                window.touchControls
                    ? window.touchControls.aimPointerId
                    : null
        };

        console.log("[DEBUG] Input state:", report);

        return report;
    }

    /* =====================================================
       RESOURCES

       Thin wrappers over the real fields — no separate
       "resource system" invented, this touches exactly what
       Drop.collect()/UpgradeSystem already touch.
    ===================================================== */

    setResources(values = {}) {

        const game = this.game;

        if (values.echo !== undefined) {

            game.echo =
                Math.max(0, Math.floor(values.echo));
        }

        if (values.memory !== undefined) {

            game.memory =
                Math.max(0, Math.floor(values.memory));
        }

        if (values.energy !== undefined) {

            game.witness.energy =
                clamp(
                    values.energy,
                    0,
                    game.witness.maxEnergy
                );
        }

        if (values.integrity !== undefined) {

            game.witness.integrity =
                clamp(
                    values.integrity,
                    0,
                    game.witness.maxIntegrity
                );
        }

        game.updateHUD();

        console.log(
            "[DEBUG] Resources set:",
            {
                echo: game.echo,
                memory: game.memory,
                energy: game.witness.energy,
                integrity: game.witness.integrity
            }
        );
    }

    setEcho(n) {
        this.setResources({ echo: n });
    }

    setMemory(n) {
        this.setResources({ memory: n });
    }

    setEnergy(n) {
        this.setResources({ energy: n });
    }

    setIntegrity(n) {
        this.setResources({ integrity: n });
    }

    /* =====================================================
       ABILITY INSPECTION

       Reads the SAME live objects the game plays with —
       game.defense / game.witness — nothing here is cached
       or duplicated, so it is always accurate to the current
       run's actual state.
    ===================================================== */

    listAbilities() {

        Object.keys(ABILITY_STAT_FIELDS).forEach(id => {

            this.inspectAbility(id);
        });
    }

    inspectAbility(abilityKey) {

        const game = this.game;
        const fields = ABILITY_STAT_FIELDS[abilityKey];

        if (!fields) {

            console.warn(
                `[DEBUG] Unknown ability "${abilityKey}". ` +
                `Valid: ${Object.keys(ABILITY_STAT_FIELDS).join(", ")}`
            );

            return null;
        }

        const cooldownKey =
            abilityKey === "call"
                ? "q"
                : abilityKey === "thorn"
                    ? "c"
                    : abilityKey === "gravity"
                        ? "e"
                        : abilityKey;

        const report = {
            ability: abilityKey,
            cooldownMs: game.defense.cooldowns[cooldownKey],
            stats: {}
        };

        for (const field of fields) {

            report.stats[field] = {
                base: this._baseDefenseSnapshot[field],
                current: game.defense[field]
            };
        }

        console.log(
            `[DEBUG] ${abilityKey.toUpperCase()}`,
            report
        );

        return report;
    }

    /* =====================================================
       UPGRADES / BUILDS

       buyUpgrade/maxUpgrade/buildPreset all funnel through
       UpgradeSystem.purchase() — the exact same method the
       real Memory Fracture screen calls. If game.echo is too
       low, this tops up ONLY the missing amount (via the
       resource setter above) rather than reimplementing what
       a purchase does. The purchase logic itself is never
       duplicated.
    ===================================================== */

    listUpgrades() {

        const game = this.game;

        game.upgrades.upgrades.forEach(upgrade => {

            console.log(
                `${upgrade.id} — level ` +
                `${game.upgrades.purchaseCount[upgrade.id]}, ` +
                `next cost ${game.upgrades.getCost(upgrade)}`
            );
        });
    }

    buyUpgrade(upgradeId, times = 1) {

        const game = this.game;
        const upgrade =
            game.upgrades.upgrades.find(
                u => u.id === upgradeId
            );

        if (!upgrade) {

            console.warn(
                `[DEBUG] Unknown upgrade id "${upgradeId}". ` +
                "Use debug.listUpgrades() to see valid ids."
            );

            return;
        }

        for (let i = 0; i < times; i++) {

            const cost =
                game.upgrades.getCost(upgrade);

            if (game.echo < cost) {

                game.echo = cost;
            }

            const bought =
                game.upgrades.purchase(upgradeId);

            if (!bought) {

                console.warn(
                    `[DEBUG] Purchase ${i + 1} of "${upgradeId}" ` +
                    "failed unexpectedly."
                );

                break;
            }
        }

        game.updateHUD();

        console.log(
            `[DEBUG] ${upgradeId} is now level ` +
            `${game.upgrades.purchaseCount[upgradeId]}`
        );
    }

    maxUpgrade(upgradeId, cap = 10) {

        this.buyUpgrade(upgradeId, cap);
    }

    /* Buys several upgrades in one call, e.g.
       debug.buildPreset({ sharpEye: 3, thornGrowth: 2 }) */

    buildPreset(levels = {}) {

        Object.keys(levels).forEach(id => {

            this.buyUpgrade(id, levels[id]);
        });
    }

    /* Shows BASE, CURRENT (as actually purchased right now)
       and a PROJECTED value `levels` purchases further —
       projection uses the hand-written UPGRADE_STAT_MAP
       (see top of file) since apply() cannot be previewed
       without executing it. Flagged clearly as projected. */

    compareUpgrade(upgradeId, levels = 1) {

        const game = this.game;
        const meta = UPGRADE_STAT_MAP[upgradeId];

        if (!meta) {

            console.warn(
                `[DEBUG] No stat mapping for "${upgradeId}".`
            );

            return null;
        }

        const targetObject =
            meta.target === "defense"
                ? game.defense
                : meta.target === "witness"
                    ? game.witness
                    : game;

        const baseObject =
            meta.target === "defense"
                ? this._baseDefenseSnapshot
                : meta.target === "witness"
                    ? this._baseWitnessSnapshot
                    : null;

        const current =
            targetObject[meta.field];

        const base =
            baseObject
                ? baseObject[meta.field]
                : current -
                  (game.upgrades.purchaseCount[upgradeId] *
                  meta.perLevel);

        const projected =
            current + meta.perLevel * levels;

        const report = {
            upgrade: upgradeId,
            field: meta.field,
            level:
                game.upgrades.purchaseCount[upgradeId],
            base,
            current,
            [`projected(+${levels})`]: projected,
            nextCost:
                game.upgrades.getCost(
                    game.upgrades.upgrades.find(
                        u => u.id === upgradeId
                    )
                )
        };

        console.log(`[DEBUG] ${upgradeId}`, report);

        return report;
    }

    /* =====================================================
       REPRODUCIBLE SCENARIOS
    ===================================================== */

    setScenario(config = {}) {

        const game = this.game;

        this.startAtWave(config.wave || 1);

        this.setResources({
            echo: config.echo,
            memory: config.memory,
            energy: config.energy,
            integrity: config.integrity
        });

        if (config.upgrades) {

            this.buildPreset(config.upgrades);
        }

        console.log(
            "[DEBUG] Scenario ready:",
            config
        );
    }

    /* =====================================================
       DIFFERENTIATED RESETS
    ===================================================== */

    resetResources() {

        this.setResources({
            echo: 0,
            memory: 0,
            energy: this.game.witness.maxEnergy,
            integrity: this.game.witness.maxIntegrity
        });
    }

    /* Debug-only fix for the finding documented at the top of
       this file: UpgradeSystem/purchaseCount normally survive
       across retries within the same browser session (Game
       never recreates game.upgrades). This forces a truly
       clean ability state for testing — it does NOT change
       what happens on a normal Retry in the real game. */

    resetAbilities() {

        const game = this.game;

        game.witness.maxIntegrity =
            this._baseWitnessSnapshot.maxIntegrity;

        game.witness.maxEnergy =
            this._baseWitnessSnapshot.maxEnergy;

        game.witness.energyRegen =
            this._baseWitnessSnapshot.energyRegen;

        game.witness.integrity =
            game.witness.maxIntegrity;

        game.witness.energy =
            game.witness.maxEnergy;

        game.defense =
            new DefenseSystem(game);

        game.echoMultiplier = 1;
        game.memoryDropChance = 0.025;

        game.upgrades =
            new UpgradeSystem(game);

        /* resetAbilities() replaces game.defense with a brand
           new instance — telemetry wrapping was applied to the
           OLD instance's methods, so it needs to be re-applied
           here or usage tracking would silently stop working
           after any reset. */

        this._wrapAbilitiesForTelemetry();

        game.updateHUD();

        console.log(
            "[DEBUG] Abilities and upgrade levels reset to base."
        );
    }

    resetRun() {

        this.startAtWave(1);
    }

    resetAll() {

        this.resetAbilities();
        this.resetRun();
        this.resetTelemetry();

        console.log("[DEBUG] Full reset complete.");
    }

    /* =====================================================
       TELEMETRY

       Wraps the real DefenseSystem ability methods instead of
       editing them — zero lines changed in game.js for this,
       zero behaviour change, the original function always
       still runs exactly as before. Records call counts and
       energy actually spent per use (measured, not assumed).

       KNOWN LIMITATION (documented, not solved here): kills
       are not attributed to the ability that caused them.
       Doing that honestly would require tagging projectiles
       and area-effect hits with their source ability inside
       Projectile/Fragment.damage(), which is a real gameplay
       code change — flagged for your authorization rather
       than implemented silently.
    ===================================================== */

    getTelemetry() {

        return this.telemetry;
    }

    printTelemetry() {

        console.table(this.telemetry.abilities);

        console.log(
            "[DEBUG] Kills:", this.telemetry.kills,
            "| Waves seen:", [...this.telemetry.wavesSeen]
        );
    }

    resetTelemetry() {

        this.telemetry = this._freshTelemetry();

        console.log("[DEBUG] Telemetry cleared.");
    }

    /* =====================================================
       INTERNAL
    ===================================================== */

    _freshTelemetry() {

        const abilities = {};

        for (const key of Object.keys(ABILITY_STAT_FIELDS)) {

            abilities[key] = { uses: 0, energySpent: 0 };
        }

        abilities.dash = { uses: 0, energySpent: 0 };

        return {
            abilities,
            kills: 0,
            wavesSeen: new Set()
        };
    }

    _snapshotObject(instance) {

        const snapshot = {};

        for (const key in instance) {

            const value = instance[key];

            if (
                typeof value === "number" ||
                typeof value === "string" ||
                typeof value === "boolean"
            ) {

                snapshot[key] = value;
            }
        }

        return snapshot;
    }

    _wrapAbilitiesForTelemetry() {

        const game = this.game;
        const telemetry = this.telemetry;

        const methodToKey = {
            fireEye: "eye",
            thorn: "thorn",
            gravity: "gravity",
            chorus: "chorus",
            mouth: "mouth",
            theCall: "call"
        };

        for (const methodName in methodToKey) {

            const key = methodToKey[methodName];
            const original =
                game.defense[methodName].bind(game.defense);

            game.defense[methodName] = (...args) => {

                const before = game.witness.energy;

                original(...args);

                const spent =
                    Math.max(0, before - game.witness.energy);

                telemetry.abilities[key].uses++;
                telemetry.abilities[key].energySpent += spent;
                telemetry.wavesSeen.add(game.wave);
            };
        }

        const originalDash =
            game.witness.dash.bind(game.witness);

        game.witness.dash = (...args) => {

            const before = game.witness.energy;

            originalDash(...args);

            const spent =
                Math.max(0, before - game.witness.energy);

            if (spent > 0) {

                telemetry.abilities.dash.uses++;
                telemetry.abilities.dash.energySpent += spent;
            }
        };

        const originalRegisterKill =
            game.registerKill.bind(game);

        game.registerKill = (...args) => {

            telemetry.kills++;

            originalRegisterKill(...args);
        };
    }

    /* =====================================================
       INTERNAL — bosses/overlays (unchanged from before)
    ===================================================== */

    _resolveBossKey(identifier) {

        if (typeof identifier === "number") {

            return BOSS_IDENTIFIERS[identifier - 1] || null;
        }

        if (typeof identifier !== "string") {
            return null;
        }

        const normalized =
            identifier
                .trim()
                .toUpperCase()
                .replace(/[\s-]+/g, "_");

        if (BOSS_IDENTIFIERS.includes(normalized)) {

            return normalized;
        }

        /* Also accept the name with no separators at all,
           e.g. "hollowchoir" or "deepmaw". */

        const collapsed =
            normalized.replace(/_/g, "");

        const match =
            BOSS_IDENTIFIERS.find(
                name =>
                    name.replace(/_/g, "") === collapsed
            );

        return match || null;
    }

    _hideAllOverlays() {

        titleScreen.classList.add("hidden");
        tutorialScreen.classList.add("hidden");
        pauseScreen.classList.add("hidden");
        upgradeScreen.classList.add("hidden");
        gameOverScreen.classList.add("hidden");
        victoryScreen.classList.add("hidden");
        creditsScreen.classList.add("hidden");
        bossHUD.classList.add("hidden");
    }
}
