/** Pointer + keyboard for paint, pan, zoom, and game keys. */

export function bindInput(canvas, handlers) {
  const state = {
    painting: false,
    erasing: false,
    panning: false,
    last: null,
    space: false,
    spaceUsedAsPan: false,
    panMode: false,
    pointerId: null,
  };

  function paintAt(ev, moving) {
    const erase = state.erasing || ev.shiftKey || ev.buttons === 2;
    handlers.paint?.(ev, erase, moving);
  }

  function down(ev) {
    handlers.unlock?.();
    if (ev.button === 1 || (state.space && ev.button === 0) || (state.panMode && ev.button === 0)) {
      state.panning = true;
      if (state.space) state.spaceUsedAsPan = true;
      state.last = [ev.clientX, ev.clientY];
      canvas.setPointerCapture(ev.pointerId);
      ev.preventDefault();
      return;
    }
    if (ev.button === 2 || ev.shiftKey) state.erasing = true;
    else if (ev.button === 0) state.painting = true;
    else return;
    state.pointerId = ev.pointerId;
    canvas.setPointerCapture(ev.pointerId);
    handlers.strokeStart?.();
    paintAt(ev, false);
    ev.preventDefault();
  }

  function move(ev) {
    handlers.hover?.(ev);
    if (state.panning && state.last) {
      handlers.pan?.(ev.clientX - state.last[0], ev.clientY - state.last[1]);
      state.last = [ev.clientX, ev.clientY];
      ev.preventDefault();
      return;
    }
    if (state.painting || state.erasing) {
      paintAt(ev, true);
      ev.preventDefault();
    }
  }

  function up(ev) {
    if (state.painting || state.erasing) handlers.strokeEnd?.();
    state.painting = false;
    state.erasing = false;
    state.panning = false;
    state.last = null;
    state.pointerId = null;
    try {
      canvas.releasePointerCapture(ev.pointerId);
    } catch {
      /* already released */
    }
  }

  function wheel(ev) {
    ev.preventDefault();
    const factor = ev.deltaY < 0 ? 1.12 : 0.9;
    handlers.zoom?.(ev.clientX, ev.clientY, factor);
  }

  function context(ev) {
    ev.preventDefault();
  }

  function keydown(ev) {
    if (ev.code === "Space") {
      state.space = true;
      if (ev.target === document.body || ev.target === canvas || ev.target === document.documentElement) {
        ev.preventDefault();
      }
    }
    handlers.keydown?.(ev, state);
  }

  function keyup(ev) {
    if (ev.code === "Space") {
      const tap = !state.spaceUsedAsPan;
      state.space = false;
      state.spaceUsedAsPan = false;
      if (tap && !isTypingTarget(ev.target) && ev.target?.tagName !== "BUTTON") handlers.spaceTap?.(ev);
    }
    handlers.keyup?.(ev, state);
  }

  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("wheel", wheel, { passive: false });
  canvas.addEventListener("contextmenu", context);
  window.addEventListener("keydown", keydown);
  window.addEventListener("keyup", keyup);

  return {
    state,
    setPanMode(on) {
      state.panMode = Boolean(on);
    },
    destroy() {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("wheel", wheel);
      canvas.removeEventListener("contextmenu", context);
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
    },
  };
}

export function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}
