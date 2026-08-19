// TODO(全局, 无需 import): r, n, i
import _cmp_Gs from './Gs.jsx';
import { e, t } from './shared.js';
export default function Ks(e, t = `image`) {
  if (!e) {
    return;
  }
  let n = _cmp_Gs();
  let r = document.createElement(`div`);
  r.style.cssText = [`position: relative`, `max-width: min(1400px, 92vw)`, `max-height: 88vh`, `display: flex`, `align-items: center`, `justify-content: center`].join(`;`);
  r.addEventListener(`click`, e => {
    return e.stopPropagation();
  });
  if (t === `image`) {
    let t = document.createElement(`img`);
    t.src = e;
    t.alt = `Preview`;
    t.style.cssText = [`display: block`, `max-width: min(1400px, 92vw)`, `max-height: 88vh`, `object-fit: contain`, `background: #000`, `border-radius: 8px`, `box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5)`, `user-select: none`, `-webkit-user-drag: none`].join(`;`);
    r.appendChild(t);
  } else if (t === `video`) {
    let t = document.createElement(`video`);
    t.src = e;
    t.controls = true;
    t.playsInline = true;
    t.loop = false;
    t.preload = `auto`;
    t.style.cssText = [`display: block`, `max-width: min(1400px, 92vw)`, `max-height: 88vh`, `background: #000`, `border-radius: 12px`, `box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5)`, `outline: none`].join(`;`);
    r.appendChild(t);
    setTimeout(() => {
      t.play().catch(() => {});
    }, 50);
  } else {
    let t = document.createElement(`audio`);
    t.src = e;
    t.controls = true;
    t.preload = `auto`;
    t.style.cssText = [`width: min(720px, 88vw)`, `background: #0f0f10`, `border-radius: 9999px`, `padding: 12px 18px`, `box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5)`, `outline: none`, `color-scheme: dark`].join(`;`);
    let n = document.createElement(`div`);
    n.style.cssText = [`background: rgba(20,20,22,0.9)`, `border-radius: 24px`, `padding: 32px 36px`, `display: flex`, `flex-direction: column`, `align-items: center`, `gap: 16px`, `box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5)`, `color: #e5e7eb`].join(`;`);
    let i = document.createElement(`div`);
    i.textContent = `音频播放`;
    i.style.cssText = `font-size: 14px; color: #9ca3af; letter-spacing: 0.05em; text-transform: uppercase;`;
    n.appendChild(i);
    n.appendChild(t);
    r.appendChild(n);
    setTimeout(() => {
      t.play().catch(() => {});
    }, 50);
  }
  n.appendChild(r);
}