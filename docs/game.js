"use strict";

/* =========================================================
   THE SWARM BELOW
   ALPHA 0.3
   ========================================================= */

/* =========================================================
   UTILITIES
========================================================= */

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function random(min, max) {
    return Math.random() * (max - min) + min;
}

function distance(x1, y1, x2, y2) {
    return Math.hypot(x2 - x1, y2 - y1);
}

function normalize(x, y) {
    const length = Math.hypot(x, y);

    if (length === 0) {
        return { x: 0, y: 0 };
    }

    return {
        x: x / length,
        y: y / length
    };
}

function angleTo(x1, y1, x2, y2) {
    return Math.atan2(y2 - y1, x2 - x1);
}

/* =========================================================
   WAVE DESIGN
========================================================= */

const WAVE_ARCHETYPES = {

    DEFAULT: {
        countMult: 1,
        hpMult: 1,
        speedMult: 1,
        intervalMult: 1,
        expectedPopulation: 20
    },

    ENJAMBRE: {
        countMult: 1.8,
        hpMult: 0.75,
        speedMult: 1.0,
        intervalMult: 0.85,
        expectedPopulation: 40
    },

    CAZA: {
        countMult: 0.6,
        hpMult: 0.9,
        speedMult: 1.35,
        intervalMult: 1.1,
        expectedPopulation: 18
    },

    RESISTENCIA: {
        countMult: 1.0,
        hpMult: 1.5,
        speedMult: 0.9,
        intervalMult: 1.0,
        expectedPopulation: 25
    },

    RESPIRO: {
        countMult: 0.5,
        hpMult: 0.85,
        speedMult: 0.85,
        intervalMult: 1.3,
        expectedPopulation: 12
    }
};

/* Index 0 = Wave 1. Wave 10 is boss-only, handled separately. */

const WAVE_SEQUENCE = [

    "DEFAULT",
    "ENJAMBRE",
    "CAZA",
    "ENJAMBRE",
    "RESISTENCIA",
    "RESPIRO",
    "ENJAMBRE",
    "CAZA",
    "RESISTENCIA"
];

/* Boss appearance schedule. Each entry maps a wave number
   to the boss class that should spawn there. Multiple waves
   can point to the same class (recurring bosses). */

const BOSS_SEQUENCE = {

    5: "HARBINGER",
    10: "ABERRATION",
    15: "HOLLOW_CHOIR",
    17: "HARBINGER",
    20: "DEEP_MAW",
    23: "HARBINGER",
    25: "WATCHER_BENEATH",
    28: "ABERRATION",
    30: "UNRAVELING",
    32: "HARBINGER",
    35: "ABERRATION",
    37: "TAYATNA"
};

function createBossInstance(bossKey, game) {

    if (bossKey === "HARBINGER") {
        return new HarbingerBoss(game);
    }

    if (bossKey === "ABERRATION") {
        return new AberrationBoss(game);
    }

    if (bossKey === "HOLLOW_CHOIR") {
        return new HollowChoirBoss(game);
    }

    if (bossKey === "DEEP_MAW") {
        return new DeepMawBoss(game);
    }

    if (bossKey === "WATCHER_BENEATH") {
        return new WatcherBeneathBoss(game);
    }

    if (bossKey === "UNRAVELING") {
        return new UnravelingBoss(game);
    }

    if (bossKey === "TAYATNA") {
        return new TayatnaBoss(game);
    }

    /* Placeholder classes for bosses not yet designed.
       Returning null means BOSS_SEQUENCE will simply be
       skipped for that wave until the class is implemented
       in a later task. */

    return null;
}

function getWaveArchetype(wave) {

    if (wave === 10) {
        return WAVE_ARCHETYPES.DEFAULT;
    }

    if (wave <= WAVE_SEQUENCE.length) {

        const key =
            WAVE_SEQUENCE[wave - 1];

        return WAVE_ARCHETYPES[key];
    }

    /* Beyond wave 9, loop the wave 2-9 pattern indefinitely */

    const cycleLength =
        WAVE_SEQUENCE.length - 1;

    const loopIndex =
        ((wave - 1) % cycleLength) + 1;

    const key =
        WAVE_SEQUENCE[loopIndex];

    return WAVE_ARCHETYPES[key] || WAVE_ARCHETYPES.DEFAULT;
}

function getWavePhaseMultiplier(elapsed, waveDuration) {

    const progress =
        elapsed / waveDuration;

    if (progress < 0.27) {

        /* ENTRADA */
        return 1.3;
    }

    if (progress < 0.67) {

        /* PRESIÓN */
        return 1.0;
    }

    /* SATURACIÓN */
    return 0.65;
}

function calculateSwarmPressure(game) {

    const archetype =
        getWaveArchetype(game.wave);

    const aliveFragments =
        game.fragments.filter(
            f => !f.dead
        );

    const fragmentRatio =
        clamp(
            aliveFragments.length /
            archetype.expectedPopulation,
            0,
            1
        );

    let largestCluster = 0;

    for (const fragment of aliveFragments) {

        if (
            fragment.clusterSize >
            largestCluster
        ) {

            largestCluster =
                fragment.clusterSize;
        }
    }

    const clusterFactor =
        clamp(
            largestCluster / 25,
            0,
            1
        );

    return clamp(
        (fragmentRatio * 0.5) +
        (clusterFactor * 0.5),
        0,
        1
    );
}

/* =========================================================
   LANGUAGE
========================================================= */

const TEXT = {

    en: {

        titleSubtitle: "SOMETHING IS WATCHING FROM BELOW",

        enter: "ENTER",
        language: "LANGUAGE",

        intro: "INTRODUCTION",
        tutorial: "TUTORIAL",
        next: "NEXT",
        back: "BACK",
        skip: "SKIP",
        start: "BEGIN",

        pause: "PAUSE",
        paused: "PAUSED",
        resume: "RESUME",
        restart: "RESTART",

        introductionTitle: "THE WITNESS",
        introductionText:
            "You are THE WITNESS. Something beneath the world has begun to move. Stay alive and observe the convergence.",

        movementTitle: "MOVEMENT",
        movementText:
            "Use WASD to move through the arena. Aim with the mouse. Survive contact with the FRAGMENTS.",

        echoTitle: "ECHO",
        echoText:
            "Defeated FRAGMENTS leave ECHO behind. Collect it physically, or use THE CALL to pull it all toward you at once. ECHO is used to strengthen your abilities.",

        convergenceTitle: "CONVERGENCE",
        convergenceText:
            "When FRAGMENTS gather together they become more dangerous: CLUSTER, NEST, MASS and eventually ABERRATION.",

        abilitiesTitle: "DEFENSES",
        abilitiesText:
            "CLICK fires THE EYE. Q performs THE CALL. C releases THORN. E creates GRAVITY WOMB. R unleashes CHORUS. F uses THE MOUTH. SPACE performs DASH.",

        bossProgressionTitle: "WHAT RISES BELOW",
        bossProgressionText:
            "Every few waves, something ancient rises to meet you. Survive their arrival — what follows will only grow heavier.",

        tutorialStart: "BEGIN",

        memoryFracture: "MEMORY FRACTURE",
        chooseMemory: "CHOOSE A MEMORY TO CARRY FORWARD",

        gameOver: "THE WITNESS FADES",
        gameOverSubtitle: "THE SWARM REMEMBERS",
        tryAgain: "TRY AGAIN",

        witness: "THE WITNESS",
        swarmWaiting: "THE SWARM IS WAITING",
        escResume: "ESC TO RESUME",

        wave: "WAVE",
        kills: "KILLS",
        echo: "ECHO",
        memory: "MEMORY",
        maxCombo: "MAX COMBO",
        largestConvergence: "LARGEST CONVERGENCE",

        resourceIntegrity: "INTEGRITY",
        resourceEnergy: "ENERGY",
        comboLabel: "COMBO",
        controlsHint:
            "WASD MOVE | MOUSE AIM | CLICK FIRE | Q CALL",

        waveEvent: "WAVE {n}",
        mapTransitionTier2: "THE DESCENT NARROWS",
        mapTransitionTier3: "THE DEPTHS CLOSE IN",
        aberrationDescends: "ABERRATION DESCENDS",
        aberrationDestroyed: "ABERRATION DESTROYED",
        aberrationReward: "+2500 ECHO  +5 MEMORY",

        harbingerDescends: "THE HARBINGER RISES",
        harbingerDestroyed: "THE HARBINGER FALLS",
        harbingerReward: "+800 ECHO  +2 MEMORY",

        bossTitleAberration: "ABERRATION",
        bossTitleHarbinger: "THE HARBINGER",
        bossTitleHollowChoir: "THE HOLLOW CHOIR",
        bossTitleDeepMaw: "THE DEEP MAW",
        bossTitleWatcher: "THE WATCHER BENEATH",
        bossTitleUnraveling: "THE UNRAVELING",
        bossTitleTayatna: "TAYATNA",

        tayatnaDescends: "TAYATNA STIRS BENEATH",
        tayatnaSorrow: "THE WEIGHT SETTLES",
        tayatnaDeepens: "THE GRIEF DEEPENS",
        tayatnaDestroyed: "TAYATNA FALLS SILENT",
        tayatnaReward: "+4000 ECHO  +10 MEMORY",

        hollowChoirDescends: "THE HOLLOW CHOIR AWAKENS",
        hollowChoirDestroyed: "THE HOLLOW CHOIR IS SILENCED",
        hollowChoirReward: "+1200 ECHO  +3 MEMORY",

        deepMawDescends: "THE DEEP MAW SURFACES",
        deepMawDestroyed: "THE DEEP MAW COLLAPSES",
        deepMawReward: "+1800 ECHO  +4 MEMORY",

        watcherDescends: "SOMETHING OPENS ITS EYE",
        watcherDestroyed: "THE WATCHER BENEATH CLOSES",
        watcherReward: "+1500 ECHO  +3 MEMORY",

        unravelingDescends: "SOMETHING BEGINS TO COME APART",
        unravelingFragments: "THE UNRAVELING SPLITS",
        unravelingDestroyed: "THE UNRAVELING CEASES",
        unravelingReward: "+1900 ECHO  +4 MEMORY",

        chorusEvent: "CHORUS",
        mouthEvent: "THE MOUTH +{n}",
        theCallEvent: "THE CALL",
        gatherEcho: "GATHER ECHO FOR AN UPGRADE",

        echoPickup: "+{n} ECHO",
        energyPickup: "+{n} ENERGY",
        healPickup: "+{n} INTEGRITY",
        memoryPickup: "+{n} MEMORY",

        upgradeSharpEyeName: "SHARPENED EYE",
        upgradeSharpEyeDesc: "+8 EYE damage.",
        upgradeDeepReservoirName: "DEEP RESERVOIR",
        upgradeDeepReservoirDesc: "+20 maximum ENERGY.",
        upgradeHardenedFormName: "HARDENED FORM",
        upgradeHardenedFormDesc:
            "+15 maximum INTEGRITY and heal 15.",
        upgradeThornGrowthName: "THORN GROWTH",
        upgradeThornGrowthDesc:
            "+12 THORN damage and +20 range.",
        upgradeGravityRemembersName: "GRAVITY REMEMBERS",
        upgradeGravityRemembersDesc:
            "+1000ms GRAVITY WOMB duration.",
        upgradePiercingEyeName: "PIERCING EYE",
        upgradePiercingEyeDesc: "+1 projectile pierce.",
        upgradeLongChorusName: "LONG CHORUS",
        upgradeLongChorusDesc: "+25 CHORUS damage.",
        upgradeLivingNerveName: "LIVING NERVE",
        upgradeLivingNerveDesc:
            "+0.006 ENERGY regeneration.",
        upgradeEchoHungerName: "ECHO HUNGER",
        upgradeEchoHungerDesc: "+25% ECHO from drops.",
        upgradeMemoryHarvestName: "MEMORY HARVEST",
        upgradeMemoryHarvestDesc:
            "+20% MEMORY drop chance.",

        languageName: "ENGLISH"
    },

    es: {

        titleSubtitle: "ALGO OBSERVA DESDE LAS PROFUNDIDADES",

        enter: "ENTRAR",
        language: "IDIOMA",

        intro: "INTRODUCCIÓN",
        tutorial: "TUTORIAL",
        next: "SIGUIENTE",
        back: "ATRÁS",
        skip: "SALTAR",
        start: "COMENZAR",

        pause: "PAUSA",
        paused: "PAUSA",
        resume: "CONTINUAR",
        restart: "REINICIAR",

        introductionTitle: "THE WITNESS",
        introductionText:
            "Tú eres THE WITNESS. Algo bajo el mundo ha comenzado a moverse. Sobrevive y observa la convergencia.",

        movementTitle: "MOVIMIENTO",
        movementText:
            "Usa WASD para moverte por la arena. Apunta con el mouse. Sobrevive al contacto con los FRAGMENTS.",

        echoTitle: "ECHO",
        echoText:
            "Los FRAGMENTS derrotados dejan ECHO. Recógelo físicamente, o usa THE CALL para atraerlo todo hacia ti de una vez. ECHO sirve para fortalecer tus habilidades.",

        convergenceTitle: "CONVERGENCIA",
        convergenceText:
            "Cuando los FRAGMENTS se agrupan se vuelven más peligrosos: CLUSTER, NEST, MASS y finalmente ABERRATION.",

        abilitiesTitle: "DEFENSAS",
        abilitiesText:
            "CLICK dispara THE EYE. Q ejecuta THE CALL. C libera THORN. E crea GRAVITY WOMB. R libera CHORUS. F usa THE MOUTH. SPACE ejecuta DASH.",

        bossProgressionTitle: "LO QUE SE ALZA DESDE ABAJO",
        bossProgressionText:
            "Cada cierto número de oleadas, algo ancestral se alza a tu encuentro. Sobrevive su llegada — lo que sigue después solo se volverá más pesado.",

        tutorialStart: "COMENZAR",

        memoryFracture: "FRACTURA DE MEMORIA",
        chooseMemory: "ELIGE UNA MEMORIA PARA LLEVAR CONTIGO",

        gameOver: "THE WITNESS SE DESVANECE",
        gameOverSubtitle: "THE SWARM RECUERDA",
        tryAgain: "INTENTAR DE NUEVO",

        witness: "THE WITNESS",
        swarmWaiting: "THE SWARM ESPERA",
        escResume: "ESC PARA CONTINUAR",

        wave: "OLA",
        kills: "BAJAS",
        echo: "ECHO",
        memory: "MEMORIA",
        maxCombo: "COMBO MÁXIMO",
        largestConvergence: "MAYOR CONVERGENCIA",

        resourceIntegrity: "INTEGRIDAD",
        resourceEnergy: "ENERGÍA",
        comboLabel: "COMBO",
        controlsHint:
            "WASD MOVER | MOUSE APUNTAR | CLICK DISPARAR | Q LLAMAR",

        waveEvent: "OLA {n}",
        mapTransitionTier2: "EL DESCENSO SE ESTRECHA",
        mapTransitionTier3: "LAS PROFUNDIDADES SE CIERRAN",
        aberrationDescends: "LA ABERRACIÓN DESCIENDE",
        aberrationDestroyed: "ABERRACIÓN DESTRUIDA",
        aberrationReward: "+2500 ECHO  +5 MEMORIA",

        harbingerDescends: "THE HARBINGER EMERGE",
        harbingerDestroyed: "THE HARBINGER CAE",
        harbingerReward: "+800 ECHO  +2 MEMORIA",

        bossTitleAberration: "ABERRATION",
        bossTitleHarbinger: "THE HARBINGER",
        bossTitleHollowChoir: "THE HOLLOW CHOIR",
        bossTitleDeepMaw: "THE DEEP MAW",
        bossTitleWatcher: "THE WATCHER BENEATH",
        bossTitleUnraveling: "THE UNRAVELING",
        bossTitleTayatna: "TAYATNA",

        tayatnaDescends: "TAYATNA SE REMUEVE EN LO PROFUNDO",
        tayatnaSorrow: "EL PESO SE ASIENTA",
        tayatnaDeepens: "LA PENA SE PROFUNDIZA",
        tayatnaDestroyed: "TAYATNA GUARDA SILENCIO",
        tayatnaReward: "+4000 ECHO  +10 MEMORIA",

        hollowChoirDescends: "EL CORO HUECO DESPIERTA",
        hollowChoirDestroyed: "EL CORO HUECO ENMUDECE",
        hollowChoirReward: "+1200 ECHO  +3 MEMORIA",

        deepMawDescends: "LAS FAUCES PROFUNDAS EMERGEN",
        deepMawDestroyed: "LAS FAUCES PROFUNDAS COLAPSAN",
        deepMawReward: "+1800 ECHO  +4 MEMORIA",

        watcherDescends: "ALGO ABRE SU OJO",
        watcherDestroyed: "EL VIGILANTE DE ABAJO SE CIERRA",
        watcherReward: "+1500 ECHO  +3 MEMORIA",

        unravelingDescends: "ALGO EMPIEZA A DESHACERSE",
        unravelingFragments: "THE UNRAVELING SE PARTE",
        unravelingDestroyed: "THE UNRAVELING CESA",
        unravelingReward: "+1900 ECHO  +4 MEMORIA",

        gravityWombEvent: "GRAVITY WOMB",
        chorusEvent: "CHORUS",
        mouthEvent: "THE MOUTH +{n}",
        theCallEvent: "THE CALL",
        gatherEcho: "REÚNE ECHO PARA UNA MEJORA",

        echoPickup: "+{n} ECHO",
        energyPickup: "+{n} ENERGÍA",
        healPickup: "+{n} INTEGRIDAD",
        memoryPickup: "+{n} MEMORIA",

        upgradeSharpEyeName: "OJO AFILADO",
        upgradeSharpEyeDesc: "+8 de daño de EYE.",
        upgradeDeepReservoirName: "RESERVA PROFUNDA",
        upgradeDeepReservoirDesc: "+20 de ENERGÍA máxima.",
        upgradeHardenedFormName: "FORMA ENDURECIDA",
        upgradeHardenedFormDesc:
            "+15 de INTEGRIDAD máxima y cura 15.",
        upgradeThornGrowthName: "CRECIMIENTO DE THORN",
        upgradeThornGrowthDesc:
            "+12 de daño de THORN y +20 de alcance.",
        upgradeGravityRemembersName: "LA GRAVEDAD RECUERDA",
        upgradeGravityRemembersDesc:
            "+1000ms de duración de GRAVITY WOMB.",
        upgradePiercingEyeName: "OJO PERFORANTE",
        upgradePiercingEyeDesc:
            "+1 de perforación de proyectil.",
        upgradeLongChorusName: "CHORUS PROLONGADO",
        upgradeLongChorusDesc: "+25 de daño de CHORUS.",
        upgradeLivingNerveName: "NERVIO VIVO",
        upgradeLivingNerveDesc:
            "+0.006 de regeneración de ENERGÍA.",
        upgradeEchoHungerName: "HAMBRE DE ECHO",
        upgradeEchoHungerDesc:
            "+25% de ECHO de los objetos soltados.",
        upgradeMemoryHarvestName: "COSECHA DE MEMORIA",
        upgradeMemoryHarvestDesc:
            "+20% de probabilidad de soltar MEMORIA.",

        languageName: "ESPAÑOL"
    }
};

let currentLanguage = "en";

function t(key, params) {

    let text =
        TEXT[currentLanguage][key] || key;

    if (params) {

        for (const paramKey in params) {

            text = text.replace(
                `{${paramKey}}`,
                params[paramKey]
            );
        }
    }

    return text;
}

/* =========================================================
   DOM
========================================================= */

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const titleScreen = document.getElementById("titleScreen");
const tutorialScreen = document.getElementById("tutorialScreen");

const startButton = document.getElementById("startButton");

const languageButtons =
    document.querySelectorAll(".languageButton");

const titleSubtitle =
    document.getElementById("titleSubtitle");

const tutorialStepLabel =
    document.getElementById("tutorialStepLabel");

const tutorialStepCounter =
    document.getElementById("tutorialStepCounter");

const tutorialVisual =
    document.getElementById("tutorialVisual");

const tutorialTitle =
    document.getElementById("tutorialTitle");

const tutorialDescription =
    document.getElementById("tutorialDescription");

const tutorialBack =
    document.getElementById("tutorialBack");

const tutorialNext =
    document.getElementById("tutorialNext");

const tutorialSkip =
    document.getElementById("tutorialSkip");

const pauseScreen =
    document.getElementById("pauseScreen");

const resumeButton =
    document.getElementById("resumeButton");

const pauseRestartButton =
    document.getElementById("pauseRestartButton");

const pauseButton =
    document.getElementById("pauseButton");

const upgradeScreen =
    document.getElementById("upgradeScreen");

const upgradeGrid =
    document.getElementById("upgradeGrid");

const upgradeSubtitle =
    document.getElementById("upgradeSubtitle");

const gameOverScreen =
    document.getElementById("gameOverScreen");

const retryButton =
    document.getElementById("retryButton");

/* =========================================================
   HUD
========================================================= */

const integrityFill =
    document.getElementById("integrityFill");

const energyFill =
    document.getElementById("energyFill");

const integrityText =
    document.getElementById("integrityText");

const energyText =
    document.getElementById("energyText");

const echoText =
    document.getElementById("echoText");

const memoryText =
    document.getElementById("memoryText");

const killsText =
    document.getElementById("killsText");

const waveText =
    document.getElementById("waveText");

const waveFill =
    document.getElementById("waveFill");

const comboText =
    document.getElementById("comboText");

const eventMessage =
    document.getElementById("eventMessage");

const pickupMessage =
    document.getElementById("pickupMessage");

const bossHUD =
    document.getElementById("bossHUD");

const bossFill =
    document.getElementById("bossFill");

/* =========================================================
   TUTORIAL DATA
========================================================= */

const tutorialPages = [
    {
        visual: "THE WITNESS",
        title: "introductionTitle",
        text: "introductionText"
    },
    {
        visual: "WASD",
        title: "movementTitle",
        text: "movementText"
    },
    {
        visual: "ECHO",
        title: "echoTitle",
        text: "echoText"
    },
    {
        visual: "CONVERGENCE",
        title: "convergenceTitle",
        text: "convergenceText"
    },
    {
        visual: "CLICK Q C E R F",
        title: "abilitiesTitle",
        text: "abilitiesText"
    },
    {
        visual: "5 · 10 · 15 · 20 · 25 · 30 · 35",
        title: "bossProgressionTitle",
        text: "bossProgressionText"
    }
];

let tutorialStep = 0;

function updateTutorial() {

    const page = tutorialPages[tutorialStep];

    tutorialStepLabel.textContent =
        tutorialStep === 0
            ? t("intro")
            : t("tutorial");

    tutorialStepCounter.textContent =
        `${tutorialStep + 1} / ${tutorialPages.length}`;

    tutorialVisual.textContent =
        page.visual;

    tutorialTitle.textContent =
        t(page.title);

    tutorialDescription.textContent =
        t(page.text);

    tutorialBack.style.visibility =
        tutorialStep === 0
            ? "hidden"
            : "visible";

    tutorialNext.textContent =
        tutorialStep === tutorialPages.length - 1
            ? t("start")
            : t("next");
}

function showTutorial() {

    tutorialStep = 0;

    titleScreen.classList.add("hidden");
    tutorialScreen.classList.remove("hidden");

    updateTutorial();
}

function finishTutorial() {

    tutorialScreen.classList.add("hidden");

    game.startNewRun();
}

/* =========================================================
   LANGUAGE EVENTS
========================================================= */

languageButtons.forEach(button => {

    button.addEventListener("click", () => {

        currentLanguage =
            button.dataset.language;

        languageButtons.forEach(other => {
            other.classList.remove("active");
        });

        button.classList.add("active");

        updateInterfaceLanguage();
    });

});

function updateInterfaceLanguage() {

    titleSubtitle.textContent =
        t("titleSubtitle");

    startButton.textContent =
        t("enter");

    document.querySelector(".languageLabel").textContent =
        t("language");

    pauseButton.textContent =
        t("pause");

    resumeButton.textContent =
        t("resume");

    pauseRestartButton.textContent =
        t("restart");

    retryButton.textContent =
        t("tryAgain");

    document.getElementById("pauseSubtitle").textContent =
        t("swarmWaiting");

    document.getElementById("pauseHint").textContent =
        t("escResume");

    document.getElementById("upgradeHeader").textContent =
        t("memoryFracture");

    document.getElementById("upgradeSubtitle").textContent =
        t("chooseMemory");

    document.getElementById("gameOverHeader").textContent =
        t("gameOver");

    document.getElementById("gameOverSubtitle").textContent =
        t("gameOverSubtitle");

    document.getElementById("integrityLabel").textContent =
        t("resourceIntegrity");

    document.getElementById("energyLabel").textContent =
        t("resourceEnergy");

    document.getElementById("echoLabel").textContent =
        t("echo");

    document.getElementById("memoryLabel").textContent =
        t("memory");

    document.getElementById("waveLabel").textContent =
        t("wave");

    document.getElementById("comboLabel").textContent =
        t("comboLabel");

    document.getElementById("killsLabel").textContent =
        t("kills");

    document.getElementById("controlsText").textContent =
        t("controlsHint");

    document.getElementById("statWaveLabel").textContent =
        t("wave");

    document.getElementById("statKillsLabel").textContent =
        t("kills");

    document.getElementById("statEchoLabel").textContent =
        t("echo");

    document.getElementById("statMemoryLabel").textContent =
        t("memory");

    document.getElementById("statComboLabel").textContent =
        t("maxCombo");

    document.getElementById("statConvergenceLabel").textContent =
        t("largestConvergence");

    updateTutorial();
}

/* =========================================================
   INPUT
========================================================= */

class InputSystem {

    constructor(canvas) {

        this.keys = {};
        this.mouse = {
            x: canvas.width / 2,
            y: canvas.height / 2,
            down: false
        };

        window.addEventListener("keydown", event => {

            const key =
                event.key.toLowerCase();

            this.keys[key] = true;

            if (
                key === " " ||
                key === "arrowup" ||
                key === "arrowdown" ||
                key === "arrowleft" ||
                key === "arrowright"
            ) {
                event.preventDefault();
            }

            if (key === "escape") {

                if (game.state === "PLAYING") {
                    game.pause();
                }
                else if (game.state === "PAUSED") {
                    game.resume();
                }
            }
        });

        window.addEventListener("keyup", event => {

            this.keys[event.key.toLowerCase()] = false;
        });

        canvas.addEventListener("mousemove", event => {

            const rect =
                canvas.getBoundingClientRect();

            this.mouse.x =
                (event.clientX - rect.left)
                * canvas.width
                / rect.width;

            this.mouse.y =
                (event.clientY - rect.top)
                * canvas.height
                / rect.height;
        });

        canvas.addEventListener("mousedown", event => {

            if (event.button === 0) {
                this.mouse.down = true;
            }
        });

        window.addEventListener("mouseup", event => {

            if (event.button === 0) {
                this.mouse.down = false;
            }
        });
    }

    isDown(key) {
        return !!this.keys[key];
    }
}

/* =========================================================
   PARTICLES
========================================================= */

class ParticleSystem {

    constructor() {
        this.particles = [];
    }

    burst(
        x,
        y,
        count,
        type = "normal",
        power = 1
    ) {

        for (let i = 0; i < count; i++) {

            const angle =
                random(0, Math.PI * 2);

            const speed =
                random(0.04, 0.16) * power;

            this.particles.push({

                x,
                y,

                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,

                life: random(350, 850),
                maxLife: 850,

                size: random(1, 4),

                type
            });
        }
    }

    ring(
        x,
        y,
        radius,
        type = "normal"
    ) {

        for (let i = 0; i < 28; i++) {

            const angle =
                (Math.PI * 2 / 28) * i;

            this.particles.push({

                x:
                    x + Math.cos(angle) * radius,

                y:
                    y + Math.sin(angle) * radius,

                vx:
                    Math.cos(angle) * 0.04,

                vy:
                    Math.sin(angle) * 0.04,

                life: 500,
                maxLife: 500,

                size: 2,

                type
            });
        }
    }

    update(dt) {

        for (let i = this.particles.length - 1; i >= 0; i--) {

            const p = this.particles[i];

            p.x += p.vx * dt;
            p.y += p.vy * dt;

            p.vx *= 0.995;
            p.vy *= 0.995;

            p.life -= dt;

            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    render(ctx) {

        for (const p of this.particles) {

            const alpha =
                clamp(
                    p.life / p.maxLife,
                    0,
                    1
                );

            ctx.save();

            ctx.globalAlpha = alpha;

            if (p.type === "echo") {
                ctx.fillStyle = "#ffffcc";
            }
            else if (p.type === "energy") {
                ctx.fillStyle = "#004d40";
            }
            else if (p.type === "memory") {
                ctx.fillStyle = "#8b0000";
            }
            else if (p.type === "death") {
                ctx.fillStyle = "#999999";
            }
            else {
                ctx.fillStyle = "#ffffcc";
            }

            ctx.fillRect(
                p.x,
                p.y,
                p.size,
                p.size
            );

            ctx.restore();
        }
    }
}

/* =========================================================
   DROPS
========================================================= */

class Drop {

    constructor(
        x,
        y,
        type,
        value = 1
    ) {

        this.x = x;
        this.y = y;

        this.type = type;
        this.value = value;

        this.radius =
            type === "echo"
                ? 7
                : 5;

        this.life = 12000;
        this.phase =
            random(0, Math.PI * 2);

        this.collected = false;
    }

    update(dt, game) {

        this.life -= dt;
        this.phase += dt * 0.006;

        if (this.life <= 0) {
            this.collected = true;
            return;
        }

        const d =
            distance(
                this.x,
                this.y,
                game.witness.x,
                game.witness.y
            );

        if (d < 115) {

            const dir =
                normalize(
                    game.witness.x - this.x,
                    game.witness.y - this.y
                );

            const attraction =
                d < 45
                    ? 0.0009
                    : 0.00025;

            this.x +=
                dir.x * attraction * dt * 100;

            this.y +=
                dir.y * attraction * dt * 100;
        }

        if (d < 30) {

            this.collect(game);
        }
    }

    collect(game) {

        if (this.collected) {
            return;
        }

        this.collected = true;

        if (this.type === "echo") {

            const amount =
                Math.floor(
                    this.value *
                    game.echoMultiplier
                );

            game.echo += amount;

            game.showPickup(
                t("echoPickup", { n: amount })
            );

            game.particles.burst(
                this.x,
                this.y,
                12,
                "echo",
                1.4
            );
        }

        else if (this.type === "energy") {

            game.witness.energy =
                clamp(
                    game.witness.energy + this.value,
                    0,
                    game.witness.maxEnergy
                );

            game.showPickup(
                t("energyPickup", { n: this.value })
            );
        }

        else if (this.type === "heal") {

            game.witness.integrity =
                clamp(
                    game.witness.integrity + this.value,
                    0,
                    game.witness.maxIntegrity
                );

            game.showPickup(
                t("healPickup", { n: this.value })
            );
        }

        else if (this.type === "memory") {

            game.memory += this.value;

            game.showPickup(
                t("memoryPickup", { n: this.value })
            );

            game.particles.burst(
                this.x,
                this.y,
                12,
                "memory",
                1.3
            );
        }
    }

    render(ctx) {

        if (this.collected) {
            return;
        }

        const pulse =
            Math.sin(this.phase) * 2;

        ctx.save();

        ctx.translate(
            this.x,
            this.y
        );

        if (this.type === "echo") {

            ctx.shadowBlur = 14;
            ctx.shadowColor = "#ffffcc";

            ctx.strokeStyle = "#ffffcc";
            ctx.lineWidth = 1;

            ctx.beginPath();

            ctx.moveTo(
                0,
                -this.radius - pulse
            );

            ctx.lineTo(
                this.radius + pulse,
                0
            );

            ctx.lineTo(
                0,
                this.radius + pulse
            );

            ctx.lineTo(
                -this.radius - pulse,
                0
            );

            ctx.closePath();

            ctx.stroke();

            ctx.fillStyle = "rgba(255,255,204,0.12)";
            ctx.fill();
        }

        else if (this.type === "energy") {

            ctx.strokeStyle = "#004d40";

            ctx.beginPath();

            ctx.arc(
                0,
                0,
                this.radius + pulse,
                0,
                Math.PI * 2
            );

            ctx.stroke();
        }

        else if (this.type === "heal") {

            ctx.strokeStyle = "#8b0000";

            ctx.beginPath();

            ctx.moveTo(-5, 0);
            ctx.lineTo(5, 0);

            ctx.moveTo(0, -5);
            ctx.lineTo(0, 5);

            ctx.stroke();
        }

        else if (this.type === "memory") {

            ctx.strokeStyle = "#8b0000";

            ctx.beginPath();

            ctx.arc(
                0,
                0,
                this.radius + pulse,
                0,
                Math.PI * 2
            );

            ctx.stroke();
        }

        ctx.restore();
    }
}

/* =========================================================
   OBSTACLES
========================================================= */

class Obstacle {

    constructor(
        x,
        y,
        width,
        height
    ) {

        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    collidesCircle(x, y, radius) {

        const closestX =
            clamp(
                x,
                this.x,
                this.x + this.width
            );

        const closestY =
            clamp(
                y,
                this.y,
                this.y + this.height
            );

        return distance(
            x,
            y,
            closestX,
            closestY
        ) < radius;
    }

    render(ctx) {

        ctx.save();

        ctx.fillStyle =
            "rgba(5,5,15,0.9)";

        ctx.strokeStyle =
            "#444444";

        ctx.lineWidth = 1;

        ctx.fillRect(
            this.x,
            this.y,
            this.width,
            this.height
        );

        ctx.strokeRect(
            this.x,
            this.y,
            this.width,
            this.height
        );

        ctx.strokeStyle =
            "rgba(153,153,153,0.12)";

        for (
            let x = this.x - this.height;
            x < this.x + this.width;
            x += 12
        ) {

            ctx.beginPath();

            ctx.moveTo(
                x,
                this.y + this.height
            );

            ctx.lineTo(
                x + this.height,
                this.y
            );

            ctx.stroke();
        }

        ctx.restore();
    }
}

/* =========================================================
   WITNESS
========================================================= */

class Witness {

    constructor(game) {

        this.game = game;

        this.x =
            canvas.width / 2;

        this.y =
            canvas.height / 2;

        this.radius = 21;

        this.vx = 0;
        this.vy = 0;

        this.acceleration = 0.00120;
        this.maxSpeed = 0.62;
        this.damping = 0.90;

        this.integrity = 100;
        this.maxIntegrity = 100;

        this.energy = 100;
        this.maxEnergy = 100;

        this.energyRegen = 0.010;

        this.invulnerableUntil = 0;
        this.damageFlash = 0;

        this.dashCooldown = 1200;
        this.lastDash = -Infinity;

        this.dashUntil = 0;

        this.slowUntil = 0;
        this.slowFactor = 1;
    }

    reset() {

        this.x =
            canvas.width / 2;

        this.y =
            canvas.height / 2;

        this.vx = 0;
        this.vy = 0;

        this.integrity =
            this.maxIntegrity;

        this.energy =
            this.maxEnergy;

        this.invulnerableUntil = 0;
        this.damageFlash = 0;
        this.lastDash = -Infinity;
        this.dashUntil = 0;

        this.slowUntil = 0;
        this.slowFactor = 1;
    }

    update(dt, game) {

        let dx = 0;
        let dy = 0;

        if (game.input.isDown("w")) dy--;
        if (game.input.isDown("s")) dy++;
        if (game.input.isDown("a")) dx--;
        if (game.input.isDown("d")) dx++;

        const dir =
            normalize(dx, dy);

        const slowActive =
            performance.now() 
            this.slowUntil;

        const slowMult =
            slowActive
                ? this.slowFactor
                : 1;

        this.vx +=
            dir.x *
            this.acceleration *
            slowMult *
            dt;

        this.vy +=
            dir.y *
            this.acceleration *
            slowMult *
            dt;

        const speed =
            Math.hypot(
                this.vx,
                this.vy
            );

        const effectiveMaxSpeed =
            this.maxSpeed * slowMult;

        if (speed > effectiveMaxSpeed) {

            const n =
                normalize(
                    this.vx,
                    this.vy
                );

            this.vx =
                n.x * effectiveMaxSpeed;

            this.vy =
                n.y * effectiveMaxSpeed;
        }

        this.vx *=
            Math.pow(
                this.damping,
                dt / 16.67
            );

        this.vy *=
            Math.pow(
                this.damping,
                dt / 16.67
            );

        const oldX = this.x;
        const oldY = this.y;

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        this.x =
            clamp(
                this.x,
                this.radius,
                canvas.width - this.radius
            );

        this.y =
            clamp(
                this.y,
                this.radius,
                canvas.height - this.radius
            );

        for (const obstacle of game.obstacles) {

            if (
                obstacle.collidesCircle(
                    this.x,
                    this.y,
                    this.radius
                )
            ) {

                this.x = oldX;
                this.y = oldY;

                this.vx *= -0.2;
                this.vy *= -0.2;
            }
        }

        this.energy =
            clamp(
                this.energy +
                this.energyRegen *
                dt,
                0,
                this.maxEnergy
            );

        this.damageFlash =
            Math.max(
                0,
                this.damageFlash - dt
            );

        if (
            game.input.isDown(" ") &&
            performance.now() -
                this.lastDash >
                this.dashCooldown
        ) {

            this.dash(game);
        }
    }

    dash(game) {

        if (this.energy < 20) {
            return;
        }

        const now =
            performance.now();

        if (
            now - this.lastDash <
            this.dashCooldown
        ) {
            return;
        }

        const dir =
            normalize(
                game.input.mouse.x - this.x,
                game.input.mouse.y - this.y
            );

        this.energy -= 20;

        this.lastDash = now;
        this.dashUntil = now + 350;

        this.vx =
            dir.x * 0.95;

        this.vy =
            dir.y * 0.95;

        this.x +=
            dir.x * 100;

        this.y +=
            dir.y * 100;

        this.x =
            clamp(
                this.x,
                this.radius,
                canvas.width - this.radius
            );

        this.y =
            clamp(
                this.y,
                this.radius,
                canvas.height - this.radius
            );

        game.particles.burst(
            this.x,
            this.y,
            20,
            "energy",
            1.5
        );
    }

    damage(amount) {

        const now =
            performance.now();

        if (
            now < this.invulnerableUntil
        ) {
            return;
        }

        this.integrity -= amount;

        this.invulnerableUntil =
            now + 500;

        this.damageFlash = 200;

        this.game.particles.burst(
            this.x,
            this.y,
            12,
            "death",
            1.2
        );

        if (this.integrity <= 0) {

            this.integrity = 0;

            this.game.gameOver();
        }
    }

    render(ctx) {

        const now =
            performance.now();

        const dashing =
            now < this.dashUntil;

        const pulse =
            Math.sin(now * 0.004) * 2;

        ctx.save();

        /* AIM */

        const aimAngle =
            angleTo(
                this.x,
                this.y,
                this.game.input.mouse.x,
                this.game.input.mouse.y
            );

        ctx.strokeStyle =
            "rgba(255,255,204,0.13)";

        ctx.lineWidth = 1;

        ctx.beginPath();

        ctx.moveTo(
            this.x,
            this.y
        );

        ctx.lineTo(
            this.x +
            Math.cos(aimAngle) * 75,
            this.y +
            Math.sin(aimAngle) * 75
        );

        ctx.stroke();

        /* AURA */

        ctx.shadowBlur =
            dashing ? 30 : 18;

        ctx.shadowColor =
            dashing
                ? "#004d40"
                : "#191970";

        ctx.strokeStyle =
            "#ffffcc";

        ctx.lineWidth =
            dashing ? 3 : 1;

        ctx.beginPath();

        ctx.arc(
            this.x,
            this.y,
            this.radius + 6 + pulse,
            0,
            Math.PI * 2
        );

        ctx.stroke();

        /* BODY */

        ctx.fillStyle =
            this.damageFlash > 0
                ? "#8b0000"
                : "#080808";

        ctx.beginPath();

        ctx.arc(
            this.x,
            this.y,
            this.radius,
            0,
            Math.PI * 2
        );

        ctx.fill();

        ctx.strokeStyle =
            "#ffffcc";

        ctx.lineWidth = 1;

        ctx.stroke();

        /* CORE */

        ctx.fillStyle =
            "#ffffcc";

        ctx.beginPath();

        ctx.arc(
            this.x,
            this.y,
            5 + pulse * 0.25,
            0,
            Math.PI * 2
        );

        ctx.fill();

        /* EYE */

        ctx.strokeStyle =
            "#8b0000";

        ctx.beginPath();

        ctx.ellipse(
            this.x,
            this.y,
            8,
            4,
            aimAngle,
            0,
            Math.PI * 2
        );

        ctx.stroke();

        ctx.restore();
    }
}

/* =========================================================
   PROJECTILE
========================================================= */

class Projectile {

    constructor(
        x,
        y,
        angle,
        damage,
        pierce = 0
    ) {

        this.x = x;
        this.y = y;

        this.vx =
            Math.cos(angle) * 1.15;

        this.vy =
            Math.sin(angle) * 1.15;

        this.radius = 5;

        this.damage = damage;

        this.life = 900;

        this.pierce = pierce;

        this.hitTargets =
            new Set();

        this.dead = false;
    }

    update(dt, game) {

        this.x +=
            this.vx * dt;

        this.y +=
            this.vy * dt;

        this.life -= dt;

        if (
            this.life <= 0 ||
            this.x < -20 ||
            this.x > canvas.width + 20 ||
            this.y < -20 ||
            this.y > canvas.height + 20
        ) {

            this.dead = true;

            return;
        }

        for (const fragment of game.fragments) {

            if (fragment.dead) {
                continue;
            }

            if (
                this.hitTargets.has(fragment)
            ) {
                continue;
            }

            const d =
                distance(
                    this.x,
                    this.y,
                    fragment.x,
                    fragment.y
                );

            if (
                d <
                this.radius +
                fragment.radius
            ) {

                this.hitTargets.add(fragment);

                fragment.damage(
                    this.damage
                );

                game.particles.burst(
                    this.x,
                    this.y,
                    5,
                    "normal",
                    0.7
                );

                if (this.pierce <= 0) {
                    this.dead = true;
                    return;
                }

                this.pierce--;
            }
        }

        if (
            game.boss &&
            !this.hitTargets.has(game.boss)
        ) {

            const d =
                distance(
                    this.x,
                    this.y,
                    game.boss.x,
                    game.boss.y
                );

            if (
                d <
                this.radius +
                game.boss.radius
            ) {

                this.hitTargets.add(
                    game.boss
                );

                game.boss.damage(
                    this.damage
                );

                if (this.pierce <= 0) {
                    this.dead = true;
                }
                else {
                    this.pierce--;
                }
            }
        }
    }

    render(ctx) {

        ctx.save();

        ctx.shadowBlur = 12;
        ctx.shadowColor = "#ffffcc";

        ctx.fillStyle =
            "#ffffcc";

        ctx.beginPath();

        ctx.arc(
            this.x,
            this.y,
            this.radius,
            0,
            Math.PI * 2
        );

        ctx.fill();

        ctx.restore();
    }
}

/* =========================================================
   FRAGMENT
========================================================= */

class Fragment {

    constructor(
        game,
        x,
        y,
        hp = 30,
        speed = 0.055
    ) {

        this.game = game;

        this.x = x;
        this.y = y;

        this.radius = 15;

        this.hp = hp;
        this.maxHp = hp;

        this.baseSpeed = speed;

        this.vx = 0;
        this.vy = 0;

        this.clusterSize = 1;
        this.clusterType = "FRAGMENT";

        this.clusterId = 0;

        this.dead = false;

        this.alertUntil = 0;
        this.hitFlash = 0;

        this.spawnTimer =
            random(3000, 6000);

        this.phase =
            random(0, Math.PI * 2);
    }

    update(dt, game) {

        this.phase += dt * 0.003;

        this.hitFlash =
            Math.max(
                0,
                this.hitFlash - dt
            );

        if (this.clusterType === "ABERRATION") {
            return;
        }

        let speed =
            this.baseSpeed;

        if (this.clusterType === "CLUSTER") {
            speed *= 1.0;
        }

        else if (this.clusterType === "NEST") {
            speed *= 0.78;
        }

        else if (this.clusterType === "MASS") {
            speed *= 0.55;
        }

        if (
            performance.now() <
            this.alertUntil
        ) {

            speed *= 1.6;
        }

        let targetX =
            game.witness.x;

        let targetY =
            game.witness.y;

        if (
            this.clusterType === "MASS" &&
            this.clusterSize >= 12
        ) {

            const angle =
                this.phase;

            targetX +=
                Math.cos(angle) * 85;

            targetY +=
                Math.sin(angle) * 85;
        }

        const dir =
            normalize(
                targetX - this.x,
                targetY - this.y
            );

        this.vx +=
            dir.x *
            speed *
            dt;

        this.vy +=
            dir.y *
            speed *
            dt;

        const velocity =
            Math.hypot(
                this.vx,
                this.vy
            );

        const maxSpeed =
            speed * 1.8;

        if (
            velocity >
            maxSpeed
        ) {

            const n =
                normalize(
                    this.vx,
                    this.vy
                );

            this.vx =
                n.x * maxSpeed;

            this.vy =
                n.y * maxSpeed;
        }

        this.vx *=
            Math.pow(
                0.985,
                dt / 16.67
            );

        this.vy *=
            Math.pow(
                0.985,
                dt / 16.67
            );

        this.x +=
            this.vx * dt;

        this.y +=
            this.vy * dt;

        this.x =
            clamp(
                this.x,
                this.radius,
                canvas.width - this.radius
            );

        this.y =
            clamp(
                this.y,
                this.radius,
                canvas.height - this.radius
            );

        /* NEST SPAWN */

        if (
            this.clusterType === "NEST"
        ) {

            this.spawnTimer -= dt;

            if (
                this.spawnTimer <= 0 &&
                game.fragments.length < game.maxFragments
            ) {

                this.spawnTimer =
                    random(5000, 8000);

                game.spawnFragmentNear(
                    this.x,
                    this.y,
                    2
                );
            }
        }

        /* CONTACT */

        const d =
            distance(
                this.x,
                this.y,
                game.witness.x,
                game.witness.y
            );

        if (
            d <
            this.radius +
            game.witness.radius
        ) {

            let damage = 3;

            if (
                this.clusterType === "NEST"
            ) {
                damage = 5;
            }

            else if (
                this.clusterType === "MASS"
            ) {
                damage = 8;
            }

            game.witness.damage(
                damage
            );

            const push =
                normalize(
                    this.x - game.witness.x,
                    this.y - game.witness.y
                );

            this.x +=
                push.x * 10;

            this.y +=
                push.y * 10;
        }
    }

    damage(amount) {

        if (this.dead) {
            return;
        }

        this.hitFlash = 120;

        this.hp -= amount;

        if (this.hp <= 0) {

            this.die();
        }
    }

    die() {

        if (this.dead) {
            return;
        }

        this.dead = true;

        const game =
            this.game;

        game.registerKill(
            this
        );

        game.particles.burst(
            this.x,
            this.y,
            18,
            "death",
            1.2
        );

        game.particles.ring(
            this.x,
            this.y,
            15,
            "echo"
        );

        /* ECHO */

       const amount =
    Math.max(
        8,
        Math.floor(
            (
                6 +
                this.clusterSize * 2 +
                game.wave * 0.8
            ) *
            random(0.9, 1.2)
        )
    );

        game.drops.push(
            new Drop(
                this.x,
                this.y,
                "echo",
                amount
            )
        );

        /* ENERGY */

        if (Math.random() < 0.12) {

            game.drops.push(
                new Drop(
                    this.x + random(-10, 10),
                    this.y + random(-10, 10),
                    "energy",
                    10
                )
            );
        }

        /* HEAL */

        if (Math.random() < 0.08) {

            game.drops.push(
                new Drop(
                    this.x + random(-10, 10),
                    this.y + random(-10, 10),
                    "heal",
                    15
                )
            );
        }

        /* MEMORY */

        if (
            Math.random() <
            game.memoryDropChance
        ) {

            game.drops.push(
                new Drop(
                    this.x,
                    this.y,
                    "memory",
                    1
                )
            );
        }
    }

    render(ctx) {

        if (this.dead) {
            return;
        }

        ctx.save();

        ctx.translate(
            this.x,
            this.y
        );

        const pulse =
            Math.sin(this.phase) * 1.5;

        let color =
            "#999999";

        if (
            this.clusterType === "NEST"
        ) {
            color = "#004d40";
        }

        else if (
            this.clusterType === "MASS"
        ) {
            color = "#8b0000";
        }

        ctx.shadowBlur =
            this.hitFlash > 0
                ? 16
                : 8;

        ctx.shadowColor = color;

        ctx.strokeStyle = color;

        ctx.fillStyle =
            this.hitFlash > 0
                ? "#ffffff"
                : "#07070c";

        /* FRAGMENT */

        if (
            this.clusterType ===
            "FRAGMENT"
        ) {

            ctx.beginPath();

            ctx.moveTo(
                0,
                -this.radius - pulse
            );

            ctx.lineTo(
                this.radius,
                0
            );

            ctx.lineTo(
                0,
                this.radius
            );

            ctx.lineTo(
                -this.radius,
                0
            );

            ctx.closePath();

            ctx.fill();
            ctx.stroke();

            for (let i = 0; i < 4; i++) {

                const angle =
                    i *
                    Math.PI / 2;

                ctx.beginPath();

                ctx.moveTo(
                    Math.cos(angle) * 8,
                    Math.sin(angle) * 8
                );

                ctx.lineTo(
                    Math.cos(angle) * 24,
                    Math.sin(angle) * 24
                );

                ctx.stroke();
            }

            ctx.fillStyle =
                "#ffffcc";

            ctx.beginPath();

            ctx.arc(
                0,
                0,
                3,
                0,
                Math.PI * 2
            );

            ctx.fill();
        }

        /* NEST */

        else if (
            this.clusterType ===
            "NEST"
        ) {

            ctx.beginPath();

            ctx.arc(
                0,
                0,
                this.radius + 4,
                0,
                Math.PI * 2
            );

            ctx.fill();
            ctx.stroke();

            for (let i = 0; i < 5; i++) {

                const angle =
                    i *
                    Math.PI *
                    2 / 5;

                ctx.beginPath();

                ctx.moveTo(
                    Math.cos(angle) * 10,
                    Math.sin(angle) * 10
                );

                ctx.lineTo(
                    Math.cos(angle) * 25,
                    Math.sin(angle) * 25
                );

                ctx.stroke();
            }

            ctx.fillStyle =
                "#004d40";

            ctx.beginPath();

            ctx.arc(
                0,
                0,
                6,
                0,
                Math.PI * 2
            );

            ctx.fill();
        }

        /* MASS */

        else if (
            this.clusterType ===
            "MASS"
        ) {

            ctx.beginPath();

            for (let i = 0; i < 12; i++) {

                const angle =
                    i *
                    Math.PI *
                    2 / 12;

                const radius =
                    this.radius +
                    random(-3, 4);

                const x =
                    Math.cos(angle) * radius;

                const y =
                    Math.sin(angle) * radius;

                if (i === 0) {
                    ctx.moveTo(x, y);
                }
                else {
                    ctx.lineTo(x, y);
                }
            }

            ctx.closePath();

            ctx.fill();
            ctx.stroke();

            ctx.fillStyle =
                "#020205";

            ctx.beginPath();

            ctx.arc(
                0,
                0,
                8,
                0,
                Math.PI * 2
            );

            ctx.fill();

            ctx.strokeStyle =
                "#ffffcc";

            ctx.beginPath();

            ctx.arc(
                0,
                0,
                3,
                0,
                Math.PI * 2
            );

            ctx.stroke();
        }

        ctx.restore();

        /* HP */

        if (
            this.hp <
            this.maxHp
        ) {

            const width = 32;

            ctx.fillStyle =
                "#222222";

            ctx.fillRect(
                this.x - width / 2,
                this.y - this.radius - 9,
                width,
                3
            );

            ctx.fillStyle =
                "#8b0000";

            ctx.fillRect(
                this.x - width / 2,
                this.y - this.radius - 9,
                width *
                clamp(
                    this.hp / this.maxHp,
                    0,
                    1
                ),
                3
            );
        }
    }
}

/* =========================================================
   ABERRATION BOSS
========================================================= */

class AberrationBoss {

    constructor(game) {

        this.game = game;

        this.x =
            canvas.width / 2;

        this.y = 100;

        this.radius = 58;

        this.maxHp =
            2600 +
            game.wave * 180;

        this.hp =
            this.maxHp;

        this.dead = false;
        this.hitFlash = 0;

        this.labelKey =
            "bossTitleAberration";

        this.arrivalKey =
            "aberrationDescends";

        this.phase = 0;

        this.spawnTimer = 2500;
        this.dangerTimer = 3500;
    }

    update(dt, game) {

        this.phase += dt * 0.001;

        this.hitFlash =
            Math.max(
                0,
                this.hitFlash - dt
            );

        const angle =
            angleTo(
                this.x,
                this.y,
                game.witness.x,
                game.witness.y
            );

        const orbit =
            Math.sin(this.phase) *
            0.7;

        const targetX =
            game.witness.x +
            Math.cos(angle + Math.PI / 2) *
            160;

        const targetY =
            game.witness.y +
            Math.sin(angle + Math.PI / 2) *
            160;

        const dir =
            normalize(
                targetX - this.x,
                targetY - this.y
            );

        this.x +=
            dir.x *
            0.055 *
            dt;

        this.y +=
            dir.y *
            0.055 *
            dt;

        this.spawnTimer -= dt;

        if (
            this.spawnTimer <= 0
        ) {

            this.spawnTimer = 2500;

            for (let i = 0; i < 5; i++) {

                const spawnAngle =
                    random(0, Math.PI * 2);

                game.spawnFragmentNear(
                    this.x +
                    Math.cos(spawnAngle) * 80,
                    this.y +
                    Math.sin(spawnAngle) * 80,
                    1
                );
            }
        }

        this.dangerTimer -= dt;

        if (
            this.dangerTimer <= 0
        ) {

            this.dangerTimer = 3500;

            game.dangerZones.push({
                x: game.witness.x,
                y: game.witness.y,
                radius: 75,
                life: 1800,
                maxLife: 1800
            });
        }

        const d =
            distance(
                this.x,
                this.y,
                game.witness.x,
                game.witness.y
            );

        if (
            d <
            this.radius +
            game.witness.radius
        ) {

            game.witness.damage(16);

            game.shake(8, 250);
        }
    }

    damage(amount) {

        if (this.dead) {
            return;
        }

        this.hitFlash = 140;

        this.game.hitStop(2);

        this.hp -= amount;

        if (this.hp <= 0) {

            this.hp = 0;

            this.dead = true;

            this.game.echo += 2500;
            this.game.memory += 5;

            this.game.aberrationsKilled++;

            this.game.shake(16, 450);

            this.game.showEvent(
                t("aberrationDestroyed")
            );

            this.game.showPickup(
                t("aberrationReward")
            );

            this.game.particles.burst(
                this.x,
                this.y,
                80,
                "death",
                2
            );

            this.game.particles.ring(
                this.x,
                this.y,
                90,
                "echo"
            );

            this.game.boss = null;
        }
    }

    render(ctx) {

        if (this.dead) {
            return;
        }

        ctx.save();

        const pulse =
            Math.sin(this.phase * 3) * 5;

        ctx.shadowBlur = 35;
        ctx.shadowColor = "#8b0000";

        ctx.translate(
            this.x,
            this.y
        );

        ctx.strokeStyle =
            "#8b0000";

        ctx.fillStyle =
            this.hitFlash > 0
                ? "#ffffff"
                : "#050509";

        ctx.lineWidth = 2;

        ctx.beginPath();

        for (let i = 0; i < 18; i++) {

            const angle =
                i *
                Math.PI *
                2 / 18;

            const radius =
                this.radius +
                Math.sin(
                    this.phase * 2 + i
                ) * 8 +
                pulse;

            const x =
                Math.cos(angle) * radius;

            const y =
                Math.sin(angle) * radius;

            if (i === 0) {
                ctx.moveTo(x, y);
            }
            else {
                ctx.lineTo(x, y);
            }
        }

        ctx.closePath();

        ctx.fill();
        ctx.stroke();

        /* APPENDAGES */

        ctx.strokeStyle =
            "#8b0000";

        for (let i = 0; i < 8; i++) {

            const angle =
                i *
                Math.PI /
                4 +
                this.phase * 0.3;

            ctx.beginPath();

            ctx.moveTo(
                Math.cos(angle) * 35,
                Math.sin(angle) * 35
            );

            ctx.lineTo(
                Math.cos(angle) * 92,
                Math.sin(angle) * 92
            );

            ctx.stroke();
        }

        /* VOID */

        ctx.fillStyle =
            "#000000";

        ctx.beginPath();

        ctx.arc(
            0,
            0,
            29,
            0,
            Math.PI * 2
        );

        ctx.fill();

        /* EYE */

        ctx.fillStyle =
            "#ffffcc";

        ctx.beginPath();

        ctx.ellipse(
            0,
            0,
            16,
            7,
            this.phase,
            0,
            Math.PI * 2
        );

        ctx.fill();

        ctx.restore();
    }
}

/* =========================================================
   THE HARBINGER (WAVE 5 MINI-BOSS)
========================================================= */

class HarbingerBoss {

    constructor(game) {

        this.game = game;

        this.x =
            canvas.width / 2;

        this.y = 100;

        this.radius = 38;

        this.maxHp = 900;

        this.hp =
            this.maxHp;

        this.dead = false;
        this.hitFlash = 0;

        this.labelKey =
            "bossTitleHarbinger";

        this.arrivalKey =
            "harbingerDescends";

        this.phase = 0;

        this.chargeState = "approach";

        this.chargeTimer =
            random(1500, 2500);

        this.chargeTargetX = 0;
        this.chargeTargetY = 0;

        this.spawnTimer =
            random(4000, 6000);
    }

    update(dt, game) {

        this.phase += dt * 0.0015;

        this.hitFlash =
            Math.max(
                0,
                this.hitFlash - dt
            );

        this.chargeTimer -= dt;

        if (this.chargeState === "approach") {

            const dir =
                normalize(
                    game.witness.x - this.x,
                    game.witness.y - this.y
                );

            this.x +=
                dir.x * 0.05 * dt;

            this.y +=
                dir.y * 0.05 * dt;

            if (this.chargeTimer <= 0) {

                this.chargeState = "charge";
                this.chargeTimer = 500;

                this.chargeTargetX =
                    game.witness.x;

                this.chargeTargetY =
                    game.witness.y;

                game.particles.ring(
                    this.x,
                    this.y,
                    50,
                    "energy"
                );
            }
        }

        else {

            const dir =
                normalize(
                    this.chargeTargetX - this.x,
                    this.chargeTargetY - this.y
                );

            this.x +=
                dir.x * 0.14 * dt;

            this.y +=
                dir.y * 0.14 * dt;

            if (this.chargeTimer <= 0) {

                this.chargeState = "approach";
                this.chargeTimer =
                    random(1800, 2800);
            }
        }

        this.x =
            clamp(
                this.x,
                this.radius,
                canvas.width - this.radius
            );

        this.y =
            clamp(
                this.y,
                this.radius,
                canvas.height - this.radius
            );

        this.spawnTimer -= dt;

        if (this.spawnTimer <= 0) {

            this.spawnTimer =
                random(4000, 6000);

            for (let i = 0; i < 2; i++) {

                const spawnAngle =
                    random(0, Math.PI * 2);

                game.spawnFragmentNear(
                    this.x +
                    Math.cos(spawnAngle) * 60,
                    this.y +
                    Math.sin(spawnAngle) * 60,
                    1
                );
            }
        }

        const d =
            distance(
                this.x,
                this.y,
                game.witness.x,
                game.witness.y
            );

        if (
            d <
            this.radius + 
            game.witness.radius
        ) {

            game.witness.damage(10);

            game.shake(6, 220);
        }
    }

    damage(amount) {

        if (this.dead) {
            return;
        }

        this.hitFlash = 140;

        this.game.hitStop(2);

        this.hp -= amount;

        if (this.hp <= 0) {

            this.hp = 0;

            this.dead = true;

            this.game.echo += 800;
            this.game.memory += 2;

            this.game.shake(14, 400);

            this.game.showEvent(
                t("harbingerDestroyed")
            );

            this.game.showPickup(
                t("harbingerReward")
            );

            this.game.particles.burst(
                this.x,
                this.y,
                50,
                "death",
                1.6
            );

            this.game.particles.ring(
                this.x,
                this.y,
                60,
                "energy"
            );

            this.game.boss = null;
        }
    }

    render(ctx) {

        if (this.dead) {
            return;
        }

        ctx.save();

        const charging =
            this.chargeState === "charge";

        const pulse =
            Math.sin(this.phase * 3) * 4;

        ctx.shadowBlur =
            charging ? 32 : 20;

        ctx.shadowColor =
            "#004d40";

        ctx.translate(
            this.x,
            this.y
        );

        ctx.strokeStyle =
            "#004d40";

        ctx.fillStyle =
            this.hitFlash > 0
                ? "#ffffff"
                : "#050509";

        ctx.lineWidth =
            charging ? 3 : 2;

        ctx.beginPath();

        for (let i = 0; i < 10; i++) {

            const angle =
                i *
                Math.PI *
                2 / 10;

            const radius =
                this.radius +
                Math.sin(
                    this.phase * 2 + i
                ) * 5 +
                pulse;

            const x =
                Math.cos(angle) * radius;

            const y =
                Math.sin(angle) * radius;

            if (i === 0) {
                ctx.moveTo(x, y);
            }
            else {
                ctx.lineTo(x, y);
            }
        }

        ctx.closePath();

        ctx.fill();
        ctx.stroke();

        /* APPENDAGES */

        for (let i = 0; i < 4; i++) {

            const angle =
                i *
                Math.PI /
                2 +
                this.phase * 0.4;

            ctx.beginPath();

            ctx.moveTo(
                Math.cos(angle) * 22,
                Math.sin(angle) * 22
            );

            ctx.lineTo(
                Math.cos(angle) * 58,
                Math.sin(angle) * 58
            );

            ctx.stroke();
        }

        /* VOID */

        ctx.fillStyle =
            "#000000";

        ctx.beginPath();

        ctx.arc(
            0,
            0,
            18,
            0,
            Math.PI * 2
        );

        ctx.fill();

        /* EYE */

        ctx.fillStyle =
            "#ffffcc";

        ctx.beginPath();

        ctx.ellipse(
            0,
            0,
            10,
            4.5,
            this.phase,
            0,
            Math.PI * 2
        );

        ctx.fill();

        ctx.restore();
    }
}

/* =========================================================
   THE HOLLOW CHOIR (WAVE 15)
========================================================= */

class HollowChoirBoss {

    constructor(game) {

        this.game = game;

        this.x =
            canvas.width / 2;

        this.y = 100;

        this.radius = 26;

        this.maxHp = 1100;

        this.hp =
            this.maxHp;

        this.dead = false;
        this.hitFlash = 0;

        this.labelKey =
            "bossTitleHollowChoir";

        this.arrivalKey =
            "hollowChoirDescends";

        this.preferredDistance = 250;

        this.phase = 0;

        this.pulseTimer =
            random(2500, 3500);

        this.pulseFlash = 0;
    }

    update(dt, game) {

        this.phase += dt * 0.002;

        this.hitFlash =
            Math.max(
                0,
                this.hitFlash - dt
            );

        const d =
            distance(
                this.x,
                this.y,
                game.witness.x,
                game.witness.y
            );

        const dir =
            normalize(
                game.witness.x - this.x,
                game.witness.y - this.y
            );

        const diff =
            d - this.preferredDistance;

        const moveSpeed =
            0.045;

        this.x +=
            dir.x *
            clamp(diff, -1, 1) *
            moveSpeed *
            dt;

        this.y +=
            dir.y *
            clamp(diff, -1, 1) *
            moveSpeed *
            dt;

        this.x =
            clamp(
                this.x,
                this.radius,
                canvas.width - this.radius
            );

        this.y =
            clamp(
                this.y,
                this.radius,
                canvas.height - this.radius
            );

        this.pulseTimer -= dt;

        this.pulseFlash =
            Math.max(
                0,
                this.pulseFlash - dt
            );

        if (this.pulseTimer <= 0) {

            this.pulseTimer =
                random(3000, 4000);

            this.pulseFlash = 400;

            const alertUntil =
                performance.now() + 2200;

            for (const fragment of game.fragments) {

                if (fragment.dead) {
                    continue;
                }

                fragment.alertUntil =
                    alertUntil;
            }

            game.particles.ring(
                this.x,
                this.y,
                60,
                "normal"
            );

            game.particles.ring(
                this.x,
                this.y,
                110,
                "normal"
            );
        }

        if (
            d <
            this.radius + 
            game.witness.radius 
        ) {

            game.witness.damage(6);

            game.shake(4, 180);
        }
    }

    damage(amount) {

        if (this.dead) {
            return;
        }

        this.hitFlash = 120;

        this.game.hitStop(1);

        this.hp -= amount;

        if (this.hp <= 0) {

            this.hp = 0;

            this.dead = true;

            this.game.echo += 1200;
            this.game.memory += 3;

            this.game.shake(12, 380);

            this.game.showEvent(
                t("hollowChoirDestroyed")
            );

            this.game.showPickup(
                t("hollowChoirReward")
            );

            this.game.particles.burst(
                this.x,
                this.y,
                55,
                "death",
                1.5
            );

            this.game.particles.ring(
                this.x,
                this.y,
                70,
                "normal"
            );

            this.game.boss = null;
        }
    }

    render(ctx) {

        if (this.dead) {
            return;
        }

        ctx.save();

        const flashAlpha =
            clamp(
                this.pulseFlash / 400,
                0,
                1
            );

        const pulse =
            Math.sin(this.phase * 2) * 3;

        ctx.shadowBlur =
            18 + flashAlpha * 20;

        ctx.shadowColor =
            "#ffffcc";

        ctx.translate(
            this.x,
            this.y
        );

        ctx.strokeStyle =
            "#ffffcc";

        ctx.fillStyle =
            this.hitFlash > 0
                ? "#ffffff"
                : "#07070c";

        ctx.lineWidth = 2;

        /* ELONGATED VERTICAL BODY */

        ctx.beginPath();

        ctx.moveTo(0, -this.radius * 1.8 - pulse);

        ctx.lineTo(this.radius * 0.7, -this.radius * 0.3);

        ctx.lineTo(this.radius * 0.5, this.radius * 1.6);

        ctx.lineTo(0, this.radius * 2 + pulse);

        ctx.lineTo(-this.radius * 0.5, this.radius * 1.6);

        ctx.lineTo(-this.radius * 0.7, -this.radius * 0.3);

        ctx.closePath();

        ctx.fill();
        ctx.stroke();

        /* CRACKS — brighten sharply during a pulse */

        ctx.globalAlpha =
            0.35 + flashAlpha * 0.65;

        ctx.lineWidth = 1;

        for (let i = 0; i < 5; i++) {

            const yOffset =
                -this.radius * 1.4 +
                i * (this.radius * 0.7);

            const wobble =
                Math.sin(this.phase * 3 + i) * 4;

            ctx.beginPath();

            ctx.moveTo(-6 + wobble, yOffset);

            ctx.lineTo(6 - wobble, yOffset + 8);

            ctx.stroke();
        }

        ctx.restore();
    }
}

/* =========================================================
   THE DEEP MAW (WAVE 20)
========================================================= */

class DeepMawBoss {

    constructor(game) {

        this.game = game;

        this.x =
            canvas.width / 2;

        this.y = 100;

        this.radius = 70;

        this.maxHp = 3200;

        this.hp =
            this.maxHp;

        this.dead = false;
        this.hitFlash = 0;

        this.labelKey =
            "bossTitleDeepMaw";

        this.arrivalKey =
            "deepMawDescends";

        this.phase = 0;
    }

    update(dt, game) {

        this.phase += dt * 0.0009;

        this.hitFlash =
            Math.max(
                0,
                this.hitFlash - dt
            );

        const dir =
            normalize(
                game.witness.x - this.x,
                game.witness.y - this.y
            );

        this.x +=
            dir.x * 0.024 * dt;

        this.y +=
            dir.y * 0.024 * dt;

        this.x =
            clamp(
                this.x,
                this.radius,
                canvas.width - this.radius
            );

        this.y =
            clamp(
                this.y,
                this.radius,
                canvas.height - this.radius
            );

        const d =
            distance(
                this.x,
                this.y,
                game.witness.x,
                game.witness.y
            );

        if (
            d <
            this.radius +
            game.witness.radius
        ) {

            game.witness.damage(14);

            game.shake(7, 220);
        }
    }

    damage(amount) {

        if (this.dead) {
            return;
        }

        this.hitFlash = 140;

        this.game.hitStop(2);

        this.hp -= amount;

        if (this.hp <= 0) {

            this.hp = 0;

            this.dead = true;

            this.game.echo += 1800;
            this.game.memory += 4;

            this.game.shake(15, 420);

            this.game.showEvent(
                t("deepMawDestroyed")
            );

            this.game.showPickup(
                t("deepMawReward")
            );

            this.game.particles.burst(
                this.x,
                this.y,
                90,
                "death",
                2.2
            );

            this.game.particles.ring(
                this.x,
                this.y,
                100,
                "normal"
            );

            this.game.boss = null;
        }
    }

    render(ctx) {

        if (this.dead) {
            return;
        }

        ctx.save();

        const pulse =
            Math.sin(this.phase * 2) * 6;

        ctx.shadowBlur = 30;
        ctx.shadowColor = "#4b0060";

        ctx.translate(
            this.x,
            this.y
        );

        ctx.strokeStyle =
            "#4b0060";

        ctx.fillStyle =
            this.hitFlash > 0
                ? "#ffffff"
                : "#050208";

        ctx.lineWidth = 2;

        /* LOW, WIDE MASS */

        ctx.beginPath();

        for (let i = 0; i < 16; i++) {

            const angle =
                i *
                Math.PI *
                2 / 16;

            const wobble =
                Math.sin(
                    this.phase * 1.5 + i
                ) * 6;

            const radiusX =
                this.radius * 1.25 +
                wobble +
                pulse;

            const radiusY =
                this.radius * 0.8 +
                wobble * 0.5 +
                pulse * 0.5;

            const x =
                Math.cos(angle) * radiusX;

            const y =
                Math.sin(angle) * radiusY;

            if (i === 0) {
                ctx.moveTo(x, y);
            }
            else {
                ctx.lineTo(x, y);
            }
        }

        ctx.closePath();

        ctx.fill();
        ctx.stroke();

        /* CENTRAL MAW OPENING */

        ctx.fillStyle =
            "#000000";

        ctx.beginPath();

        ctx.ellipse(
            0,
            0,
            26 + pulse * 0.3,
            16 + pulse * 0.2,
            0,
            0,
            Math.PI * 2
        );

        ctx.fill();

        ctx.strokeStyle =
            "#4b0060";

        ctx.lineWidth = 1;

        ctx.beginPath();

        ctx.ellipse(
            0,
            0,
            26 + pulse * 0.3,
            16 + pulse * 0.2,
            0,
            0,
            Math.PI * 2
        );

        ctx.stroke();

        ctx.restore();

        /* HP BAR — deep maw always shows its damage state
           given its high total pool, reusing the fragment
           pattern for consistency */

        if (
            this.hp <
            this.maxHp
        ) {

            const width = 90;

            ctx.save();

            ctx.fillStyle =
                "#222222";

            ctx.fillRect(
                this.x - width / 2,
                this.y - this.radius - 18,
                width,
                4
            );

            ctx.fillStyle =
                "#4b0060";

            ctx.fillRect(
                this.x - width / 2,
                this.y - this.radius - 18,
                width *
                clamp(
                    this.hp / this.maxHp,
                    0,
                    1
                ),
                4
            );

                    ctx.restore();
        }
    }
}

/* =========================================================
   THE WATCHER BENEATH (WAVE 25)
========================================================= */

class WatcherBeneathBoss {

    constructor(game) {

        this.game = game;

        this.x =
            canvas.width / 2;

        this.y = 100;

        this.radius = 20;

        this.maxHp = 1700;

        this.hp =
            this.maxHp;

        this.dead = false;
        this.hitFlash = 0;

        this.labelKey =
            "bossTitleWatcher";

        this.arrivalKey =
            "watcherDescends";

        this.preferredDistance = 230;

        this.phase = 0;

        this.wanderAngle =
            random(0, Math.PI * 2);

        this.zoneTimer =
            random(2200, 3000);
    }

    update(dt, game) {

        this.phase += dt * 0.0025;

        this.hitFlash =
            Math.max(
                0,
                this.hitFlash - dt
            );

        this.wanderAngle +=
            random(-0.002, 0.002) * dt;

        const d =
            distance(
                this.x,
                this.y,
                game.witness.x,
                game.witness.y
            );

        const towardWitness =
            normalize(
                game.witness.x - this.x,
                game.witness.y - this.y
            );

        const diff =
            d - this.preferredDistance;

        const radialSpeed =
            0.06;

        const wanderSpeed =
            0.03;

        this.x +=
            towardWitness.x *
            clamp(diff, -1, 1) *
            radialSpeed *
            dt;

        this.y +=
            towardWitness.y *
            clamp(diff, -1, 1) *
            radialSpeed *
            dt;

        this.x +=
            Math.cos(this.wanderAngle) *
            wanderSpeed *
            dt;

        this.y +=
            Math.sin(this.wanderAngle) *
            wanderSpeed *
            dt;

        this.x =
            clamp(
                this.x,
                this.radius,
                canvas.width - this.radius
            );

        this.y =
            clamp(
                this.y,
                this.radius,
                canvas.height - this.radius
            );

        this.zoneTimer -= dt;

        if (this.zoneTimer <= 0) {

            this.zoneTimer =
                random(2400, 3200);

            const predictionTime =
                700;

            const predictedX =
                clamp(
                    game.witness.x +
                    game.witness.vx * predictionTime,
                    40,
                    canvas.width - 40
                );

            const predictedY =
                clamp(
                    game.witness.y +
                    game.witness.vy * predictionTime,
                    40,
                    canvas.height - 40
                );

            game.dangerZones.push({
                x: predictedX,
                y: predictedY,
                radius: 65,
                life: 1600,
                maxLife: 1600
            });

            game.particles.ring(
                predictedX,
                predictedY,
                65,
                "normal"
            );
        }

        if (
            d <
            this.radius +
            game.witness.radius
        ) {

            game.witness.damage(7);

            game.shake(4, 180);
        }
    }

    damage(amount) {

        if (this.dead) {
            return;
        }

        this.hitFlash = 120;

        this.game.hitStop(1);

        this.hp -= amount;

        if (this.hp <= 0) {

            this.hp = 0;

            this.dead = true;

            this.game.echo += 1500;
            this.game.memory += 3;

            this.game.shake(13, 400);

            this.game.showEvent(
                t("watcherDestroyed")
            );

            this.game.showPickup(
                t("watcherReward")
            );

            this.game.particles.burst(
                this.x,
                this.y,
                60,
                "death",
                1.6
            );

            this.game.particles.ring(
                this.x,
                this.y,
                75,
                "normal"
            );

            this.game.boss = null;
        }
    }

    render(ctx) {

        if (this.dead) {
            return;
        }

        ctx.save();

        const pulse =
            Math.sin(this.phase * 2.5) * 2;

        ctx.shadowBlur = 22;
        ctx.shadowColor = "#3fd0ff";

        ctx.translate(
            this.x,
            this.y
        );

        /* SMALL BODY */

        ctx.strokeStyle =
            "#3fd0ff";

        ctx.fillStyle =
            this.hitFlash > 0
                ? "#ffffff"
                : "#050509";

        ctx.lineWidth = 1.5;

        ctx.beginPath();

        ctx.arc(
            0,
            0,
            this.radius * 0.55,
            0,
            Math.PI * 2
        );

        ctx.fill();
        ctx.stroke();

        /* OVERSIZED IRIS */

        const aimAngle =
            angleTo(
                this.x,
                this.y,
                this.game.witness.x,
                this.game.witness.y
            );

        ctx.fillStyle =
            "#000000";

        ctx.beginPath();

        ctx.ellipse(
            0,
            0,
            this.radius + pulse,
            this.radius * 0.62 + pulse * 0.4,
            aimAngle,
            0,
            Math.PI * 2
        );

        ctx.fill();

        ctx.strokeStyle =
            "#3fd0ff";

        ctx.lineWidth = 2;

        ctx.beginPath();

        ctx.ellipse(
            0,
            0,
            this.radius + pulse,
            this.radius * 0.62 + pulse * 0.4,
            aimAngle,
            0,
            Math.PI * 2
        );

        ctx.stroke();

        ctx.fillStyle =
            "#3fd0ff";

        ctx.beginPath();

        ctx.arc(
            0,
            0,
            4,
            0,
            Math.PI * 2
        );

        ctx.fill();

        ctx.restore();
    }
}

/* =========================================================
   THE UNRAVELING (WAVE 30)
========================================================= */

class UnravelingBoss {

    constructor(game) {

        this.game = game;

        this.x =
            canvas.width / 2;

        this.y = 100;

        this.radius = 34;

        this.maxHp = 2000;

        this.hp =
            this.maxHp;

        this.dead = false;
        this.hitFlash = 0;

        this.labelKey =
            "bossTitleUnraveling";

        this.arrivalKey =
            "unravelingDescends";

        this.phase = 0;

        this.crossedThresholds =
            new Set();
    }

    update(dt, game) {

        this.phase += dt * 0.0018;

        this.hitFlash =
            Math.max(
                0,
                this.hitFlash - dt
            );

        const dir =
            normalize(
                game.witness.x - this.x,
                game.witness.y - this.y
            );

        this.x +=
            dir.x * 0.04 * dt;

        this.y +=
            dir.y * 0.04 * dt;

        this.x =
            clamp(
                this.x,
                this.radius,
                canvas.width - this.radius
            );

        this.y =
            clamp(
                this.y,
                this.radius,
                canvas.height - this.radius
            );

        const d =
            distance(
                this.x,
                this.y,
                game.witness.x,
                game.witness.y
            );

        if (
            d <
            this.radius +
            game.witness.radius
        ) {

            game.witness.damage(9);

            game.shake(5, 200);
        }
    }

    checkThresholds(game) {

        const ratio =
            this.hp / this.maxHp;

        const thresholds =
            [0.75, 0.5, 0.25];

        for (const threshold of thresholds) {

            if (
                ratio <= threshold &&
                !this.crossedThresholds.has(threshold)
            ) {

                this.crossedThresholds.add(
                    threshold
                );

                this.fragment(game);
            }
        }
    }

    fragment(game) {

        game.showEvent(
            t("unravelingFragments")
        );

        game.shake(10, 320);

        game.particles.burst(
            this.x,
            this.y,
            35,
            "death",
            1.4
        );

        for (let i = 0; i < 4; i++) {

            const angle =
                random(0, Math.PI * 2);

            game.spawnFragmentNear(
                this.x +
                Math.cos(angle) * 55,
                this.y +
                Math.sin(angle) * 55,
                2
            );
        }
    }

    damage(amount) {

        if (this.dead) {
            return;
        }

        this.hitFlash = 130;

        this.game.hitStop(2);

        this.hp -= amount;

        if (this.hp <= 0) {

            this.hp = 0;

            this.dead = true;

            this.game.echo += 1900;
            this.game.memory += 4;

            this.game.shake(15, 420);

            this.game.showEvent(
                t("unravelingDestroyed")
            );

            this.game.showPickup(
                t("unravelingReward")
            );

            this.game.particles.burst(
                this.x,
                this.y,
                85,
                "death",
                2
            );

            this.game.particles.ring(
                this.x,
                this.y,
                90,
                "normal"
            );

            this.game.boss = null;

            return;
        }

        this.checkThresholds(
            this.game
        );
    }

    render(ctx) {

        if (this.dead) {
            return;
        }

        ctx.save();

        const pulse =
            Math.sin(this.phase * 2.2) * 4;

        const crackLevel =
            this.crossedThresholds.size;

        ctx.shadowBlur = 26;
        ctx.shadowColor = "#cc5500";

        ctx.translate(
            this.x,
            this.y
        );

        ctx.strokeStyle =
            "#cc5500";

        ctx.fillStyle =
            this.hitFlash > 0
                ? "#ffffff"
                : "#0a0604";

        ctx.lineWidth = 2;

        ctx.beginPath();

        for (let i = 0; i < 14; i++) {

            const angle =
                i *
                Math.PI *
                2 / 14;

            const jitter =
                crackLevel > 0
                    ? random(-3, 3) *
                      crackLevel
                    : 0;

            const radius =
                this.radius +
                Math.sin(
                    this.phase * 2 + i
                ) * 5 +
                pulse +
                jitter;

            const x =
                Math.cos(angle) * radius;

            const y =
                Math.sin(angle) * radius;

            if (i === 0) {
                ctx.moveTo(x, y);
            }
            else {
                ctx.lineTo(x, y);
            }
        }

        ctx.closePath();

        ctx.fill();
        ctx.stroke();

        /* ACCUMULATING CRACKS — one extra crack line per
           threshold crossed, growing more chaotic each time */

        ctx.globalAlpha = 0.8;
        ctx.lineWidth = 1;

        for (let i = 0; i < crackLevel * 3; i++) {

            const angle =
                (i * 2.4) +
                this.phase * 0.5;

            const innerR =
                this.radius * 0.2;

            const outerR =
                this.radius *
                (0.8 + (i % 3) * 0.15);

            ctx.beginPath();

            ctx.moveTo(
                Math.cos(angle) * innerR,
                Math.sin(angle) * innerR
            );

            ctx.lineTo(
                Math.cos(angle) * outerR,
                Math.sin(angle) * outerR
            );

            ctx.stroke();
        }

        ctx.restore();

        /* HP BAR */

        if (
            this.hp <
            this.maxHp
        ) {

            const width = 70;

            ctx.save();

            ctx.fillStyle =
                "#222222";

            ctx.fillRect(
                this.x - width / 2,
                this.y - this.radius - 14,
                width,
                3
            );

            ctx.fillStyle =
                "#cc5500";

            ctx.fillRect(
                this.x - width / 2,
                this.y - this.radius - 14,
                width *
                clamp(
                    this.hp / this.maxHp,
                    0,
                    1
                ),
                3
            );

                    ctx.restore();
        }
    }
}

/* =========================================================
   TAYATNA (WAVE 37 — FINAL BOSS)
========================================================= */

class TayatnaBoss {

    constructor(game) {

        this.game = game;

        this.x =
            canvas.width / 2;

        this.y = 90;

        this.radius = 66;

        this.maxHp = 6000;

        this.hp =
            this.maxHp;

        this.dead = false;
        this.hitFlash = 0;

        this.labelKey =
            "bossTitleTayatna";

        this.arrivalKey =
            "tayatnaDescends";

        this.phase = 0;

        this.contactDamage = 18;

        this.state = "approach";
        this.stateTimer =
            random(4000, 6000);

        this.phase2 = false;

        this.crossedThresholds =
            new Set();

        this.choirPulseUnlocked = false;
        this.watcherZonesUnlocked = false;
        this.deepPressUnlocked = false;
        this.unravelFragUnlocked = false;

        this.pulseTimer = 2000;
        this.zoneTimer = 2500;
    }

    enterState(name, game) {

        this.state = name;

        if (name === "sorrow") {

            this.stateTimer = 2500;

            game.shake(8, 350);

            const duration =
                this.phase2
                    ? 3200
                    : 2500;

            game.witness.slowUntil =
                performance.now() +
                duration;

            game.witness.slowFactor =
                this.phase2
                    ? 0.35
                    : 0.5;

            game.showEvent(
                t("tayatnaSorrow")
            );

            game.particles.ring(
                this.x,
                this.y,
                150,
                "death"
            );

            game.particles.ring(
                this.x,
                this.y,
                90,
                "death"
            );
        }

        else if (name === "rest") {

            this.stateTimer = 3000;

            const count =
                this.phase2
                    ? 3
                    : 2;

            for (let i = 0; i < count; i++) {

                const angle =
                    random(0, Math.PI * 2);

                game.spawnFragmentNear(
                    this.x +
                    Math.cos(angle) * 75,
                    this.y +
                    Math.sin(angle) * 75,
                    2
                );
            }
        }

        else {

            this.stateTimer =
                random(4000, 6000);
        }
    }

    update(dt, game) {

        this.phase += dt * 0.0012;

        this.hitFlash =
            Math.max(
                0,
                this.hitFlash - dt
            );

        this.stateTimer -= dt;

        if (this.state === "approach") {

            const dir =
                normalize(
                    game.witness.x - this.x,
                    game.witness.y - this.y
                );

            this.x +=
                dir.x * 0.028 * dt;

            this.y +=
                dir.y * 0.028 * dt;

            if (this.stateTimer <= 0) {

                this.enterState(
                    "sorrow",
                    game
                );
            }
        }

        else if (this.state === "sorrow") {

            if (this.stateTimer <= 0) {

                this.enterState(
                    "rest",
                    game
                );
            }
        }

        else if (this.state === "rest") {

            if (this.stateTimer <= 0) {

                this.enterState(
                    "approach",
                    game
                );
            }
        }

        this.x =
            clamp(
                this.x,
                this.radius,
                canvas.width - this.radius
            );

        this.y =
            clamp(
                this.y,
                this.radius,
                canvas.height - this.radius
            );

        /* PROGRESSIVE PHASE 2 MECHANICS */

        if (this.choirPulseUnlocked) {

            this.pulseTimer -= dt;

            if (this.pulseTimer <= 0) {

                this.pulseTimer = 3200;

                const alertUntil =
                    performance.now() + 1800;

                for (const fragment of game.fragments) {

                    if (fragment.dead) {
                        continue;
                    }

                    fragment.alertUntil =
                        alertUntil;
                }

                game.particles.ring(
                    this.x,
                    this.y,
                    50,
                    "normal"
                );
            }
        }

        if (this.watcherZonesUnlocked) {

            this.zoneTimer -= dt;

            if (this.zoneTimer <= 0) {

                this.zoneTimer = 3000;

                const predictionTime = 700;

                const predictedX =
                    clamp(
                        game.witness.x +
                        game.witness.vx * predictionTime,
                        40,
                        canvas.width - 40
                    );

                const predictedY =
                    clamp(
                        game.witness.y +
                        game.witness.vy * predictionTime,
                        40,
                        canvas.height - 40
                    );

                game.dangerZones.push({
                    x: predictedX,
                    y: predictedY,
                    radius: 55,
                    life: 1400,
                    maxLife: 1400
                });
            }
        }

        const d =
            distance(
                this.x,
                this.y,
                game.witness.x,
                game.witness.y
            );

        if (
            d <
            this.radius +
            game.witness.radius
        ) {

            game.witness.damage(
                this.contactDamage
            );

            game.shake(9, 260);
        }
    }

    checkThresholds(game) {

        const ratio =
            this.hp / this.maxHp;

        const steps = [
            { at: 0.5, unlock: "choir" },
            { at: 0.35, unlock: "watcher" },
            { at: 0.2, unlock: "deep" },
            { at: 0.08, unlock: "unravel" }
        ];

        for (const step of steps) {

            if (
                ratio <= step.at &&
                !this.crossedThresholds.has(step.at)
            ) {

                this.crossedThresholds.add(
                    step.at
                );

                this.unlockMechanic(
                    step.unlock,
                    game
                );
            }
        }
    }

    unlockMechanic(name, game) {

        if (name === "choir") {

            this.phase2 = true;
            this.choirPulseUnlocked = true;
            this.pulseTimer = 1500;

            game.shake(20, 550);

            game.showEvent(
                t("tayatnaDeepens")
            );
        }

        else if (name === "watcher") {

            this.watcherZonesUnlocked = true;
            this.zoneTimer = 2000;

            game.shake(12, 350);
        }

        else if (name === "deep") {

            this.deepPressUnlocked = true;

            this.radius += 8;
            this.contactDamage += 4;

            game.shake(12, 350);
        }

        else if (name === "unravel") {

            this.unravelFragUnlocked = true;

            game.shake(16, 420);

            game.particles.burst(
                this.x,
                this.y,
                45,
                "death",
                1.6
            );

            for (let i = 0; i < 5; i++) {

                const angle =
                    random(0, Math.PI * 2);

                game.spawnFragmentNear(
                    this.x +
                    Math.cos(angle) * 70,
                    this.y +
                    Math.sin(angle) * 70,
                    2
                );
            }
        }
    }

    damage(amount) {

        if (this.dead) {
            return;
        }

        this.hitFlash = 150;

        this.game.hitStop(2);

        this.hp -= amount;

        if (this.hp <= 0) {

            this.hp = 0;

            this.dead = true;

            this.game.echo += 4000;
            this.game.memory += 10;

            this.game.shake(24, 700);

            this.game.showEvent(
                t("tayatnaDestroyed")
            );

            this.game.showPickup(
                t("tayatnaReward")
            );

            this.game.particles.burst(
                this.x,
                this.y,
                120,
                "death",
                2.4
            );

            this.game.particles.ring(
                this.x,
                this.y,
                130,
                "death"
            );

            this.game.boss = null;

            return;
        }

        this.checkThresholds(
            this.game
        );
    }

    render(ctx) {

        if (this.dead) {
            return;
        }

        ctx.save();

        const crackLevel =
            this.crossedThresholds.size;

        const pulse =
            Math.sin(this.phase * 2) * 6;

        const glowColor =
            this.phase2
                ? "#ff3030"
                : "#8b0000";

        ctx.shadowBlur =
            30 + crackLevel * 8;

        ctx.shadowColor =
            glowColor;

        ctx.translate(
            this.x,
            this.y
        );

        ctx.strokeStyle =
            glowColor;

        ctx.fillStyle =
            this.hitFlash > 0
                ? "#ffffff"
                : "#040002";

        ctx.lineWidth =
            2 + crackLevel * 0.5;

        ctx.beginPath();

        for (let i = 0; i < 20; i++) {

            const angle =
                i *
                Math.PI *
                2 / 20;

            const jitter =
                crackLevel > 0
                    ? random(-4, 4) * crackLevel
                    : 0;

            const radius =
                this.radius +
                Math.sin(
                    this.phase * 2.5 + i
                ) * 9 +
                pulse +
                jitter;

            const x =
                Math.cos(angle) * radius;

            const y =
                Math.sin(angle) * radius;

            if (i === 0) {
                ctx.moveTo(x, y);
            }
            else {
                ctx.lineTo(x, y);
            }
        }

        ctx.closePath();

        ctx.fill();
        ctx.stroke();

        /* DROOPING TENDRILS — sorrow, weight, always present,
           multiplying and intensifying through phase 2 */

        const tendrilCount =
            6 + crackLevel * 2;

        ctx.strokeStyle =
            glowColor;

        ctx.globalAlpha = 0.75;

        for (let i = 0; i < tendrilCount; i++) {

            const angle =
                (Math.PI * 2 / tendrilCount) * i +
                Math.sin(this.phase + i) * 0.15;

            const sway =
                Math.sin(this.phase * 1.5 + i * 2) * 10;

            const length =
                this.radius * 1.4 +
                crackLevel * 6;

            ctx.beginPath();

            ctx.moveTo(
                Math.cos(angle) * this.radius * 0.7,
                Math.sin(angle) * this.radius * 0.7
            );

            ctx.quadraticCurveTo(
                Math.cos(angle) * length * 0.6 + sway,
                Math.sin(angle) * length * 0.6 + this.radius * 0.3,
                Math.cos(angle) * length * 0.3 + sway * 1.5,
                Math.sin(angle) * length + this.radius * 0.5
            );

            ctx.stroke();
        }

        ctx.globalAlpha = 1;

        /* VOID CORE */

        ctx.fillStyle =
            "#000000";

        ctx.beginPath();

        ctx.arc(
            0,
            0,
            32,
            0,
            Math.PI * 2
        );

        ctx.fill();

        /* EYE */

        ctx.fillStyle =
            glowColor;

        ctx.beginPath();

        ctx.ellipse(
            0,
            0,
            18 + pulse * 0.3,
            8 + pulse * 0.2,
            this.phase,
            0,
            Math.PI * 2
        );

        ctx.fill();

        ctx.restore();

        /* HP BAR */

        const width = 130;

        ctx.save();

        ctx.fillStyle =
            "#222222";

        ctx.fillRect(
            this.x - width / 2,
            this.y - this.radius - 22,
            width,
            5
        );

        ctx.fillStyle =
            glowColor;

        ctx.fillRect(
            this.x - width / 2,
            this.y - this.radius - 22,
            width *
            clamp(
                this.hp / this.maxHp,
                0,
                1
            ),
            5
        );

        ctx.restore();
    }
}

/* =========================================================
   CLUSTER SYSTEM
========================================================= */
class ClusterSystem {

    constructor() {

        this.nextClusterId = 1;
    }

    update(game) {

        const fragments =
            game.fragments.filter(
                f => !f.dead
            );

        for (const fragment of fragments) {

            fragment.clusterSize = 1;
            fragment.clusterType = "FRAGMENT";
        }

        const visited =
            new Set();

        for (const start of fragments) {

            if (visited.has(start)) {
                continue;
            }

            const group = [];
            const queue = [start];

            visited.add(start);

            while (queue.length > 0) {

                const current =
                    queue.shift();

                group.push(current);

                for (const other of fragments) {

                    if (
                        visited.has(other)
                    ) {
                        continue;
                    }

                    if (
                        distance(
                            current.x,
                            current.y,
                            other.x,
                            other.y
                        ) < 82
                    ) {

                        visited.add(other);

                        queue.push(other);
                    }
                }
            }

            if (group.length >= 3) {

                let type = "CLUSTER";

                if (group.length >= 25) {
                    type = "ABERRATION";
                }
                else if (group.length >= 12) {
                    type = "MASS";
                }
                else if (group.length >= 6) {
                    type = "NEST";
                }

                if (
                    group.length >
                    game.largestConvergence
                ) {

                    game.largestConvergence =
                        group.length;
                }

                for (const fragment of group) {

                    fragment.clusterSize =
                        group.length;

                    fragment.clusterType =
                        type;

                    fragment.clusterId =
                        this.nextClusterId;
                }

                this.nextClusterId++;

                if (
                    type === "ABERRATION" &&
                    !game.boss
                ) {

                    /* The giant boss only appears
                       at wave 10. Normal convergence
                       remains visually ABERRATION. */
                }
            }
        }
    }

    render(ctx, game) {

        const groups = {};

        for (const fragment of game.fragments) {

            if (fragment.dead) {
                continue;
            }

            if (
                fragment.clusterSize < 3
            ) {
                continue;
            }

            const id =
                fragment.clusterId;

            if (!groups[id]) {
                groups[id] = [];
            }

            groups[id].push(fragment);
        }

        for (const id in groups) {

            const group =
                groups[id];

            if (group.length < 3) {
                continue;
            }

            let centerX = 0;
            let centerY = 0;

            for (const fragment of group) {

                centerX += fragment.x;
                centerY += fragment.y;
            }

            centerX /= group.length;
            centerY /= group.length;

            const radius =
                Math.min(
                    180,
                    35 +
                    group.length * 4
                );

            let color =
                "#999999";

            if (group.length >= 6) {
                color = "#004d40";
            }

            if (group.length >= 12) {
                color = "#8b0000";
            }

            if (group.length >= 25) {
                color = "#ffffcc";
            }

            ctx.save();

            ctx.globalAlpha =
                0.12;

            ctx.strokeStyle =
                color;

            ctx.lineWidth = 1;

            ctx.beginPath();

            ctx.arc(
                centerX,
                centerY,
                radius,
                0,
                Math.PI * 2
            );

            ctx.stroke();

            ctx.restore();

            if (group.length >= 6) {

                ctx.save();

                ctx.fillStyle =
                    color;

                ctx.globalAlpha =
                    0.55;

                ctx.font =
                    "9px Courier New";

                ctx.textAlign =
                    "center";

                ctx.fillText(
                    group.length >= 25
                        ? "ABERRATION"
                        : group.length >= 12
                            ? "MASS"
                            : "NEST",
                    centerX,
                    centerY - radius - 5
                );

                ctx.restore();
            }
        }
    }
}

/* =========================================================
   DEFENSE SYSTEM
========================================================= */

class DefenseSystem {

    constructor(game) {

        this.game = game;

        this.cooldowns = {
        eye: 160,
        q: 10000,
        c: 2500,
        e: 7000,
        r: 12000,
        f: 15000
        };      

        this.lastUsed = {
            eye: -Infinity,
            q: -Infinity,
            c: -Infinity,
            e: -Infinity,
            r: -Infinity,
            f: -Infinity
        };

        this.eyeDamage = 20;
        this.eyePierce = 0;

        this.thornDamage = 5;
        this.thornPush = 90;
        this.thornRange = 95;

        this.callCost = 15;
        this.callAlertDuration = 4000;

        this.gravityDuration = 3000;
        this.gravityRadius = 270;

        this.chorusDamage = 70;

        this.mouthThreshold = 0.45;
    }

    ready(name) {

        return (
            performance.now() -
            this.lastUsed[name] >=
            this.cooldowns[name]
        );
    }

    use(name) {

        if (!this.ready(name)) {
            return false;
        }

        this.lastUsed[name] =
            performance.now();

        return true;
    }

    update(dt, game) {

        const input =
            game.input;

                if (
            input.mouse.down
        ) {

            if (this.ready("eye")) {

                this.fireEye(game);
            }
        }

        if (
            input.isDown("q")
        ) {

            if (this.ready("q")) {

                this.theCall(game);
            }
        }

        if (
            input.isDown("c")
        ) {

            if (this.ready("c")) {

                this.thorn(game);
            }
        }
        if (
            input.isDown("e")
        ) {

            if (this.ready("e")) {

                this.gravity(game);
            }
        }

        if (
            input.isDown("r")
        ) {

            if (this.ready("r")) {

                this.chorus(game);
            }
        }

        if (
            input.isDown("f")
        ) {

            if (this.ready("f")) {

                this.mouth(game);
            }
        }
    }

        fireEye(game) {

        this.use("eye");

        const angle =
            angleTo(
                game.witness.x,
                game.witness.y,
                game.input.mouse.x,
                game.input.mouse.y
            );

        game.projectiles.push(
            new Projectile(
                game.witness.x,
                game.witness.y,
                angle,
                this.eyeDamage,
                this.eyePierce
            )
        );
    }

        thorn(game) {

        if (game.witness.energy < 12) {
            return;
        }

        this.use("c");

        game.witness.energy -= 12;

        const range =
            this.thornRange;

        for (const fragment of game.fragments) {

            if (fragment.dead) {
                continue;
            }

            const d =
                distance(
                    game.witness.x,
                    game.witness.y,
                    fragment.x,
                    fragment.y
                );

            if (d < range) {

                const dir =
                    normalize(
                        fragment.x -
                        game.witness.x,
                        fragment.y -
                        game.witness.y
                    );

                fragment.damage(
                    this.thornDamage
                );

                fragment.x +=
                    dir.x * this.thornPush;

                fragment.y +=
                    dir.y * this.thornPush;
            }
        }

        if (game.boss) {

            const d =
                distance(
                    game.witness.x,
                    game.witness.y,
                    game.boss.x,
                    game.boss.y
                );

            if (d < range) {

                game.boss.damage(
                    this.thornDamage
                );
            }
        }

        game.particles.ring(
            game.witness.x,
            game.witness.y,
            range,
            "energy"
        );
    }

    gravity(game) {

        if (game.witness.energy < 22) {
            return;
        }

        this.use("e");

        game.witness.energy -= 22;

        game.gravityFields.push({
            x: game.witness.x,
            y: game.witness.y,
            radius: this.gravityRadius,
            life: this.gravityDuration,
            maxLife: this.gravityDuration
        });

        game.showEvent(
            t("gravityWombEvent")
        );
    }

    chorus(game) {

        if (game.witness.energy < 32) {
            return;
        }

        this.use("r");

        game.witness.energy -= 32;

        const range = 220;

        for (const fragment of game.fragments) {

            if (fragment.dead) {
                continue;
            }

            const d =
                distance(
                    game.witness.x,
                    game.witness.y,
                    fragment.x,
                    fragment.y
                );

            if (d < range) {

                fragment.damage(
                    this.chorusDamage
                );
            }
        }

        if (game.boss) {

            const d =
                distance(
                    game.witness.x,
                    game.witness.y,
                    game.boss.x,
                    game.boss.y
                );

            if (d < range) {

                game.boss.damage(
                    this.chorusDamage
                );
            }
        }

        game.particles.ring(
            game.witness.x,
            game.witness.y,
            range,
            "memory"
        );

        game.showEvent(
            t("chorusEvent")
        );
    }

    mouth(game) {

        if (game.witness.energy < 25) {
            return;
        }

        this.use("f");

        let consumed = 0;

        for (const fragment of game.fragments) {

            if (fragment.dead) {
                continue;
            }

            const d =
                distance(
                    game.witness.x,
                    game.witness.y,
                    fragment.x,
                    fragment.y
                );

            if (
                d < 45 &&
                fragment.hp <
                fragment.maxHp *
                this.mouthThreshold
            ) {

                fragment.dead = true;

                consumed++;

                game.echo +=
                    fragment.clusterSize * 2;
            }
        }

        if (consumed > 0) {

            game.witness.energy =
                clamp(
                    game.witness.energy +
                    consumed * 8,
                    0,
                    game.witness.maxEnergy
                );

            game.showEvent(
                t("mouthEvent", { n: consumed })
            );
        }
    }
    theCall(game) {

        if (
            game.witness.energy <
            this.callCost
        ) {
            return;
        }

        this.use("q");

        game.witness.energy -=
            this.callCost;

        /* COLLECT ALL DROPS ON THE MAP */

        for (const drop of game.drops) {

            if (drop.collected) {
                continue;
            }

            drop.collect(game);
        }

        /* ALERT THE SWARM */

        const alertUntil =
            performance.now() +
            this.callAlertDuration;

        for (const fragment of game.fragments) {

            if (fragment.dead) {
                continue;
            }

            fragment.alertUntil =
                alertUntil;
        }

        game.particles.ring(
            game.witness.x,
            game.witness.y,
            320,
            "memory"
        );

        game.showEvent(
            t("theCallEvent")
        );
    }
    getCooldownPercent(name) {

        const elapsed =
            performance.now() -
            this.lastUsed[name];

        return clamp(
            elapsed /
            this.cooldowns[name],
            0,
            1
        );
    }
}

/* =========================================================
   UPGRADE SYSTEM
========================================================= */

class UpgradeSystem {

    constructor(game) {

        this.game = game;

            this.upgrades = [

            {
                id: "sharpEye",
                nameKey: "upgradeSharpEyeName",
                descKey: "upgradeSharpEyeDesc",
                cost: 20,

                apply: game => {
                    game.defense.eyeDamage += 8;
                }
            },

            {
                id: "deepReservoir",
                nameKey: "upgradeDeepReservoirName",
                descKey: "upgradeDeepReservoirDesc",
                cost: 25,

                apply: game => {
                    game.witness.maxEnergy += 20;
                    game.witness.energy += 20;
                }
            },

            {
                id: "hardenedForm",
                nameKey: "upgradeHardenedFormName",
                descKey: "upgradeHardenedFormDesc",
                cost: 30,

                apply: game => {
                    game.witness.maxIntegrity += 15;
                    game.witness.integrity += 15;
                }
            },

            {
                id: "thornGrowth",
                nameKey: "upgradeThornGrowthName",
                descKey: "upgradeThornGrowthDesc",
                cost: 40,

                apply: game => {
                    game.defense.thornDamage += 12;
                    game.defense.thornRange += 20;
                }
            },

            {
                id: "gravityRemembers",
                nameKey: "upgradeGravityRemembersName",
                descKey: "upgradeGravityRemembersDesc",
                cost: 50,

                apply: game => {
                    game.defense.gravityDuration += 1000;
                }
            },

            {
                id: "piercingEye",
                nameKey: "upgradePiercingEyeName",
                descKey: "upgradePiercingEyeDesc",
                cost: 60,

                apply: game => {
                    game.defense.eyePierce++;
                }
            },

            {
                id: "longChorus",
                nameKey: "upgradeLongChorusName",
                descKey: "upgradeLongChorusDesc",
                cost: 70,

                apply: game => {
                    game.defense.chorusDamage += 25;
                }
            },

            {
                id: "livingNerve",
                nameKey: "upgradeLivingNerveName",
                descKey: "upgradeLivingNerveDesc",
                cost: 80,

                apply: game => {
                    game.witness.energyRegen += 0.006;
                }
            },

            {
                id: "echoHunger",
                nameKey: "upgradeEchoHungerName",
                descKey: "upgradeEchoHungerDesc",
                cost: 90,

                apply: game => {
                    game.echoMultiplier += 0.25;
                }
            },

            {
                id: "memoryHarvest",
                nameKey: "upgradeMemoryHarvestName",
                descKey: "upgradeMemoryHarvestDesc",
                cost: 100,

                apply: game => {
                    game.memoryDropChance += 0.20;
                }
            }
        ];

        /* =========================================================
           PROGRESSIVE UPGRADE COSTS
        ========================================================= */

        this.purchaseCount = {};

        for (const upgrade of this.upgrades) {

            this.purchaseCount[upgrade.id] = 0;
        }
    }

    getCost(upgrade) {

        const purchases =
            this.purchaseCount[upgrade.id];

        return Math.ceil(
            upgrade.cost *
            Math.pow(1.5, purchases)
        );
    }

    show() {

    const choices =
        [...this.upgrades]
            .sort(
                () => Math.random() - 0.5
            )
            .slice(0, 3);

    /* =========================================================
       CHECK AFFORDABLE UPGRADE
    ========================================================= */

    const affordable =
        choices.some(
            upgrade =>
                this.game.echo >=
                this.getCost(upgrade)
        );

    if (
        !affordable
    ) {

        return false;
    }

    this.game.state =
        "UPGRADE";

    upgradeScreen.classList.remove(
        "hidden"
    );

    upgradeGrid.innerHTML = "";

    for (const upgrade of choices) {

        const cost =
            this.getCost(upgrade);

        const canBuy =
            this.game.echo >=
            cost;

        const card =
            document.createElement("div");

        card.className =
            "upgradeCard";

        card.innerHTML = `
            <div class="upgradeName">
                ${t(upgrade.nameKey)}
            </div>

            <div class="upgradeDescription">
                ${t(upgrade.descKey)}
            </div>

            <div class="upgradeCost ${
                canBuy
                    ? ""
                    : "insufficient"
            }">
                ECHO ${cost}
            </div>
        `;

        /* =====================================================
           PURCHASE
        ===================================================== */

        if (
            canBuy
        ) {

            card.addEventListener(
                "click",
                () => {

                    const currentCost =
                        this.getCost(upgrade);

                    if (
                        this.game.echo <
                        currentCost
                    ) {

                        return;
                    }

                    this.game.echo -=
                        currentCost;

                    upgrade.apply(
                        this.game
                    );

                    this.purchaseCount[
                        upgrade.id
                    ]++;

                    upgradeScreen.classList.add(
                        "hidden"
                    );

                    this.game.state =
                        "PLAYING";

                    this.game.showEvent(
                        t(upgrade.nameKey)
                    );
                }
            );
        }

        upgradeGrid.appendChild(
            card
        );
    }

    return true;
}
}
/* =========================================================
   MENU CREATURE
========================================================= */

class MenuCreature {

    constructor() {

        this.x =
            random(0, canvas.width);

        this.y =
            random(0, canvas.height);

        this.vx =
            random(-0.025, 0.025);

        this.vy =
            random(-0.018, 0.018);

        this.size =
            random(8, 24);

        this.phase =
            random(0, Math.PI * 2);

        this.alpha =
            random(0.15, 0.5);

        this.speed =
            random(0.0005, 0.0015);
    }

    update(dt) {

        this.phase +=
            dt * this.speed;

        this.x +=
            this.vx * dt;

        this.y +=
            this.vy * dt;

        if (this.x < -50) {
            this.x = canvas.width + 50;
        }

        if (this.x > canvas.width + 50) {
            this.x = -50;
        }

        if (this.y < -50) {
            this.y = canvas.height + 50;
        }

        if (this.y > canvas.height + 50) {
            this.y = -50;
        }
    }

    render(ctx) {

        ctx.save();

        ctx.translate(
            this.x,
            this.y
        );

        ctx.rotate(
            this.phase
        );

        ctx.globalAlpha =
            this.alpha;

        ctx.strokeStyle =
            "#999999";

        ctx.fillStyle =
            "#050509";

        ctx.beginPath();

        ctx.moveTo(
            0,
            -this.size
        );

        ctx.lineTo(
            this.size,
            0
        );

        ctx.lineTo(
            0,
            this.size
        );

        ctx.lineTo(
            -this.size,
            0
        );

        ctx.closePath();

        ctx.fill();
        ctx.stroke();

        for (let i = 0; i < 4; i++) {

            const angle =
                i *
                Math.PI /
                2;

            ctx.beginPath();

            ctx.moveTo(
                Math.cos(angle) * 5,
                Math.sin(angle) * 5
            );

            ctx.lineTo(
                Math.cos(angle) *
                (this.size + 12),
                Math.sin(angle) *
                (this.size + 12)
            );

            ctx.stroke();
        }

        ctx.restore();
    }
}

/* =========================================================
   GAME
========================================================= */

/* =========================================================
   GAME
========================================================= */

class Game {

    constructor() {

        this.input =
            new InputSystem(canvas);

        this.particles =
            new ParticleSystem();

        this.clusterSystem =
            new ClusterSystem();

        this.state =
            "TITLE";

        this.fragments = [];
        this.projectiles = [];
        this.drops = [];

        this.obstacles = [];

        this.gravityFields = [];
        this.dangerZones = [];

        this.boss = null;

        this.triggeredBossWaves =
            new Set();

        this.echo = 0;
        this.memory = 0;

        this.wave = 1;

        this.kills = 0;
        this.nextUpgradeKills = 10;
        this.totalSpawned = 0;

        this.timeAlive = 0;

        this.combo = 0;
        this.maxCombo = 1;

        this.largestConvergence = 0;

        this.aberrationsKilled = 0;

        this.waveDuration =
            30000;

        this.waveTimer =
            this.waveDuration;

        this.waveAdjusted = false;

        this.spawnTimer = 0;

        this.maxFragments = 150;

        this.mapTier = 1;
        this.mapAccentColor = "25,25,112";

        this.echoMultiplier = 1;

        this.memoryDropChance =
            0.025;

        this.witness =
            new Witness(this);

        this.defense =
            new DefenseSystem(this);

        this.upgrades =
            new UpgradeSystem(this);

        this.lastTime =
            performance.now();

        this.eventTimer = 0;
        this.pickupTimer = 0;

        this.shakeMagnitude = 0;
        this.shakeDuration = 0;
        this.shakeTimer = 0;

        this.hitStopFrames = 0;

        this.menuCreatures = [];

        for (let i = 0; i < 25; i++) {

            this.menuCreatures.push(
                new MenuCreature()
            );
        }

        this.createMap();

        requestAnimationFrame(
            this.loop.bind(this)
        );
    }

    createMap(tier = 1) {

        this.mapTier = tier;

        if (tier === 1) {

            this.mapAccentColor = "25,25,112";

            this.obstacles = [

                new Obstacle(300, 210, 120, 55),
                new Obstacle(770, 180, 120, 55),
                new Obstacle(480, 480, 240, 45),
                new Obstacle(90, 430, 100, 60),
                new Obstacle(970, 420, 100, 60)
            ];
        }

        else if (tier === 2) {

            this.mapAccentColor = "90,20,70";

            this.obstacles = [

                new Obstacle(200, 150, 110, 50),
                new Obstacle(890, 150, 110, 50),
                new Obstacle(550, 130, 100, 45),
                new Obstacle(150, 510, 110, 55),
                new Obstacle(940, 510, 110, 55),
                new Obstacle(50, 300, 90, 160),
                new Obstacle(1060, 300, 90, 160)
            ];
        }

        else {

            this.mapAccentColor = "139,0,0";

            this.obstacles = [

                new Obstacle(400, 190, 100, 50),
                new Obstacle(700, 190, 100, 50),
                new Obstacle(250, 300, 80, 140),
                new Obstacle(870, 300, 80, 140),
                new Obstacle(400, 540, 100, 50),
                new Obstacle(700, 540, 100, 50),
                new Obstacle(550, 110, 100, 40),
                new Obstacle(550, 570, 100, 40)
            ];
        }

        this.repositionWitnessIfStuck();
    }

    getMapTierForWave(wave) {

        if (wave <= 15) {
            return 1;
        }

        if (wave <= 30) {
            return 2;
        }

        return 3;
    }

    repositionWitnessIfStuck() {

        if (!this.witness) {
            return;
        }

        for (const obstacle of this.obstacles) {

            if (
                obstacle.collidesCircle(
                    this.witness.x,
                    this.witness.y,
                    this.witness.radius
                )
            ) {

                this.witness.x =
                    canvas.width / 2;

                this.witness.y =
                    canvas.height / 2;

                this.witness.vx = 0;
                this.witness.vy = 0;

                return;
            }
        }
    }

    startNewRun() {

        this.state =
            "PLAYING";

        this.fragments = [];
        this.projectiles = [];
        this.drops = [];

        this.gravityFields = [];
        this.dangerZones = [];

        this.boss = null;

        this.triggeredBossWaves =
            new Set();

        this.echo = 0;
        this.memory = 0;

        this.wave = 1;

        this.kills = 0;
        this.nextUpgradeKills = 10;
        this.totalSpawned = 0;

        this.timeAlive = 0;

        this.combo = 0;
        this.maxCombo = 1;

        this.largestConvergence = 0;

        this.aberrationsKilled = 0;

        this.waveTimer =
            this.waveDuration;

        this.waveAdjusted = false;

        this.spawnTimer =
            500;

        this.echoMultiplier =
            1;

        this.memoryDropChance =
            0.025;

        this.witness =
            new Witness(this);

        this.defense =
            new DefenseSystem(this);

        this.createMap(1);

        titleScreen.classList.add(
            "hidden"
        );

        tutorialScreen.classList.add(
            "hidden"
        );

        pauseScreen.classList.add(
            "hidden"
        );

        upgradeScreen.classList.add(
            "hidden"
        );

        gameOverScreen.classList.add(
            "hidden"
        );

        bossHUD.classList.add(
            "hidden"
        );

        this.showEvent(
            t("waveEvent", { n: 1 })
        );

        this.updateHUD();
    }

    pause() {

        if (
            this.state !==
            "PLAYING"
        ) {
            return;
        }

        this.state =
            "PAUSED";

        pauseScreen.classList.remove(
            "hidden"
        );
    }

    resume() {

        if (
            this.state !==
            "PAUSED"
        ) {
            return;
        }

        this.state =
            "PLAYING";

        pauseScreen.classList.add(
            "hidden"
        );

        this.lastTime =
            performance.now();
    }

    gameOver() {

        if (
            this.state ===
            "GAME_OVER"
        ) {
            return;
        }

        this.state =
            "GAME_OVER";

        document.getElementById(
            "finalWave"
        ).textContent =
            this.wave;

        document.getElementById(
            "finalKills"
        ).textContent =
            this.kills;

        document.getElementById(
            "finalEcho"
        ).textContent =
            this.echo;

        document.getElementById(
            "finalMemory"
        ).textContent =
            this.memory;

        document.getElementById(
            "finalCombo"
        ).textContent =
            `x${this.maxCombo}`;

        document.getElementById(
            "finalConvergence"
        ).textContent =
            this.largestConvergence;

        gameOverScreen.classList.remove(
            "hidden"
        );
    }

    spawnFragment() {

        if (
            this.fragments.length >=
            this.maxFragments
        ) {
            return;
        }

        const side =
            Math.floor(
                random(0, 4)
            );

        let x;
        let y;

        if (side === 0) {

            x =
                random(
                    0,
                    canvas.width
                );

            y = -25;
        }

        else if (side === 1) {

            x =
                canvas.width + 25;

            y =
                random(
                    0,
                    canvas.height
                );
        }

        else if (side === 2) {

            x =
                random(
                    0,
                    canvas.width
                );

            y =
                canvas.height + 25;
        }

        else {

            x = -25;

            y =
                random(
                    0,
                    canvas.height
                );
        }

        this.spawnFragmentNear(
            x,
            y,
            this.wave
        );
    }

    spawnFragmentNear(
        x,
        y,
        power = 1
    ) {

        if (
            this.fragments.length >=
            this.maxFragments
        ) {
            return;
        }

        const archetype =
            getWaveArchetype(this.wave);

        const hp =
            (
                25 +
                power * 4 +
                random(0, 10)
            ) * archetype.hpMult;

        const speed =
            (
                0.045 +
                this.wave * 0.0015
            ) * archetype.speedMult;

        this.fragments.push(
            new Fragment(
                this,
                x,
                y,
                hp,
                speed
            )
        );

        this.totalSpawned++;
    }

    registerKill(fragment) {

    this.kills++;

    this.combo++;

    if (
        this.combo >
        this.maxCombo
    ) {

        this.maxCombo =
            this.combo;
    }

    /* MEMORY FRACTURE */

    if (
        this.kills >=
        this.nextUpgradeKills
    ) {

        const upgradeShown =
            this.upgrades.show();

        if (
            upgradeShown
        ) {

            this.kills = 0;

            if (
                this.nextUpgradeKills < 22
            ) {

                this.nextUpgradeKills += 2;

            } else {

                this.nextUpgradeKills += 3;
            }

        } else {

            this.showEvent(
                t("gatherEcho")
            );
        }
    }
}

    showEvent(message) {

        eventMessage.textContent =
            message;

        this.eventTimer =
            1400;
    }

    showPickup(message) {

        pickupMessage.textContent =
            message;

        pickupMessage.style.opacity =
            "1";

        this.pickupTimer =
            1000;
    }

    shake(magnitude, duration) {

        if (magnitude < this.shakeMagnitude) {
            return;
        }

        this.shakeMagnitude = magnitude;
        this.shakeDuration = duration;
        this.shakeTimer = duration;
    }

    hitStop(frames) {

        this.hitStopFrames =
            Math.max(
                this.hitStopFrames,
                frames
            );
    }

    update(dt) {

        if (
            this.state !==
            "PLAYING"
        ) {
            return;
        }

        this.timeAlive +=
            dt;

        this.waveTimer -=
            dt;

        /* WAVE PRESSURE ADJUSTMENT — evaluated once, near the
           end of the base 30s, using combined swarm density
           and largest active cluster as the pressure signal. */

        if (
            this.waveTimer <= 4000 &&
            !this.waveAdjusted
        ) {

            this.waveAdjusted = true;

            const pressure =
                calculateSwarmPressure(this);

            if (pressure <= 0.3) {

                const subtractAmount =
                    ((0.3 - pressure) / 0.3) *
                    4000;

                this.waveTimer -=
                    subtractAmount;
            }

            else if (pressure >= 0.7) {

                const addAmount =
                    ((pressure - 0.7) / 0.3) *
                    4000;

                this.waveTimer +=
                    addAmount;
            }
        }

        if (
            this.waveTimer <= 0
        ) {

            this.wave++;

            this.waveTimer =
                this.waveDuration;

            this.waveAdjusted = false;

            this.showEvent(
                t("waveEvent", { n: this.wave })
            );

            const targetMapTier =
                this.getMapTierForWave(this.wave);

            if (targetMapTier !== this.mapTier) {

                this.createMap(targetMapTier);

                const mapKey =
                    targetMapTier === 2
                        ? "mapTransitionTier2"
                        : "mapTransitionTier3";

                this.showEvent(
                    t(mapKey)
                );
            }

            const bossKey =
                BOSS_SEQUENCE[this.wave];

            if (
                bossKey &&
                !this.triggeredBossWaves.has(this.wave) &&
                !this.boss
            ) {

                const bossInstance =
                    createBossInstance(
                        bossKey,
                        this
                    );

                if (bossInstance) {

                    this.boss =
                        bossInstance;

                    this.triggeredBossWaves.add(
                        this.wave
                    );

                    this.showEvent(
                        t(
                            bossInstance.arrivalKey ||
                            "aberrationDescends"
                        )
                    );
                }
            }
        }

                /* SPAWNING */
        /* Boss room: while a boss is active, no new swarm
           fragments enter the map. Existing ones must be
           cleared by the player, but nothing new spawns
           until the boss is defeated. */

        this.spawnTimer -=
            dt;

        if (
            !this.boss &&
            this.spawnTimer <= 0 &&
            this.fragments.length <
            this.maxFragments
        ) {

            const archetype =
                getWaveArchetype(this.wave);

            const elapsed =
                this.waveDuration -
                this.waveTimer;

            const phaseMult =
                getWavePhaseMultiplier(
                    elapsed,
                    this.waveDuration
                );

            const baseInterval =
                Math.max(
                    220,
                    1100 -
                    this.wave * 65
                );

            const interval =
                Math.max(
                    150,
                    baseInterval *
                    archetype.intervalMult *
                    phaseMult
                );

            this.spawnTimer =
                interval;

            const count =
                Math.max(
                    1,
                    Math.round(
                        archetype.countMult
                    )
                );

            for (
                let i = 0;
                i < count;
                i++
            ) {

                this.spawnFragment();
            }
        }

        this.witness.update(
            dt,
            this
        );

        this.defense.update(
            dt,
            this
        );

        for (
            const projectile of
            this.projectiles
        ) {

            projectile.update(
                dt,
                this
            );
        }

        for (
            const fragment of
            this.fragments
        ) {

            fragment.update(
                dt,
                this
            );
        }

        if (this.boss) {

            this.boss.update(
                dt,
                this
            );
        }

        /* GRAVITY */

        for (
            let i =
                this.gravityFields.length - 1;
            i >= 0;
            i--
        ) {

            const field =
                this.gravityFields[i];

            field.life -=
                dt;

            if (
                field.life <= 0
            ) {

                this.gravityFields.splice(
                    i,
                    1
                );

                continue;
            }

            for (
                const fragment of
                this.fragments
            ) {

                if (
                    fragment.dead
                ) {
                    continue;
                }

                const d =
                    distance(
                        field.x,
                        field.y,
                        fragment.x,
                        fragment.y
                    );

                if (
                    d <
                    field.radius
                ) {

                    fragment.vx *=
                        0.88;

                    fragment.vy *=
                        0.88;
                }
            }
        }

        /* DANGER ZONES */

        for (
            let i =
                this.dangerZones.length - 1;
            i >= 0;
            i--
        ) {

            const zone =
                this.dangerZones[i];

            zone.life -=
                dt;

            if (
                zone.life <= 0
            ) {

                this.dangerZones.splice(
                    i,
                    1
                );

                continue;
            }

            const d =
                distance(
                    zone.x,
                    zone.y,
                    this.witness.x,
                    this.witness.y
                );

            if (
                d <
                zone.radius
            ) {

                this.witness.damage(
                    5
                );
            }
        }

        /* DROPS */

        for (
            const drop of
            this.drops
        ) {

            drop.update(
                dt,
                this
            );
        }

        /* CLUSTERS */

        this.clusterSystem.update(
            this
        );

        /* CLEAN */

        this.projectiles =
            this.projectiles.filter(
                p =>
                    !p.dead
            );

        this.fragments =
            this.fragments.filter(
                f =>
                    !f.dead
            );

        this.drops =
            this.drops.filter(
                d =>
                    !d.collected
            );

        this.particles.update(
            dt
        );

        /* COMBO DECAY */

        if (
            this.kills > 0 &&
            Math.floor(
                this.timeAlive / 1000
            ) % 5 === 0
        ) {

            this.combo =
                Math.max(
                    1,
                    this.combo
                );
        }

        /* EVENTS */

        if (
            this.eventTimer > 0
        ) {

            this.eventTimer -=
                dt;

            if (
                this.eventTimer <= 0
            ) {

                eventMessage.textContent =
                    "";
            }
        }

        if (
            this.pickupTimer > 0
        ) {

            this.pickupTimer -=
                dt;

            if (
                this.pickupTimer <= 0
            ) {

                pickupMessage.style.opacity =
                    "0";
            }
        }

        if (
            this.shakeTimer > 0
        ) {

            this.shakeTimer -=
                dt;

            if (
                this.shakeTimer <= 0
            ) {

                this.shakeTimer = 0;
                this.shakeMagnitude = 0;
            }
        }

        this.updateHUD();
    }

    updateHUD() {

        integrityFill.style.width =
            `${
                (
                    this.witness.integrity /
                    this.witness.maxIntegrity
                ) * 100
            }%`;

        energyFill.style.width =
            `${
                (
                    this.witness.energy /
                    this.witness.maxEnergy
                ) * 100
            }%`;

        integrityText.textContent =
            `${
                Math.ceil(
                    this.witness.integrity
                )
            } / ${
                this.witness.maxIntegrity
            }`;

        energyText.textContent =
            `${
                Math.floor(
                    this.witness.energy
                )
            } / ${
                this.witness.maxEnergy
            }`;

        echoText.textContent =
            this.echo;

        memoryText.textContent =
            this.memory;

        waveText.textContent =
        this.wave;

        killsText.textContent =
         this.kills;

        comboText.textContent =
            `x${
                Math.max(
                    1,
                    this.combo
                )
            }`;

        const waveProgress =
            1 -
            this.waveTimer /
            this.waveDuration;

        waveFill.style.width =
            `${
                clamp(
                    waveProgress,
                    0,
                    1
                ) * 100
            }%`;

        /* ABILITIES */

        const cooldowns = {

            cooldownEye: "eye",
            cooldownQ: "q",
            cooldownC: "c",
            cooldownE: "e",
            cooldownR: "r",
            cooldownF: "f"
        };

        for (
            const id in cooldowns
        ) {

            const key =
                cooldowns[id];

            const element =
                document.getElementById(
                    id
                );

            if (!element) {
                continue;
            }

            const percent =
                this.defense
                    .getCooldownPercent(
                        key
                    );

            const remaining =
                Math.max(
                    0,
                    this.defense.cooldowns[key] -
                    (
                        performance.now() -
                        this.defense.lastUsed[key]
                    )
                );

            element.style.width =
                `${
                    (1 - percent) * 100
                }%`;

            if (
                percent >= 1
            ) {

                element.textContent =
                    "READY";

            }
            else {

                element.textContent =
                    `${
                        (
                            remaining / 1000
                        ).toFixed(1)
                    }`;
            }
        }

        /* DASH */

        const dashElement =
            document.getElementById(
                "cooldownDash"
            );

        if (dashElement) {

            const dashElapsed =
                performance.now() -
                this.witness.lastDash;

            const dashPercent =
                clamp(
                    dashElapsed /
                    this.witness.dashCooldown,
                    0,
                    1
                );

            const dashRemaining =
                Math.max(
                    0,
                    this.witness.dashCooldown -
                    dashElapsed
                );

            dashElement.style.width =
                `${
                    (1 - dashPercent) * 100
                }%`;

            if (
                dashPercent >= 1
            ) {

                dashElement.textContent =
                    "READY";

            }
            else {

                dashElement.textContent =
                    `${
                        (
                            dashRemaining / 1000
                        ).toFixed(1)
                    }`;
            }
        }

        /* BOSS */

        if (this.boss) {

            bossHUD.classList.remove(
                "hidden"
            );

            const bossTitleElement =
                document.getElementById(
                    "bossTitle"
                );

            if (bossTitleElement) {

                bossTitleElement.textContent =
                    t(
                        this.boss.labelKey ||
                        "bossTitleAberration"
                    );
            }

            bossFill.style.width =
                `${
                    clamp(
                        this.boss.hp /
                        this.boss.maxHp,
                        0,
                        1
                    ) * 100
                }%`;
        }

        else {

            bossHUD.classList.add(
                "hidden"
            );
        }
    }

    renderBackground() {

        ctx.fillStyle =
            "#191970";

        ctx.fillRect(
            0,
            0,
            canvas.width,
            canvas.height
        );

        /* GRID */

        ctx.save();

        ctx.strokeStyle =
            "rgba(255,255,204,0.035)";

        ctx.lineWidth =
            1;

        const grid =
            40;

        for (
            let x = 0;
            x <= canvas.width;
            x += grid
        ) {

            ctx.beginPath();

            ctx.moveTo(
                x,
                0
            );

            ctx.lineTo(
                x,
                canvas.height
            );

            ctx.stroke();
        }

        for (
            let y = 0;
            y <= canvas.height;
            y += grid
        ) {

            ctx.beginPath();

            ctx.moveTo(
                0,
                y
            );

            ctx.lineTo(
                canvas.width,
                y
            );

            ctx.stroke();
        }

        ctx.restore();

        /* ATMOSPHERE */

        const gradient =
            ctx.createRadialGradient(
                canvas.width / 2,
                canvas.height / 2,
                100,
                canvas.width / 2,
                canvas.height / 2,
                650
            );

        gradient.addColorStop(
            0,
            `rgba(${this.mapAccentColor},0)`
        );

        gradient.addColorStop(
            1,
            "rgba(0,0,0,0.55)"
        );

        ctx.fillStyle =
            gradient;

        ctx.fillRect(
            0,
            0,
            canvas.width,
            canvas.height
        );
    }

    renderMenuBackground() {

        ctx.fillStyle =
            "#080812";

        ctx.fillRect(
            0,
            0,
            canvas.width,
            canvas.height
        );

        /* GRID */

        ctx.save();

        ctx.strokeStyle =
            "rgba(255,255,204,0.025)";

        for (
            let x = 0;
            x < canvas.width;
            x += 40
        ) {

            ctx.beginPath();

            ctx.moveTo(
                x,
                0
            );

            ctx.lineTo(
                x,
                canvas.height
            );

            ctx.stroke();
        }

        for (
            let y = 0;
            y < canvas.height;
            y += 40
        ) {

            ctx.beginPath();

            ctx.moveTo(
                0,
                y
            );

            ctx.lineTo(
                canvas.width,
                y
            );

            ctx.stroke();
        }

        ctx.restore();

        for (
            const creature of
            this.menuCreatures
        ) {

            creature.update(
                16
            );

            creature.render(
                ctx
            );
        }

        /* CENTER VOID */

        const gradient =
            ctx.createRadialGradient(
                canvas.width / 2,
                canvas.height / 2,
                40,
                canvas.width / 2,
                canvas.height / 2,
                500
            );

        gradient.addColorStop(
            0,
            "rgba(25,25,112,0.15)"
        );

        gradient.addColorStop(
            1,
            "rgba(0,0,0,0.7)"
        );

        ctx.fillStyle =
            gradient;

        ctx.fillRect(
            0,
            0,
            canvas.width,
            canvas.height
        );
    }

    render() {

        if (
            this.state ===
            "TITLE"
        ) {

            this.renderMenuBackground();

            return;
        }

        ctx.save();

        if (this.shakeTimer > 0) {

            const shakeFactor =
                this.shakeTimer /
                this.shakeDuration;

            const offsetX =
                random(-1, 1) *
                this.shakeMagnitude *
                shakeFactor;

            const offsetY =
                random(-1, 1) *
                this.shakeMagnitude *
                shakeFactor;

            ctx.translate(
                offsetX,
                offsetY
            );
        }

        this.renderBackground();

        /* DANGER */

        for (
            const zone of
            this.dangerZones
        ) {

            ctx.save();

            ctx.globalAlpha =
                clamp(
                    zone.life /
                    zone.maxLife,
                    0,
                    1
                ) * 0.35;

            ctx.strokeStyle =
                "#8b0000";

            ctx.lineWidth =
                2;

            ctx.beginPath();

            ctx.arc(
                zone.x,
                zone.y,
                zone.radius,
                0,
                Math.PI * 2
            );

            ctx.stroke();

            ctx.restore();
        }

        /* GRAVITY */

        for (
            const field of
            this.gravityFields
        ) {

            ctx.save();

            ctx.globalAlpha =
                0.18;

            ctx.strokeStyle =
                "#004d40";

            ctx.beginPath();

            ctx.arc(
                field.x,
                field.y,
                field.radius,
                0,
                Math.PI * 2
            );

            ctx.stroke();

            ctx.globalAlpha =
                0.05;

            ctx.fillStyle =
                "#004d40";

            ctx.fill();

            ctx.restore();
        }

        /* OBSTACLES */

        for (
            const obstacle of
            this.obstacles
        ) {

            obstacle.render(
                ctx
            );
        }

        /* CLUSTERS */

        this.clusterSystem.render(
            ctx,
            this
        );

        /* DROPS */

        for (
            const drop of
            this.drops
        ) {

            drop.render(
                ctx
            );
        }

        /* PROJECTILES */

        for (
            const projectile of
            this.projectiles
        ) {

            projectile.render(
                ctx
            );
        }

        /* FRAGMENTS */

        for (
            const fragment of
            this.fragments
        ) {

            fragment.render(
                ctx
            );
        }

        /* BOSS */

        if (this.boss) {

            this.boss.render(
                ctx
            );
        }

        /* WITNESS */

        this.witness.render(
            ctx
        );

        /* PARTICLES */

        this.particles.render(
            ctx
        );

        /* VIGNETTE */

        const vignette =
            ctx.createRadialGradient(
                canvas.width / 2,
                canvas.height / 2,
                150,
                canvas.width / 2,
                canvas.height / 2,
                700
            );

        vignette.addColorStop(
            0,
            "rgba(0,0,0,0)"
        );

        vignette.addColorStop(
            1,
            "rgba(0,0,0,0.45)"
        );

        ctx.fillStyle =
            vignette;

        ctx.fillRect(
            0,
            0,
            canvas.width,
            canvas.height
        );

        ctx.restore();
    }

    loop(timestamp) {

        const dt =
            Math.min(
                40,
                timestamp -
                this.lastTime
            );

        this.lastTime =
            timestamp;

        if (
            this.state !==
            "PAUSED" &&
            this.state !==
            "UPGRADE"
        ) {

            if (this.hitStopFrames > 0) {

                this.hitStopFrames--;
            }

            else {

                this.update(
                    dt
                );
            }
        }

        this.render();

        requestAnimationFrame(
            this.loop.bind(this)
        );
    }
}
/* =========================================================
   INITIALIZE
========================================================= */

const game =
    new Game();

/* =========================================================
   BUTTONS
========================================================= */

startButton.addEventListener(
    "click",
    () => {

        showTutorial();
    }
);

tutorialNext.addEventListener(
    "click",
    () => {

        if (
            tutorialStep <
            tutorialPages.length - 1
        ) {

            tutorialStep++;

            updateTutorial();
        }
        else {

            finishTutorial();
        }
    }
);

tutorialBack.addEventListener(
    "click",
    () => {

        if (
            tutorialStep > 0
        ) {

            tutorialStep--;

            updateTutorial();
        }
    }
);

tutorialSkip.addEventListener(
    "click",
    () => {

        finishTutorial();
    }
);

pauseButton.addEventListener(
    "click",
    () => {

        game.pause();
    }
);

resumeButton.addEventListener(
    "click",
    () => {

        game.resume();
    }
);

pauseRestartButton.addEventListener(
    "click",
    () => {

        game.startNewRun();
    }
);

retryButton.addEventListener(
    "click",
    () => {

        game.startNewRun();
    }
);

updateInterfaceLanguage();