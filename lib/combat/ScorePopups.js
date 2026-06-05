import * as THREE from "three";

const POPUP_LIFETIME = 1.1;
const POPUP_RISE_PX_PER_SEC = 36;

const _ndc = new THREE.Vector3();

/**
 * Floating kill callouts at world hit points — e.g. "HEADSHOT +310".
 * @param {HTMLElement} container
 */
export function createScorePopupLayer(container) {
  /** @type {{ el: HTMLDivElement, point: THREE.Vector3, age: number, zone: string }[]} */
  const popups = [];

  return {
    spawn({ point, text, zone }) {
      if (!container || !point || !text) return;
      const el = document.createElement("div");
      el.className = `killCallout killCallout--${zone ?? "body"}`;
      el.textContent = text;
      container.appendChild(el);
      popups.push({
        el,
        point: point.clone(),
        age: 0,
        zone: zone ?? "body",
      });
    },

    update(camera, dt) {
      if (!container) return;
      const w = window.innerWidth;
      const h = window.innerHeight;

      for (let i = popups.length - 1; i >= 0; i--) {
        const popup = popups[i];
        popup.age += dt;
        if (popup.age >= POPUP_LIFETIME) {
          popup.el.remove();
          popups.splice(i, 1);
          continue;
        }

        _ndc.copy(popup.point).project(camera);
        if (_ndc.z > 1) {
          popup.el.style.opacity = "0";
          continue;
        }

        const x = (_ndc.x * 0.5 + 0.5) * w;
        const y = (-_ndc.y * 0.5 + 0.5) * h - popup.age * POPUP_RISE_PX_PER_SEC;
        const t = popup.age / POPUP_LIFETIME;
        const opacity = t < 0.1 ? t / 0.1 : 1 - (t - 0.1) / 0.9;

        popup.el.style.left = `${x}px`;
        popup.el.style.top = `${y}px`;
        popup.el.style.opacity = String(Math.max(0, opacity));
      }
    },

    dispose() {
      for (const popup of popups) popup.el.remove();
      popups.length = 0;
    },
  };
}
