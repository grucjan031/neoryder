import GUI from 'lil-gui';

export const tuning = {
  horizon: {
    legacyNearM: 0.1,
    legacyFarM: 220,
    legacyRadiusM: 50,
    firstRingM: 66,
    secondRingM: 92,
    thirdRingM: 124,
    fourthRingM: 162,
    firstLandmarkM: 108,
    secondLandmarkM: 132,
    thirdLandmarkM: 118,
    trafficMinM: 74,
    trafficMaxM: 140,
    freestandingAdM: 90,
    legacyDomeM: 100,
    ringClearanceM: 20,
    domeClearanceM: 40,
    clipClearanceM: 32,
    nearRatio: 2200,
    groundOffsetM: 0.12,
    groundColor: '#151923',
    flySpeedMps: 55,
  },
  level: {
    maxAlive: 12,
    staticCellSizeM: 24,
    respawnDelayS: 1.2,
  },
  modes: {
    conquest: {
      maxAlive: 12,
      minRingSpawns: 16,
      spawnSightHeightM: 1.5,
      minPointDistanceM: 12,
      minSpawnDistanceM: 15,
      detectRangeM: 10,
      zoneHeightM: 2,
      spawnClearanceM: 0.8,
      edgeInsetM: 2,
      goalStopM: 0.5,
    },
    /** Szturm na dużej arenie (pierścień posiłków jak w Przejęciu). */
    assault: {
      minRingSpawns: 16,
      spawnSightHeightM: 1.5,
    },
    /** Kradzież rdzenia na dużej arenie; zoneHeightM dotyczy też małych pokoi (płaska podłoga, bez zmian). */
    heist: {
      minRingSpawns: 16,
      spawnSightHeightM: 1.5,
      zoneHeightM: 2,
      /** Środek kapsuły gracza nad podłogą; upuszczony rdzeń leży na poziomie podłogi areny. */
      carryFootOffsetM: 0.9,
    },
  },
  mission: {
    zoneRadiusM: 1.6,
    pickupRadiusM: 1,
    radioMinS: 3,
    mastPulseHz: 0.5,
    mastFusePulseHz: 2,
    mastEmissionMin: 1.5,
    mastEmissionMax: 4,
    radioCharsPerS: 16,
    radioPageChars: 90,
    dialoguePageChars: 150,
    dialogueCharsPerS: 60,
    dialogueAutoMinS: 2,
  },
  ui: {
    loadingTipS: 7,
    /** Splasharty bez spoilerów: zwycięstwa (meta) potrzebne do aktu 1..4 (`unlockedSplashAct`). */
    splashActVictories: [0, 1, 3, 5],
    /** Nakładka startowa czeka na odczyt meta-zapisu najwyżej tyle (ms), potem zostaje przy akcie 1. */
    splashMetaTimeoutMs: 400,
    /** Rozgrzewka renderu (kompilacja shaderów za ekranem ładowania) trwa najwyżej tyle (ms); potem gra startuje bez niej. */
    renderWarmUpTimeoutMs: 10000,
  },
  /** Ograniczenia oprawy nakładane na motyw; pixelRatio=0 zachowuje DPR urządzenia. */
  quality: {
    low: {
      pixelRatio: 0.75,
      outline: 0,
      bloom: 0,
      bloomResolution: 0.5,
      reflections: 0,
      maxLights: 2,
      rainDensity: 0.25,
      particleDensity: 0.25,
      heightFog: 0,
      shadows: 0,
    },
    medium: {
      pixelRatio: 1,
      outline: 1,
      bloom: 1,
      bloomResolution: 0.5,
      reflections: 0,
      maxLights: 4,
      rainDensity: 0.5,
      particleDensity: 0.5,
      heightFog: 1,
      shadows: 0,
    },
    high: {
      pixelRatio: 0,
      outline: 1,
      bloom: 1,
      bloomResolution: 1,
      reflections: 1,
      maxLights: 8,
      rainDensity: 1,
      particleDensity: 1,
      heightFog: 1,
      shadows: 0,
    },
  },
  /** Oprawa miasta: wyłącznie render, metry i sekundy. Limity pul ustalane przy tworzeniu. */
  weather: {
    flakeNearM: 1.5,
    flakeSoftEdge: 0.24,
    ashEdgeRoughness: 0.16,
    ashEdgeFrequency: 11,
    snowPatchFrequency: 0.55,
    snowWearFrequency: 1.8,
    snowWearStretch: 0.28,
    snowMaskLow: 0.32,
    snowMaskHigh: 0.62,
    dustMax: 240,
    /** Próby losowania kropli przecinającej podłogę na jeden rozbryzg (ruch kropli liczy shader). */
    splashProbes: 256,
    wetRoughnessScale: 0.45,
    skyFlashColor: '#9eadef',
  },
  city: {
    /**
     * Panorama i niebo motywów z `panoramaEnabled` (tylko tło, bez świateł punktowych).
     * Ruch pojazdów 0..1, jasność okien wieżowców i świateł ostrzegawczych, kolor ścian.
     */
    panoramaTraffic: 0.6,
    panoramaWindowEmission: 0.5,
    panoramaBeaconBrightness: 1,
    panoramaWall: '#1e2638',
    /** Łuna miasta przy horyzoncie i chmury podświetlone od dołu (addytywnie do gradientu nieba). */
    skyGlowStrength: 1,
    skyCloudStrength: 1,
    skyCloudSpeed: 0.004,
    maxLights: 8,
    lightFadeRate: 6,
    lightSwitchThreshold: 0.01,
    lightSpotOpacity: 0.12,
    lightSpotScale: 0.6,
    /** Mnożnik intensywności świateł punktowych i wykładnik ich spadku (mniejszy = łagodniejszy). */
    lightIntensityScale: 2.5,
    lightDecay: 1.8,
    /** Wybór świateł do puli: ważność jasnych źródeł (0..1) i premia histerezy dla przydzielonych. */
    lightImportance: 0.6,
    lightKeepBonus: 0.5,
    /** Profil plamy pod światłem: wyższy wykładnik = węższa, miększa poświata. */
    lightSpotPower: 2,
    /** Poświata neonów i hologramów na ścianie: siła, rozmiar względem napisu, mnożnik dla hologramów, profil. */
    signGlowOpacity: 0.45,
    signGlowScale: 1.6,
    signGlowMaxScale: 1.6,
    /** Pas UV, w którym poświata wygasa do zera przy każdej krawędzi quada. */
    signGlowEdgeFade: 0.2,
    /** Kolejność przezroczystych efektów po geometrii nieprzezroczystej. */
    glowRenderOrder: 1,
    signGlowHoloFactor: 0.5,
    signGlowPower: 2.2,
    /** Odległość (m) do światła, którego kolor przejmuje poświata napisu bez własnego tintu. */
    signGlowLightRangeM: 3,
    /** Latarnie (model city_street_lamp): punkt lampy w układzie modelu [m], stożek (kąt połowy, siła, profil), światło dynamiczne i plama. */
    lampHeadHeightM: 4.31,
    lampHeadForwardM: 0.34,
    lampConeAngleDeg: 32,
    lampConeOpacity: 0.2,
    lampConePower: 1.6,
    lampConeEdgePower: 1.4,
    lampLightIntensity: 4,
    lampLightRange: 7,
    lampColor: '#fff1d6',
    /** Okna fasad (atlasy windows_lit/dark): udział oświetlonych, rozstaw (m), zakres wymiarów okna (m), emisja oświetlonych i ciemnych, siła w bloomie. */
    windowLitFraction: 0.4,
    windowPitchXM: 2.4,
    windowPitchYM: 3.2,
    windowMinWidthM: 1.2,
    windowMaxWidthM: 1.6,
    windowMinHeightM: 1.6,
    windowMaxHeightM: 2.2,
    windowLitEmission: 0.5,
    windowDarkEmission: 0.02,
    windowBloom: 0.35,
    surfaceOffsetM: 0.012,
    signBrightness: 3.2,
    signFrameM: 0.09,
    /** Wspólne wzory migotania lamp i neonów (czas renderu). */
    flickerStrength: 0.8,
    flickerBuzzPeriodS: 1 / 37,
    flickerBuzzDepth: 0.12,
    flickerPulsePeriodS: 4,
    flickerFailPeriodS: 8,
    flickerFailJitter: 0.25,
    flickerFailMinDips: 2,
    flickerFailMaxDips: 5,
    flickerFailDipS: 0.055,
    flickerFailGapS: 0.065,
    flickerFailDarkChance: 0.3,
    flickerFailDarkS: 0.3,
    signBuzzHz: 37,
    signBuzzAmount: 0.08,
    signOutageRate: 1.4,
    signOutageS: 0.09,
    signOutageBrightness: 0.04,
    signPartialRate: 0.7,
    signPartialS: 0.18,
    holoScanLines: 110,
    holoScanHz: 2,
    holoGlitchIntervalS: 3.7,
    holoGlitchS: 0.16,
    holoGlitchUv: 0.035,
    holoOpacity: 0.72,
    holoProjectorOpacity: 0.06,
    rainMax: 4000,
    rainWidthM: 28,
    rainHeightM: 14,
    rainDepthM: 28,
    rainSpeed: 18,
    rainDensity: 0.7,
    rainWindX: -2.2,
    rainColor: '#a6a4c4',
    rainOpacity: 0.26,
    rainStreakWidthM: 0.013,
    rainExposureS: 0.025,
    rainSplashMax: 300,
    rainSplashLifeS: 0.28,
    rainSplashRadiusM: 0.22,
    rainSplashRate: 100,
    rainSplashRiseMS: 1.5,
    rainSplashDriftMS: 1,
    splashGrowth: 2,
    /** Średnio jeden błysk na ok. 40 s (1/0.025). */
    stormRate: 0.025,
    stormFlashS: 0.35,
    /** Siła rozbłysku nieba i mgły przy błysku burzy (0..1). */
    stormFlash: 0.35,
    steamMax: 100,
    sparkMax: 180,
    dripMax: 100,
    dripSplashMax: 80,
    steamRate: 5,
    steamLifeS: 3.8,
    steamRiseMS: 0.65,
    steamSizeM: 0.55,
    steamSpreadM: 0.2,
    steamDriftMS: 0.15,
    steamGrowth: 2.8,
    steamOpacity: 0.17,
    steamColor: '#8b91ae',
    sparkBurstRate: 0.45,
    sparkBurstCount: 12,
    sparkSpeedMS: 3.5,
    sparkLifeS: 1.1,
    sparkGravity: -9,
    sparkBounce: 0.35,
    sparkSizeM: 0.035,
    dripRate: 2,
    dripSpeedMS: 3,
    dripLifeS: 8,
    dripSizeM: 0.025,
  },
  hands: {
    swapS: 0.24,
    swapBufferS: 0.4,
    /** Render dłoni: metry, radiany i sekundy czasu klatki; bez wpływu na symulację. */
    swapDropM: 0.8,
    swapAngle: -0.8,
    castS: 0.35,
    castOutFraction: 0.22,
    castGlow: 3,
    swayAmount: 0.35,
    swayMax: 0.055,
    swayReturn: 90,
    bobAmount: 0.008,
    bobFrequency: 1.8,
    bobSpeed: 7,
    bobReturn: 10,
  },
  time: {
    hitstopLightMs: 40,
    hitstopHeavyMs: 80,
    lastKillSlowmoS: 0.3,
    lastKillTimeScale: 0.2,
    /** Płynny powrót do normalnej prędkości po spowolnieniu (s, czas rzeczywisty). */
    slowmoRecoverS: 0.15,
  },
  /** Kamera FPP (#03). Wstrząs: trauma 0..1, amplituda = trauma² × shakeMax. Czasy w s. */
  camera: {
    fov: 90,
    shakeMax: 0.4,
    shakeMaxAngleDeg: 5,
    shakeMaxOffset: 0.06,
    shakeFrequency: 22,
    shakeDamageRef: 40,
    shakeOnHitScale: 0.3,
    sprintFovKick: 6,
    dashFovKick: 12,
    fovLerpRate: 9,
    bobEnabled: 1,
    bobAmount: 0.03,
    bobStride: 2.4,
    landingDipPerSpeed: 0.012,
    landingDipMax: 0.16,
    landingRecoverRate: 9,
    eyeLerpRate: 16,
  },
  render: {
    concrete: '#ffffff',
    asphalt: '#ffffff',
    metal: '#ffffff',
    facade: '#ffffff',
    trim: '#ffffff',
    glass: '#ffffff',
    cable: '#080808',
    paint: '#ffffff',
    lacquer: '#ffffff',
    rust: '#ffffff',
    corrugated: '#ffffff',
    plastic: '#ffffff',
    hivis: '#ffffff',
    rubber: '#080808',
    wood: '#ffffff',
    fabric: '#ffffff',
    machine: '#ffffff',
    paving: '#ffffff',
    plaster: '#ffffff',
    hazard: '#ffffff',
    neon_amber: '#ffae1a',
    neon_green: '#6dff4a',
    neon_violet: '#8a5cff',
    neon_blue: '#3d7bff',
    neon_white: '#fff1d6',
    light_white: '#fff1d6',
    hemiSky: '#ffffff',
    hemiGround: '#ffffff',
    keyColor: '#ffffff',
    citySurfaceDetail: 0,
    /** Relief z jasności tekstur miejskich (0 = płasko) i okres pasów ostrzegawczych [m]. */
    cityBumpStrength: 0,
    cityHazardPeriod: 0.3,
    enemyRimStrength: 0,
    enemyRimPower: 2.5,
    reflectionStrength: 0,
    reflectionDistortion: 0.008,
    reflectionPuddles: 1,
    reflectionFloorTolerance: 0.08,
    skyFlash: 0,
    heightFogDensity: 0,
    heightFogFalloff: 0.6,
    panoramaEnabled: 0,
    panoramaDensity: 0.65,
    panoramaHeight: 32,
    panoramaWindowWarm: '#fff1d6',
    panoramaWindowCool: '#3d7bff',
    world: '#ffffff',
    enemy: '#e0262b',
    enemyGlow: '#ff5050',
    interactive: '#080808',
    player: '#00e5ff',
    power: '#ff2bd6',
    outline: 1,
    outlineThickness: 1,
    outlineDepthThreshold: 0.025,
    outlineNormalThreshold: 0.2,
    outlineColor: '#30343b',
    /**
     * Kontur z odległością (m od kamery): od outlineFadeNear do outlineFadeFar linie wewnątrz
     * bryły (krawędzie normalnych) słabną do outlineFarNormal (0 = znikają, 1 = bez zmian),
     * a obrys sylwetki (krawędź głębi) w ułamku outlineFarOuter rysuje się tylko po stronie tła.
     * Dzięki temu dalecy wrogowie zostają czerwonymi bryłami z cienkim obrysem.
     */
    outlineFadeNear: 6,
    outlineFadeFar: 16,
    outlineFarNormal: 0,
    outlineFarOuter: 1,
    /**
     * Styl komiksowy (próbki kierunku „Borderlands”, 0 = wyłączone, wygląd bez zmian):
     * inkNearScale ogranicza perspektywiczne pogrubienie konturu blisko kamery,
     * celBands > 0 dzieli jasność na pasma (celStrength = siła), hatchStrength przyciemnia
     * kreskowaniem w cieniach (poniżej hatchThreshold, odstęp linii hatchSpacing px),
     * paintStrength dokłada plamistą fakturę farby. Mocno nasycone piksele (wrogowie, neony,
     * efekty) są pomijane przez cel/kreski: czytelność walki ponad styl.
     */
    inkNearScale: 1,
    /** Promień dylatacji w px przy inkRefDistanceM (0 = zwykły kontur). */
    inkWidth: 0,
    inkRefDistanceM: 4,
    inkMinScale: 0.25,
    /** Poniżej tego promienia zostaje tylko maska 1 px. */
    inkDilationMinPx: 0.5,
    inkFadeNearM: 45,
    inkFadeFarM: 80,
    /** Detale normalnych: cieńsze i wygaszane wcześniej niż sylwetka. */
    inkNormalScale: 0.55,
    inkNormalFadeNearM: 8,
    inkNormalFadeFarM: 24,
    /** Dotychczasowy tusz FPP, niezależny od perspektywicznego tuszu świata. */
    inkViewmodelWidth: 2.2,
    inkViewmodelMaxRadiusPx: 1.2,
    celBands: 0,
    celStrength: 0,
    hatchStrength: 0,
    hatchThreshold: 0.22,
    hatchSpacing: 5,
    paintStrength: 0,
    hemiIntensity: 0.6,
    keyIntensity: 2.4,
    /** Przełączniki jakości: 0 pomija pass (słaby sprzęt). */
    bloom: 1,
    postFx: 1,
    /** Bloom selektywny: tylko materiały emisyjne (neony). Promień mnoży odstęp próbek rozmycia. */
    bloomStrength: 0.6,
    bloomRadius: 1.2,
    /** Tło i mgła (liczone w kompozycji). skyGradient/fogStrength = 0 wyłączają efekt. */
    skyGradient: 1,
    skyTop: '#ffffff',
    skyHorizon: '#e3e7ea',
    skyGradientHeight: 0.5,
    fogStrength: 0.85,
    fogColor: '#eef1f3',
    fogNear: 14,
    fogFar: 80,
    /** Ułamek zakresu głębi zarezerwowany dla rąk i przedmiotu (zawsze przed światem). */
    viewmodelDepth: 0.01,
    /** Siatka płytek podłogi w shaderze materiału świata (m, kontrast 0..1, grubość w px). */
    gridSize: 2,
    gridContrast: 0.1,
    gridLineWidth: 1,
    /** Kompozycja końcowa (postFx). Czasy w s czasu rzeczywistego. */
    vignetteStrength: 0.2,
    vignetteRadius: 0.55,
    vignetteSoftness: 0.6,
    damagePulseS: 0.4,
    damagePulseMin: 0.35,
    damagePulseHpGain: 2,
    damageAberration: 0.018,
    damageTint: 0.5,
    damageTintColor: '#ff1a2a',
    focusTint: 0.14,
    focusTintColor: '#ff2bd6',
    focusDesaturate: 0.3,
    focusFadeInS: 0.15,
    focusFadeOutS: 0.35,
  },
  /** Kontroler FPP (#02). Prędkości m/s, przyspieszenia m/s², czasy ms. */
  player: {
    staminaRegenDelayS: 0.8,
    sprintStaminaPerS: 20,
    dashStaminaCost: 30,
    doubleJumpStaminaCost: 25,
    sprintMinStamina: 15,
    /** Pomija mikrokorekty kontaktu Rapiera przy rozliczaniu sprintu (metry/krok). */
    sprintMovementEpsilonM: 0.001,
    walkSpeed: 7,
    sprintSpeed: 11,
    groundAccel: 90,
    airAccel: 30,
    groundFriction: 12,
    jumpVelocity: 8,
    doubleJumpVelocity: 7.5,
    coyoteTimeMs: 100,
    jumpBufferMs: 120,
    capsuleHeight: 1.8,
    capsuleRadius: 0.35,
    eyeHeight: 1.65,
    stepHeight: 0.35,
    maxSlopeDeg: 45,
    lookSensitivity: 0.0022,
    maxPitchDeg: 89,
    controllerOffset: 0.02,
    stepMinWidth: 0.2,
    snapToGroundDistance: 0.3,
    groundStickSpeed: 2,
    /** Dash (#04): dystans w m w czasie dashDurationS, odnowienie przez stat dashCooldown. */
    dashDistance: 6,
    dashDurationS: 0.18,
    dashCooldownS: 1.2,
    dashExitSpeed: 9,
    dashInvulnerable: 0,
    /** Slide (#04): crouch przy prędkości ≥ slideMinSpeed na ziemi. */
    slideMinSpeed: 9,
    slideBoost: 2.5,
    slideMaxSpeed: 15,
    slideFriction: 1.4,
    slideSteer: 6,
    slideEndSpeed: 4,
    slideMaxS: 1.1,
    slideCapsuleHeight: 1.0,
    crouchSpeed: 3.5,
    /**
     * Celowanie (ADS, PPM z bronią palną): czas wejścia i wyjścia (s), FOV jako ułamek bazowego
     * (90° → ~65°; broń może mieć własne `aimFovScale`), mnożniki czułości myszy, prędkości ruchu,
     * rozrzutu i odrzutu broni w widoku. Sprint w celowaniu niedostępny.
     */
    aim: {
      inS: 0.18,
      outS: 0.15,
      fovScale: 0.72,
      sensitivity: 0.7,
      moveSpeed: 0.6,
      spread: 0.4,
      recoil: 0.7,
    },
  },
  /** Ostrze plazmowe (#07). Fazy ciosu w s; obrażenia i zasięg w src/data/blades/plasmaBlade.json. */
  melee: {
    executeHpFrac: 0.25,
    executeHpFracElite: 0.15,
    executeRangeM: 2.8,
    executeArcDeg: 50,
    executeKnockback: 10,
    executeEnergy: 20,
    executeHeal: 6,
    executeHitstopMs: 110,
    executeSlowmoScale: 0.35,
    executeSlowmoS: 0.3,
    executeShake: 0.6,
    executeInvulnS: 0.4,
    executeMarkerPulseHz: 3,
    attackSpeedMin: 0.5,
    attackSpeedMax: 2,
    lightWindupS: 0.05,
    lightActiveS: 0.1,
    lightRecoveryS: 0.16,
    comboWindowS: 0.3,
    attackBufferMs: 120,
    heavyHoldS: 0.22,
    heavyChargeS: 0.6,
    heavyWindupS: 0.04,
    heavyActiveS: 0.12,
    heavyRecoveryS: 0.38,
    guardBreakLockS: 0.8,
    /** Wstrząs kamery przy rozbiciu gardy: siła i czas [s]. */
    guardBreakShake: 0.5,
    guardBreakShakeS: 0.3,
    dashCutGraceS: 0.1,
    dashCutHeightM: 1.2,
    throwSpinRadS: 28,
    throwLengthM: 1.1,
    throwThicknessM: 0.04,
    /** Parowanie (#10): blok rozpoczęty najwyżej tyle ms przed trafieniem pocisku odbija go. */
    parryWindowMs: 150,
    parryArcDeg: 160,
    parryHitstopMs: 60,
    parryShake: 0.3,
    parryShakeS: 0.2,
    /** Parowanie ciosów wręcz: blok rozpoczęty najwyżej tyle ms przed trafieniem neguje cios (nie dotyczy #heavy). */
    meleeParryWindowMs: 200,
    /** Ogłuszenie i odrzut wroga, którego cios został sparowany. */
    meleeParryStunS: 0.9,
    meleeParryKnockback: 4,
    /** Iskra parowania wręcz: odległość od oczu w stronę atakującego i przesunięcie w pionie względem oczu [m] (ujemne = niżej). */
    meleeParrySparkM: 0.8,
    meleeParrySparkOffsetYM: -0.35,
    parrySpeedMult: 1.8,
    parryDamageMult: 2,
  },
  /** Rezonans i energia (#11). Dane mocy w src/data/powers/*.json. */
  powers: {
    grabClearanceM: 0.02,
    energyRegenDelayS: 2,
    meleeKillEnergy: 15,
    parryEnergy: 10,
    energyEventIntervalS: 0.1,
    pushHitstopMs: 40,
    pushShake: 0.35,
    barrierFlashS: 0.12,
  },
  /** Arena z falami (#16). Skład fal w src/data/waves/arena.json. */
  arena: {
    maxEnemies: 30,
    /**
     * Statyka i instancje areny dzielone są przestrzennie dopiero, gdy suma trójkątów jednego materiału/modelu
     * przekracza ten budżet na wywołanie rysowania (0 = stała siatka batchCellM). Mniejsza wartość to lepszy
     * culling, większa to mniej wywołań rysowania.
     */
    batchTriangleBudget: 60000,
    /**
     * Grupa instancji modelu (jeden węzeł × materiał) o łącznej liczbie trójkątów nie większej niż ta wartość
     * jest scalana ze statyką zamiast rysowana jako InstancedMesh (mniej wywołań kosztem kopii wierzchołków).
     */
    instanceMergeTriangles: 30000,
    /** Promień (komórki siatki), w którym nawigacja szuka najbliższej przejezdnej komórki dla startu/celu poza siatką. */
    navFallbackCells: 2,
  },
  /** Dźwięki (#14). Przepisy i reguły w src/data/audio/sfx.json. */
  audio: {
    maxVoices: 24,
    /** Zaległość harmonogramu muzyki (s) powyżej której kroki są pomijane zamiast nadrabiane (np. po powrocie z ukrytej karty). */
    musicMaxCatchUpS: 0.5,
    masterGain: 0.7,
    refDistance: 4,
    maxPan: 0.8,
    ambienceMaxActive: 8,
    ambienceGain: 0.32,
    /** Poziom muzyki względem efektów (S7-02); mnoży masterGain × masterVolume × musicVolume. */
    musicGain: 0.35,
    ambienceScreenClusterM: 4,
    ambienceLoopS: 12,
    ambienceLfoHz: 0.18,
    ambienceLfoDepth: 0.25,
    ambienceLfoRateMin: 0.7,
    ambienceLfoRateMax: 1.3,
    ambienceFilterQ: 0.7,
    ambiencePulseDecay: 6,
    ambienceNoiseFloorGain: 0.16,
    ambienceFireBodyHz: 250,
    ambienceFireBodyGain: 0.45,
    ambienceFireNoiseFloorGain: 0.02,
    ambienceFireCrackleRate: 9,
    ambienceFireCrackleS: 0.018,
    ambienceFireCrackleGain: 0.8,
    ambienceDripMinS: 0.7,
    ambienceDripMaxS: 2.8,
    ambienceDripHz: 1600,
    ambienceDripDecayS: 0.045,
    ambienceRadioToneHz: 720,
    ambienceRadioToneRate: 1.3,
    ambienceRadioToneS: 0.16,
    ambienceRadioToneGain: 0.18,
    ambienceJukeboxBpm: 90,
    ambienceJukeboxPhrases: {
      rain: {
        bpm: 76,
        roots: [0, -4, -7, -2],
        chordSemitones: [12, 15, 19, 26],
      },
      dawn: {
        bpm: 104,
        roots: [-2, -7, 0, -5],
        chordSemitones: [12, 17, 19, 22],
      },
    },
    ambienceJukeboxBars: 8,
    ambienceJukeboxBeatsPerBar: 4,
    ambienceJukeboxRootHz: 55,
    ambienceJukeboxPadGain: 0.12,
    ambienceJukeboxBassGain: 0.5,
    ambienceJukeboxBassDecay: 5,
    ambienceJukeboxRoots: [0, 0, -5, -5, -2, -2, -7, -7],
    ambienceJukeboxChordSemitones: [12, 15, 19, 22],
    ambiencePurrPulseHz: 25,
    ambiencePurrDepth: 0.85,
    ambienceProfiles: {
      rain: { radiusM: 100, gain: 0.6, filterHz: 2400, toneHz: 0 },
      wind: { radiusM: 100, gain: 0.45, filterHz: 380, toneHz: 0 },
      purr: { radiusM: 3, gain: 0.2, filterHz: 160, toneHz: 0 },
      fire: { radiusM: 10, gain: 0.65, filterHz: 550, toneHz: 0 },
      generator: { radiusM: 13, gain: 0.32, filterHz: 190, toneHz: 52 },
      drip: { radiusM: 9, gain: 0.8, filterHz: 3000, toneHz: 0 },
      steam: { radiusM: 9, gain: 0.22, filterHz: 1600, toneHz: 0 },
      screens: { radiusM: 7, gain: 0.1, filterHz: 550, toneHz: 110 },
      crowd: { radiusM: 24, gain: 0.7, filterHz: 550, toneHz: 0 },
      radio: { radiusM: 8, gain: 0.3, filterHz: 1100, toneHz: 0 },
      jukebox: { radiusM: 13, gain: 0.32, filterHz: 1700, toneHz: 0 },
      cooking: { radiusM: 9, gain: 0.25, filterHz: 2400, toneHz: 0 },
    },
    ambienceCrowdBands: {
      lowHz: 350,
      midHz: 850,
      highHz: 1700,
      q: 2,
      gain: 0.45,
    },
  },
  physics: { gravity: -20, maxDynamicBodies: 300 },
  damage: { playerInvulnMs: 250, respawnS: 1.5 },
  hazards: {
    electricTickS: 0.5,
    electricDamage: 8,
    electricOverloadS: 2,
    warnS: 0.6,
    barrelHealth: 20,
    barrelRadiusM: 4.5,
    barrelDamage: 60,
    barrelMinDamageFrac: 0.3,
    barrelKnockback: 12,
    barrelChainDelayS: 0.15,
    laserDamage: 25,
    laserInvulnS: 0.6,
    laserRadiusM: 0.15,
  },
  weapons: {
    overheatLockS: 1.5,
    activeCooling: {
      windowStartS: 0.5,
      windowDurationS: 0.3,
      bonusS: 0.55,
      penaltyS: 0.35,
    },
    coolDelayS: 0.25,
    /** Bufor spustu broni półautomatycznej: klik w ostatnich s odnowienia strzela po jego końcu. */
    triggerBufferS: 0.15,
    maxProjectiles: 256,
    /** Błysk wylotu w widoku FPP (render, czas rzeczywisty): czas trwania w s i promień w m. */
    muzzleFlashS: 0.06,
    muzzleFlashSize: 0.14,
  },
  enemies: {
    flankMinDeg: 60,
    flankMaxDeg: 120,
    flankArcStepDeg: 15,
    flankTimeoutS: 3,
    tacticRetryS: 1.5,
    tacticArrivalM: 0.25,
    coverRadiusM: 6,
    coverSamples: 16,
    coverHoldS: 1.2,
    /** Odstęp sprawdzania widoczności z osłony (raycast z cache). */
    coverCheckS: 0.25,
    coverTravelS: 3,
    coverGroundProbeM: 2,
    coverLowHp: 0.35,
    groupWindowS: 0.35,
    groupMinAngleDeg: 60,
    blockPressureS: 1.2,
    evadeS: 0.35,
    evadeRangeM: 5,
    dashThreatRangeM: 10,
    threatFacingDot: 0.5,
    /** Odstęp tarczy od hełmu podczas animacji UAL (metry). */
    shieldHeadClearanceM: 0.03,
    animationFadeS: 0.12,
    animationActionFadeS: 0.04,
    phaseShiftS: 1,
    /** Złamanie tarczy bossa: hitstop (ms) i wstrząs kamery (siła, czas w s). */
    shieldBreakHitstopMs: 80,
    shieldBreakShake: 0.5,
    shieldBreakShakeS: 0.3,
    stunKnockback: 6,
    corpseS: 0.5,
    separationRadius: 1,
    wallProbe: 1.5,
    /** Autostep kapsuły wroga (m): schody aren, które nawigacja uznaje za chodzone (≤ 0,35 m). */
    stepHeight: 0.35,
    stepMinWidth: 0.2,
    /** Przyciąganie do podłoża przy schodzeniu (m); 0 = wyłączone (snap gubił trasę przy barierze wykopu Budowy). */
    snapToGroundDistance: 0,
  },
  vfx: {
    /**
     * Czytelność wrogów z daleka (render/enemyRim.ts): jasność kombinezonu `mat_enemy_dark`
     * względem czerwieni wroga; poświata krawędzi rośnie od enemyRimNearM do enemyRimFarM [m]
     * (mnożnik siły motywu, szerszy wykładnik, płaskie wypełnienie bryły czerwienią) i jest
     * kompensowana o mgłę kompozycji (0 = bez kompensacji, 1 = pełna).
     */
    enemyDarkShade: 0.3,
    enemyRimNearM: 4,
    enemyRimFarM: 20,
    enemyRimFarGain: 2.5,
    enemyRimFarPower: 1.3,
    enemyRimFarFill: 0.2,
    enemyRimFogCompensation: 1,
    heavyTelegraphColor: '#ffd27a',
    heavyTelegraphEndColor: '#fff4dc',
    heavyTelegraphEndFraction: 0.3,
    heavyTelegraphPulseMultiplier: 2,
    threatRadiusM: 22,
    threatHalfAngleDeg: 40,
    threatMaxIndicators: 4,
    barrierRadiusM: 1.25,
    barrierHeightM: 1.1,
    barrierDistanceM: 0.9,
    barrierSegments: 32,
    barrierOpacity: 0.12,
    barrierFlashOpacity: 0.55,
    /** Siatka heksów Rezonansu na Barierze: kolor, krycie, gęstość (komórki na metr). */
    barrierLatticeColor: '#ff2bd6',
    barrierLatticeOpacity: 0.75,
    barrierLatticeCells: 7,
    grabBeamColor: '#00e5ff',
    grabBeamOpacity: 0.85,
    grabHandSideM: 0.25,
    grabHandDownM: 0.2,
    grabHandForwardM: 0.35,
    /** Poświata Chwytu (magenta Rezonansu wokół cyan rdzenia): kolor, promień rurki (m), krycie, kula przy celu (m). */
    grabGlowColor: '#ff2bd6',
    grabGlowRadiusM: 0.055,
    grabGlowOpacity: 1.1,
    grabOrbM: 0.2,
    beamRadiusM: 0.018,
    /**
     * Klinga ostrza FPP (render/fppBladeFx.ts), komiksowa plazma: płaskie strefy w poprzek poświaty
     * (granice jako ułamek półszerokości quada poświaty: biały rdzeń, jasny cyjan, ciemniejsza otoczka
     * i jej krycie)
     * oraz płaskie pasma energii płynące od emitera do czubka (liczba na klingę, ułamek okresu,
     * poszerzenie rdzenia w paśmie, prędkość w pasmach/s; spokojna prędkość przy wyłączonych
     * „Błyskach ekranu”, mnożnik prędkości w trakcie cięcia).
     */
    bladeCoreFrac: 0.07,
    bladeInnerFrac: 0.3,
    bladeOuterFrac: 0.44,
    bladeOuterOpacity: 0.85,
    bladeBands: 4,
    bladeBandWidth: 0.35,
    bladeBandSwell: 0.02,
    bladeBandSpeed: 1.4,
    bladeBandSpeedCalm: 0.15,
    bladeBandSlashBoost: 2.5,
    /**
     * Błyskawica (render): szerokość wstęgi rdzenia i poświaty (m), krycie poświaty, kolor rdzenia,
     * ułamek życia łuku na uderzenie, migotanie (Hz, głębokość 0..1), odnogi (szansa na wierzchołek,
     * długość w m), rozmiar błysku trafienia (m), limit łuków, punkt dłoni względem kamery (m)
     * oraz zwężanie bliżej niż lightningNearTaperM od kamery (do ułamka lightningNearMinScale).
     */
    lightningCoreWidthM: 0.035,
    lightningGlowWidthM: 0.16,
    lightningGlowOpacity: 0.55,
    lightningCoreColor: '#ffe3ff',
    lightningStrikeFrac: 0.3,
    lightningFlickerHz: 30,
    lightningFlickerAmount: 0.35,
    lightningBranchChance: 0.3,
    lightningBranchLengthM: 0.6,
    lightningImpactSizeM: 0.35,
    lightningMaxArcs: 8,
    lightningHandSideM: -0.22,
    lightningHandDownM: 0.2,
    lightningHandForwardM: 0.4,
    lightningNearTaperM: 2,
    lightningNearMinScale: 0.2,
    explosionDurationS: 0.3,
    explosionOpacity: 0.4,
    explosionFlashS: 0.1,
    explosionFlashRadiusScale: 0.22,
    explosionFlashBrightness: 2.5,
    explosionFireOpacity: 0.8,
    explosionFireStartRadiusScale: 0.15,
    explosionRingS: 0.28,
    explosionRingRadiusScale: 1.2,
    explosionRingInnerFrac: 0.9,
    explosionRingOpacity: 0.65,
    explosionRingFloorOffsetM: 0.025,
    explosionSparkCount: 32,
    explosionShakeIntensity: 0.7,
    explosionShakeS: 0.22,
    explosionShakeRadiusScale: 2,
    explosionHitstopMs: 45,
    maxExplosions: 16,
    maxDebris: 600,
    debrisMin: 12,
    debrisMax: 30,
    debrisPerDamage: 0.25,
    debrisStrength: 6,
    debrisLifetimeS: 2.2,
    debrisGravity: -18,
    debrisSize: 0.18,
    /** Odłamki drona: mniejsze i rozpryśnięte ze środka bryły (mnożniki względem humanoida). */
    droneDebrisCountMult: 0.5,
    droneDebrisSizeMult: 0.55,
    droneDebrisSpreadMult: 1.4,
    /** Efekty statusów na wrogach (pule instancji i parametry). */
    maxStatusFlames: 160,
    maxStatusSparks: 96,
    maxStatusStars: 40,
    statusFlameRate: 26,
    statusFlameLifeS: 0.7,
    statusFlameRiseMS: 1.4,
    statusFlameSizeM: 0.14,
    statusSparkRate: 18,
    statusSparkLifeS: 0.18,
    statusSparkLengthM: 0.45,
    statusSparkWidthM: 0.04,
    statusStarCount: 5,
    statusStarRadiusM: 0.32,
    statusStarSpinRadS: 4,
    statusStarSizeM: 0.1,
    /** Iskry trafień: cyan od gracza, czerwone od wrogów. */
    maxHitSparks: 128,
    hitSparkCount: 6,
    /** Iskry sparowanego ciosu wręcz (vfx/hitSparks.ts, zdarzenie melee_parried). */
    parrySparkCount: 18,
    hitSparkSpeedMS: 7,
    hitSparkSpreadMS: 3.5,
    hitSparkLifeS: 0.28,
    hitSparkLengthM: 0.24,
    hitSparkWidthM: 0.025,
    hitSparkGravity: -12,
    /** Iskry trafienia gracza bliżej kamery niż tyle metrów nie są rysowane. */
    hitSparkCameraMinM: 0.6,
    /**
     * Błyski walki (kosmetyka, DebrisRenderer): błysk sylwetki trafionego wroga i rozbłysk
     * zabicia (czas w s), czas stygnięcia żaru krawędzi cięcia odłamków (s, stała zaniku),
     * jasność żaru, rozmiar iskry trafienia (m) i zasięg pierścienia rozpadu (m).
     */
    hitFlashS: 0.13,
    hitFlashBrightness: 1.4,
    hitFlashStarSizeM: 0.55,
    /** Gwiazda trafienia bliżej kamery niż tyle metrów nie jest rysowana (zasłaniałaby ekran). */
    hitFlashCameraMinM: 1,
    killFlashS: 0.34,
    killFlashCoreM: 0.55,
    killFlashRingM: 1.7,
    debrisEdgeCoolS: 0.35,
    debrisEdgeBrightness: 1.6,
    /** Fala Pchnięcia (czasza w kierunku celowania) i Fali uderzeniowej (pierścień przy podłodze), s / m pod okiem. */
    resonanceWaveS: 0.34,
    resonanceRingS: 0.42,
    resonanceRingDropM: 1.45,
    /** Prezentacja bossa (kosmetyka). Zapowiedź: czas (s), jasność areny na starcie, chwila „przebudzenia” (s). */
    bossIntroS: 1.7,
    bossIntroDim: 0.3,
    bossWakeAtS: 0.55,
    /** Fala po podłodze (przebudzenie, zmiana fazy, rozpad): zasięg (m) i czas (s). */
    bossWaveRadiusM: 16,
    bossWaveS: 0.9,
    /**
     * Zabarwienie dolnej barwy światła półsferycznego (odbicie od podłogi) w ostatniej fazie (0–1);
     * niebo i światło kluczowe bez zmian, bo czerwone otoczenie myliłoby się z wrogami (ADR 0006).
     * Dalej: błysk przy zmianie fazy (mnożnik).
     */
    bossPhaseTint: 0.2,
    bossPhaseFlash: 1.7,
    bossPhaseShake: 0.35,
    bossPhaseShakeS: 0.35,
    /** Poświata pod bossem i powłoka nietykalności (m). */
    bossGlowRadiusM: 3.4,
    bossAuraRadiusM: 1.25,
    /** Telegraf wachlarza: długość promieni na podłodze (m). */
    bossFanLengthM: 14,
    /** Rozpad: czas efektu (s), wstrząs, spowolnienie i cisza przed podsumowaniem (s symulacji). */
    bossDeathFxS: 1.7,
    bossDeathShake: 0.7,
    bossDeathShakeS: 0.5,
    bossDeathSlowmo: 0.3,
    bossDeathSlowmoS: 0.6,
    /** Cisza po zwycięstwie przed podsumowaniem (s symulacji); 0 = od razu. W fx=lite pomijana. */
    bossVictoryHoldS: 1.8,
    /**
     * Barwy oprawy bossa (ADR 0006: czerwień = wróg). Szkarłat przesunięty ku pomarańczy i ciepła
     * biel gorących krawędzi (nie bursztyn: ten należy do neonów otoczenia); daleko od magenty
     * Rezonansu (#ff2bd6) i cyanu gracza. `bossShadeColor`
     * mnoży podłogę pod polem rażenia (tłumi fiolet ulicy, żeby czerwień nie różowiała).
     */
    bossColor: '#ff4a1c',
    bossHotColor: '#ffd2c4',
    bossShadeColor: '#ff4a00',
    /**
     * Krawędź pierścieni fal (zmiana fazy, rozpad): nasycony pomarańcz zamiast bladej `bossHotColor`,
     * bo dodana do fioletowej podłogi blada barwa dawała róż zbliżony do magenty Rezonansu.
     */
    bossWaveEdgeColor: '#ff8a3c',
    /**
     * Telegraf z bliska: od `NearM` do `FarM` (m od kamery) wypełnienie gaśnie do `NearFill`,
     * a krawędzie do `NearEdge`, więc pole pod nogami gracza nie zalewa ekranu.
     */
    bossTelegraphNearM: 1.8,
    bossTelegraphFarM: 6.5,
    bossTelegraphNearFill: 0.2,
    bossTelegraphNearEdge: 0.55,
    /** Przy wyłączonych błyskach (ustawienia): rozbłysk wizjera tylko w tej części, bez błysku świateł. */
    bossNoFlashFlare: 0.3,
    /** Szczegóły oprawy bossa (BossArenaFx): promienie pól, fale, słupy światła, iskry rozpadu. */
    /**
     * Przewrócenie wroga humanoidalnego przy mocnym odrzucie (proceduralnie na korzeniu modelu):
     * upadek na plecy (`fallS`), leżenie (reszta ogłuszenia), kip-up (`kipS`); całość mieści się
     * w `stunOnHeavyS`. Kąty w stopniach, odległości w m, ułamki kip-upu: koniec podciągnięcia
     * nóg (`tuckAt`) i lądowanie (`landAt`). Iskry przy lądowaniu w czerwieni wroga.
     */
    enemyKnockdown: {
      fallS: 0.22,
      kipS: 0.32,
      lieTiltDeg: 86,
      lieRestM: 0.24,
      bounceM: 0.07,
      bounceS: 0.09,
      tuckDeg: 26,
      tuckSquash: 0.12,
      tuckAt: 0.3,
      overshootDeg: 10,
      jumpM: 0.34,
      landAt: 0.78,
      landSquash: 0.14,
      sparks: 16,
      sparkSpeed: 2.6,
      sparkS: 0.35,
      sparkSize: 0.07,
      sparkColor: '#ff5050',
    },
    bossArena: {
      /** Promień pola telegrafu wezwania i tarczy (m). */
      summonRadiusM: 3.2,
      shieldRadiusM: 2.8,
      /** Druga fala zmiany fazy: ułamek zasięgu, ułamek czasu, opóźnienie (s), siła. */
      phaseEchoRadius: 0.6,
      phaseEchoTime: 0.8,
      phaseEchoDelayS: 0.14,
      phaseEchoStrength: 0.6,
      /** Fale rozpadu: ułamek zasięgu bossWaveRadiusM, czas (s rdzenia; dla reszty ułamek bossWaveS), opóźnienie (s), siła. */
      deathCoreWave: { radius: 0.35, time: 0.3, delayS: 0, strength: 1.2 },
      deathWave: { radius: 1.15, time: 1.25, delayS: 0.18, strength: 1 },
      deathEchoWave: { radius: 1.15, time: 1.7, delayS: 0.5, strength: 0.5 },
      /** Słup światła rozpadu (promień, wysokość w m) i słup przy wezwanym słudze (promień, wysokość, czas). */
      deathColumnRadiusM: 1.5,
      deathColumnHeightM: 34,
      minionColumnRadiusM: 0.9,
      minionColumnHeightM: 9,
      minionColumnS: 0.7,
      /** Rzuty iskier rozpadu (chwila w s, liczba): wybuch w barwie gorącej, żar i dogasanie w czerwieni. */
      deathSparks: {
        burstS: 0,
        burst: 46,
        emberS: 0.16,
        ember: 34,
        fadeS: 0.42,
        fade: 22,
      },
      /** Poświata pod bossem po śmierci: czas wygasania (s). */
      deathGlowS: 0.9,
      /** Fala uderzenia w chwili trafienia: czas (s) i siła. */
      slamWaveS: 0.28,
      slamWaveStrength: 1.3,
      /**
       * Przyciemnienie podłogi pod pierścieniem fali (mnożenie barwą `bossShadeColor`, 0–1):
       * na fioletowej podłodze samo dodawanie czerwieni dawało róż bliski magencie Rezonansu.
       */
      waveShadeStrength: 1,
      /** Zapas krycia cienia pod falą względem krycia samej fali (mnożnik). */
      waveShadeCover: 2.5,
      /**
       * Cień pod polem rażenia i poświatą bossa: mnożnik krycia (1 = jak dawniej) oraz zapas
       * promienia poza brzeg efektu (ułamek promienia), który gasi róż z bloomu na fioletowej
       * podłodze. `waveShadeMargin` to ten sam zapas dla fal.
       */
      zoneShadeCover: 2.5,
      glowShadeCover: 2.5,
      shadeMargin: 0.25,
      waveShadeMargin: 0.3,
      /**
       * Efekty w powietrzu (rozbłysk wizjera, powłoka fazy, słup rozpadu): udział pomarańczu
       * `bossWaveEdgeColor` w bazowej czerwieni (0–1). Dodane do niebieskich i fioletowych
       * neonów tła różowiały; tło pod nimi przyciemnia też cień mnożący (`airShadeCover`).
       */
      airWarmth: 0.8,
      /** To samo dla poświaty pod bossem (leży na podłodze, ale jej pierścień łapie odbicia neonów). */
      glowWarmth: 0.8,
      /** Krycie cienia mnożącego pod efektami w powietrzu względem ich krycia (mnożnik). */
      airShadeCover: 2,
    },
  },
  /** Pętla runu (F3): czasy przejść między ekranami i pokojami (s). */
  run: {
    transitionS: 0.6,
    fadeS: 0.35,
    rewardDelayS: 1,
    /** Po tylu sekundach wiszące rozliczenie nagrody pokazuje błąd i pozwala ponowić (kolejka zapisów). */
    rewardSaveTimeoutS: 10,
  },
  /** Kryjówka: zasięg od oka i margines bryły interakcji (m). */
  hub: {
    /** Margines planu stacji wokół stref (m). */
    mapPaddingM: 2,
    /** Podpis strefy na planie: minimalna szerokość i głębokość strefy, margines od rogu, szacunkowa szerokość znaku i wysokość podpisu (m). */
    mapLabelMinWidthM: 5,
    mapLabelMinDepthM: 3,
    mapLabelMarginM: 0.5,
    mapLabelCharM: 0.7,
    mapLabelHeightM: 1.6,
    propCooldownS: 1,
    noodlesCooldownS: 20,
    noodlesWarmthS: 2,
    bagImpulseRadS: 0.8,
    bagGravityRadS2: 3.4,
    bagDamping: 0.75,
    bagMaxAngleRad: 0.5,
    bagRestEpsilon: 0.001,
    bagCeilingM: 5,
    bagRopeRadiusM: 0.018,
    bagRopeSegments: 8,
    bagRimExtraM: 0.02,
    bagRimHeightM: 0.1,
    catSpeedMS: 0.75,
    catRadiusM: 0.22,
    catHeightM: 0.6,
    catStaticClearanceM: 0.6,
    faunaSampleM: 0.1,
    catYieldM: 0.8,
    catYieldConeCos: 0.3,
    catFleeM: 2,
    catRunThresholdMS: 3,
    catApproachConeCos: 0.6,
    catFleeSideM: 1.1,
    catFleeSpeedMS: 2.4,
    catFleeCooldownS: 4,
    catGroomChance: 0.3,
    catLieChance: 0.4,
    catGroomMinS: 1.5,
    catGroomMaxS: 3,
    catGroomIntervalMinS: 12,
    catGroomIntervalMaxS: 28,
    catMeowChance: 0.16,
    catMeowCooldownS: 25,
    catDebugDistanceM: 2,
    /** Dzieci przy kocie: zasięg (m) od dziecka do odpoczywającego kota, odnowienie (s), czas głaskania (s), odległość od kota (m), zasięg dołączenia drugiego dziecka (m), odległość kota od trasy w debugu (m). */
    kidsCatRangeM: 2.5,
    kidsCatCooldownS: 60,
    kidsCatPetS: 6,
    kidsCatStandM: 0.7,
    kidsCatJoinM: 4,
    kidsCatDebugM: 1.5,
    /** Szczury: długość kroku i wychylenia łap/ogona (proceduralny widok). */
    catStrideM: 0.7,
    catLegSwingRad: 0.55,
    catTailSwingRad: 0.2,
    /** Kot (`hub_cat.glb`): przenikanie klipów, prędkość klipu `walk` bez poślizgu łap i limit przyspieszenia. */
    catAnimFadeS: 0.3,
    catWalkClipSpeedMS: 0.55,
    catWalkMaxTimeScale: 2.5,
    catRimGain: 0.025,
    catEyeGain: 0.3,
    catColor: '#25282d',
    ratColor: '#34312f',
    catEyeColor: '#ffae1a',
    faunaRimColor: '#fff1d6',
    ratMaxActive: 2,
    ratSpeedMinMS: 2.5,
    ratSpeedMaxMS: 3.5,
    ratStartClearanceM: 3,
    ratRetryS: 1,
    ratBurstHz: 8,
    ratBurstFraction: 0.12,
    /** Spadek napięcia: odstęp od początku do początku i pierwszy po wejściu (s), czas trwania (s), poziom minimalny (0-1), promień wyboru komentującego NPC (m). */
    powerDipIntervalS: { min: 240, max: 480 },
    powerDipFirstS: { min: 90, max: 180 },
    powerDipDurationS: 2.5,
    powerDipMinLevel: 0.15,
    powerDipCommentRadiusM: 14,
    /** Krzywa z błyskami: liczba mrugnięć na początku, czas przygaszenia i przerwy (s), poziom w mrugnięciu, spadek do minimum i powrót (s), przerwa przed dodatkowym mrugnięciem przy powrocie (s). */
    powerDipBlinkCount: 3,
    powerDipBlinkS: 0.09,
    powerDipBlinkGapS: 0.07,
    powerDipBlinkLevel: 0.4,
    powerDipFallS: 0.25,
    powerDipRiseS: 0.25,
    powerDipReturnGapS: 0.1,
    /** Krzywa bez błysków (ustawienie dostępności): łagodny spadek i powrót (s). */
    powerDipSoftFallS: 0.5,
    powerDipSoftRiseS: 0.6,
    trainIntervalS: { min: 70, max: 140 },
    trainFirstS: { min: 25, max: 40 },
    trainDurationS: 7,
    trainGain: 0.9,
    trainLowHz: 38,
    trainFilterHz: 130,
    trainToneGain: 0.45,
    trainShakeIntensity: 0.16,
    trainShakeS: 1.5,
    trainDustMax: 96,
    trainDustCount: 60,
    trainDustClusters: 4,
    trainDustRadiusM: 3,
    trainDustSpreadM: 0.45,
    trainDustCeilingM: 4.4,
    trainDustCeilingGapM: 0.08,
    trainDustLifeS: 3.6,
    trainDustGravity: -0.8,
    trainDustDriftMS: 0.2,
    trainDustFallMS: 0.3,
    trainDustSizeM: 0.035,
    trainDustColor: '#b7ada0',
    interactRangeM: 3.5,
    focusPaddingM: 0.2,
    /** Dymek rozmowy z NPC znika po tylu sekundach (albo po odejściu gracza). */
    npcLineS: 5,
    arrivalDelayS: 2.5,
    /** Siadanie: czas przejścia kamery do punktu oka i z powrotem (s) oraz zakres obrotu głowy wokół kierunku siedziska (stopnie). */
    sitBlendS: 0.4,
    sitYawLimitDeg: 100,
    /** Znacznik niewykorzystanej reakcji nad NPC: wysokość nad stopami, obniżenie dla siedzących i niskich póz, rozmiar (m), szerokość względem wysokości, jasność (HDR, bloom), pulsowanie (Hz, amplituda). */
    markerHeightM: 2.25,
    markerSeatedDropM: 0.5,
    markerLowDropM: 0.7,
    markerSizeM: 0.12,
    markerWidthRatio: 0.45,
    markerGlow: 1.8,
    markerPulseHz: 0.8,
    markerPulseAmp: 0.18,
    npcYieldRadiusM: 1.2,
    npcYieldConeCos: 0.5,
    /** Zapas (m) ponad sumę promieni NPC i gracza, przy którym NPC na trasie czeka zamiast go dosunąć. */
    npcContactMarginM: 0.15,
    npcWalkSpeedMS: 1.3,
    npcWalkTurnRadS: 3,
    npcAnimFadeS: 0.25,
    /** Odstęp [min, max] s między wstawkami animacji statycznych NPC i długość [min, max] s wstawki. */
    npcIdleVarietyS: [18, 45],
    npcIdleVarietyLenS: [3, 5],
    npcAnimFarM: 18,
    npcAnimFarFrames: 3,
    /** Co ile klatek aktualizuje się mixer NPC poza kadrem i dalej niż `npcAnimFarM` (dt się sumuje). */
    npcAnimHiddenFrames: 20,
    /** Sfera ograniczająca ciała NPC w układzie siatki: środek (m, oś Y) i promień (m); cullowanie kadrem. */
    npcBoundsCenterM: 0.9,
    npcBoundsRadiusM: 1.3,
    /**
     * Kolory stroju cywilów (`npc_civilian.glb`): koszula i spodnie wybierane deterministycznie z id NPC,
     * reszta wspólna. Wierzchnią warstwę barwi `look.shade`.
     */
    npcShirtColors: ['#5b5852', '#4f535a', '#625a50', '#4a4844'],
    npcPantsColors: ['#20232b', '#272624', '#1c2130'],
    npcBootsColor: '#141416',
    npcSkinColor: '#8a8279',
    npcGearColor: '#2f2c28',
    npcMetalColor: '#6d737b',
    /** Zapas (m) ponad sferę NPC w teście kadru. */
    npcCullMarginM: 0.3,
    npcRouteSampleM: 0.25,
    npcRouteStaticClearanceM: 0.9,
    chatterRadiusM: 5,
    chatterLineBaseS: 1.8,
    chatterLineCharS: 0.045,
    chatterGapS: 0.45,
    chatterCooldownS: 45,
    chatterExitMarginM: 1,
    /** NPC zwraca się do gracza w tym zasięgu (m); tułów obraca się z tą prędkością (rad/s). */
    npcTurnRangeM: 4.5,
    npcTurnSpeedRadS: 2,
    /** Maks. odchylenie głowy od tułowia oraz tułowia od pozy bazowej (stojący / siedzący), rad. */
    npcHeadMaxRad: 1,
    npcStandBodyMaxRad: 1.9,
    npcSeatedBodyMaxRad: 0.5,
    fireDefaultSizeM: 0.6,
    fireSizeScale: 0.45,
    fireBrightness: 0.38,
    fireOpacity: 0.55,
    fireHeightRatio: 1.4,
    firePlanes: 2,
    fireFlickerHz: 7,
    fireFlickerAmplitude: 0.1,
    fireFlickerSecondaryAmplitude: 0.06,
    fireFlickerSecondaryRate: 2.7,
    fireFlickerSecondaryPhase: 1.3,
    fireSeedPhase: 2.1,
    firePlanePhase: 1.7,
  },
  sandbox: { cubeSpawnHeight: 6 },
  /** S4-03: prototypy eskorty więźnia i wagonu (sceny `escort-test`, `payload-test`). */
  prototypes: {
    escort: {
      maxHealth: 120,
      /** Marsz za graczem; powyżej `catchUpDistanceM` więzień biegnie z `catchUpSpeedMps`. */
      speedMps: 4.5,
      catchUpSpeedMps: 8,
      followDistanceM: 3,
      catchUpDistanceM: 10,
      /** Dalej niż leashM od gracza więzień staje i czeka; rusza ponownie w leashResumeM. */
      leashM: 25,
      leashResumeM: 20,
      /** Uwolnienie: gracz stoi w freeRadiusM przez freeHoldS (jak cele „interact” misji). */
      freeRadiusM: 2.5,
      freeHoldS: 1.5,
      evacRadiusM: 4,
      /** Utknięcie: w `following` przesunięcie < stuckEpsM przez stuckS. */
      stuckS: 2.5,
      stuckEpsM: 0.5,
      unstickMinStepM: 0.5,
      colliderHeightM: 1.7,
      colliderRadiusM: 0.4,
      markerHeightM: 8,
      animFadeS: 0.2,
    },
    payload: {
      maxHealth: 400,
      speedMps: 3.5,
      /** Gracz w tym promieniu od wagonu go „pcha” (wagon jedzie). */
      pushRadiusM: 9,
      /** Żywy wróg w tym promieniu zatrzymuje wagon. */
      contestRadiusM: 22,
      /** Połowy wymiarów hurtboxa (model `port_flatcar`: 14 × 3,8 × 3 m). */
      bodyHalfLengthM: 7,
      bodyHalfHeightM: 1.9,
      bodyHalfWidthM: 1.5,
      markerHeightM: 10,
      stopPostHeightM: 4,
    },
  },
};
export type Tuning = typeof tuning;

export function createTuningGui(t: Tuning = tuning): GUI {
  const gui = new GUI({ title: 'NEORYDER — strojenie' });
  function populate(parent: GUI, group: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(group)) {
      if (typeof value === 'number') parent.add(group, key);
      else if (typeof value === 'string' && value.startsWith('#'))
        parent.addColor(group, key);
      else if (typeof value === 'object' && value !== null)
        populate(parent.addFolder(key), value as Record<string, unknown>);
    }
  }
  populate(gui, t);
  return gui;
}
