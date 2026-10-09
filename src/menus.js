import { ACTOR_ANIMATIONS } from './animation/actors.js';
import { installGameControls } from './touch-controls.js';
import './menus.css';

const FISH = [
  { key: 'fish_orange', name: 'Sunny' }, { key: 'fish_blue', name: 'Blue' },
  { key: 'fish_pink', name: 'Rosie' }, { key: 'fish_green', name: 'Kiwi' },
];
const paths = {
  play: '<path d="m8 5 11 7-11 7Z"/>',
  fullscreen: '<path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5"/>',
  input: '<path d="m8 7 4-4 4 4M12 3v18m-4-4 4 4 4-4"/>',
  audio: '<path d="M11 4 6 8H3v8h3l5 4ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`;

export function installMenus(game, audio) {
  const app = document.getElementById('reef-app');
  const layer = document.getElementById('menu-layer');
  const panel = document.getElementById('menu-panel');
  const menuButton = document.getElementById('menu-button');
  const status = document.getElementById('app-status');
  const listeners = new AbortController();
  const on = (target, name, fn) => target.addEventListener(name, fn, { signal: listeners.signal });
  const queryMode = new URLSearchParams(location.search).get('controls');
  const settings = { input: queryMode === 'tap' ? 'tap' : 'swipe' };
  let state = 'menu', selected = 0, ready = false, currentScene = null, pauseOnReveal = false;
  let transitionTimer, lossTimer, animationFrame;
  const portraits = FISH.map(fish => {
    const image = new Image();
    image.src = ACTOR_ANIMATIONS[fish.key].image;
    return image;
  });
  const touch = installGameControls(game, {
    getScene: () => currentScene, getMode: () => settings.input, isPlaying: () => state === 'playing',
  });
  const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement;
  const fullscreenAvailable = () => !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  const fishPicker = () => `<button class="fish-choice" data-action="fish" aria-label="Change fish, currently ${FISH[selected].name}">
    <canvas class="fish-portrait" width="216" height="130" aria-hidden="true"></canvas>
    <span class="fish-name">${FISH[selected].name}</span><span class="fish-cycle">‹ tap to change ›</span>
  </button>`;
  const playRow = replay => `<div class="play-row">${fishPicker()}<button class="primary-button" data-action="play" ${ready ? '' : 'disabled'}>${icon('play')}<span>${ready ? replay ? 'Play again' : 'Play' : 'Loading…'}</span></button></div>`;
  const settingsMarkup = () => `<div class="settings" aria-label="Settings">
    <h2 class="settings-heading">Settings</h2>
    <div class="setting-row"><span class="setting-label">${icon('fullscreen')}Fullscreen</span><button class="toggle" data-action="fullscreen" role="switch" aria-label="Fullscreen" aria-checked="false"><span>Off</span></button></div>
    <div class="setting-row"><span class="setting-label">${icon('input')}Controls</span><div class="input-options" role="group" aria-label="Touch controls"><button data-action="input" data-input="tap" aria-label="Tap above or below the fish" aria-pressed="false">Tap</button><button data-action="input" data-input="swipe" aria-label="Swipe up or down" aria-pressed="false">Swipe</button></div></div>
    <div class="setting-row"><span class="setting-label">${icon('audio')}Audio</span><button class="toggle" data-action="audio" role="switch" aria-label="Audio" aria-checked="true"><span>On</span></button></div>
    <p class="menu-note" role="status"></p>
  </div>`;

  function syncSettings() {
    for (const button of panel.querySelectorAll('[data-input]')) button.setAttribute('aria-pressed', String(button.dataset.input === settings.input));
    const sound = panel.querySelector('[data-action="audio"]');
    if (sound) { sound.setAttribute('aria-checked', String(!audio.muted)); sound.querySelector('span').textContent = audio.muted ? 'Off' : 'On'; }
    const fullscreen = panel.querySelector('[data-action="fullscreen"]');
    if (fullscreen) {
      fullscreen.setAttribute('aria-checked', String(!!fullscreenElement()));
      fullscreen.disabled = !fullscreenAvailable();
      fullscreen.querySelector('span').textContent = fullscreen.disabled ? 'Unavailable' : fullscreenElement() ? 'On' : 'Off';
      fullscreen.title = fullscreen.disabled ? 'Fullscreen is not supported by this browser.' : '';
    }
  }

  function showScreen(next) {
    clearTimeout(transitionTimer);
    touch.cancel();
    state = next;
    app.dataset.screen = next;
    menuButton.hidden = true;
    layer.hidden = false;
    layer.classList.remove('is-leaving');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    if (next === 'menu') {
      panel.innerHTML = `<header class="splash-heading"><p class="eyebrow">A little ocean adventure</p><h1 id="menu-title" class="game-title">Reef Hop</h1><p class="menu-subtitle">Pick a friend. Make a splash.</p></header><div class="menu-card">${playRow(false)}${settingsMarkup()}</div>`;
    } else if (next === 'paused') {
      panel.innerHTML = `<div class="menu-card pause-card"><div class="pause-main"><p class="eyebrow">Take a breather</p><h1 id="menu-title" class="panel-title">Ocean break</h1><div class="pause-actions"><button class="primary-button" data-action="continue">${icon('play')}Continue</button><button class="text-button" data-action="exit">Exit to menu</button></div></div>${settingsMarkup()}</div>`;
    } else {
      panel.innerHTML = `<div class="menu-card replay-card"><p class="eyebrow">Nice swimming!</p><h1 id="menu-title" class="panel-title">Another splash?</h1><p class="score">${Math.floor(currentScene.distance)} <small>metres</small></p><p class="panel-copy">Try again with your favourite friend.</p>${playRow(true)}<button class="text-button" data-action="exit">Back to menu</button></div>`;
    }
    syncSettings();
    // A fresh panel also retriggers the short entrance animation.
    panel.getAnimations().forEach(animation => animation.cancel());
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches)
      panel.animate([{ opacity: 0, transform: 'translateY(12px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'ease-out' });
    panel.focus({ preventScroll: true });
  }

  function revealGame() {
    state = 'transition';
    layer.classList.add('is-leaving');
    transitionTimer = setTimeout(() => {
      if (pauseOnReveal || document.hidden) { pauseOnReveal = false; showScreen('paused'); return; }
      layer.hidden = true;
      app.dataset.screen = 'playing';
      state = 'playing';
      currentScene.controlsEnabled = true;
      currentScene.scene.resume();
      menuButton.hidden = false;
      menuButton.focus({ preventScroll: true });
    }, 240);
  }

  function play() {
    if (!ready || !['menu', 'replay'].includes(state)) return;
    clearTimeout(lossTimer);
    pauseOnReveal = false;
    state = 'starting';
    panel.querySelector('[data-action="play"]').disabled = true;
    game.scene.start('Reef', { autostart: true, fish: FISH[selected].key });
  }

  function pause() {
    if (['starting', 'transition'].includes(state)) { pauseOnReveal = true; return; }
    if (state !== 'playing') return;
    currentScene.controlsEnabled = false;
    currentScene.scene.pause();
    showScreen('paused');
  }

  function exitToMenu() {
    clearTimeout(lossTimer);
    currentScene.controlsEnabled = false;
    currentScene.scene.stop();
    showScreen('menu');
  }

  async function toggleFullscreen() {
    try {
      if (fullscreenElement()) await (document.exitFullscreen ? document.exitFullscreen() : document.webkitExitFullscreen());
      else await (app.requestFullscreen ? app.requestFullscreen() : app.webkitRequestFullscreen());
    } catch {
      const note = panel.querySelector('.menu-note');
      if (note) note.textContent = 'Fullscreen could not open. You can keep playing here.';
    }
    syncSettings();
  }

  on(panel, 'click', event => {
    const button = event.target.closest('button[data-action]');
    if (!button || button.disabled || !['menu', 'paused', 'replay'].includes(state)) return;
    const action = button.dataset.action;
    if (action === 'audio') {
      audio.toggle();
      audio.ui('toggle');
      syncSettings();
      return;
    }
    audio.ui(action === 'play' || action === 'continue' ? 'play' : 'tap');
    if (action === 'fish') {
      selected = (selected + 1) % FISH.length;
      button.setAttribute('aria-label', `Change fish, currently ${FISH[selected].name}`);
      button.querySelector('.fish-name').textContent = FISH[selected].name;
      button.classList.remove('is-changing');
      void button.offsetWidth;
      button.classList.add('is-changing');
      status.textContent = `${FISH[selected].name} selected`;
    } else if (action === 'play') play();
    else if (action === 'continue') revealGame();
    else if (action === 'exit') exitToMenu();
    else if (action === 'fullscreen') void toggleFullscreen();
    else if (action === 'input') { settings.input = button.dataset.input; touch.cancel(); syncSettings(); }
  });
  on(menuButton, 'click', () => { audio.ui('tap'); pause(); });
  on(document, 'fullscreenchange', syncSettings);
  on(document, 'webkitfullscreenchange', syncSettings);
  on(document, 'visibilitychange', () => { if (document.hidden) pause(); });
  on(window, 'blur', pause);
  on(document, 'keydown', event => {
    if (event.key === 'Escape' && ['playing', 'paused'].includes(state)) {
      event.preventDefault();
      audio.ui('tap');
      if (state === 'playing') pause(); else revealGame();
    }
    if (event.key === 'Tab' && !layer.hidden) {
      const buttons = [...panel.querySelectorAll('button:not(:disabled)')];
      const first = buttons[0], last = buttons.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel)) { event.preventDefault(); first?.focus(); }
    }
  });

  function onReady(scene) {
    currentScene = scene;
    ready = true;
    scene.controlsEnabled = false;
    scene.scene.pause();
    if (state === 'starting') revealGame();
    else {
      const button = panel.querySelector('[data-action="play"]');
      if (button) { button.disabled = false; button.querySelector('span').textContent = 'Play'; }
    }
  }
  function onLoss(scene) {
    if (state !== 'playing') return;
    state = 'ending';
    touch.cancel();
    scene.controlsEnabled = false;
    menuButton.hidden = true;
    lossTimer = setTimeout(() => { scene.scene.pause(); showScreen('replay'); }, 450);
  }
  game.events.on('reef-ready', onReady);
  game.events.on('reef-over', onLoss);

  function drawPortrait(time) {
    const canvas = panel.querySelector('.fish-portrait'), image = portraits[selected];
    if (!layer.hidden && canvas && image.complete && image.naturalWidth) {
      const actor = ACTOR_ANIMATIONS[FISH[selected].key];
      const [left, top, right, bottom] = actor.presentation.bounds;
      const frame = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : Math.floor(time / 150) % 6;
      const width = right - left, height = bottom - top;
      const scale = Math.min(190 / width, 108 / height);
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, frame % 4 * 640 + left, Math.floor(frame / 4) * 384 + top, width, height,
        (216 - width * scale) / 2, (130 - height * scale) / 2, width * scale, height * scale);
    }
    animationFrame = requestAnimationFrame(drawPortrait);
  }
  showScreen('menu');
  animationFrame = requestAnimationFrame(drawPortrait);
  game.events.once('destroy', () => {
    listeners.abort(); touch.dispose(); clearTimeout(transitionTimer); clearTimeout(lossTimer); cancelAnimationFrame(animationFrame);
    game.events.off('reef-ready', onReady); game.events.off('reef-over', onLoss);
  });
  return { get state() { return state; }, settings, pause };
}
