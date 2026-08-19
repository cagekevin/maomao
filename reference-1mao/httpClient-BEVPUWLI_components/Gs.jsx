import { Hs, e, t, Ws } from './shared.js';
export default function Gs() {
  Hs();
  let e = document.createElement(`div`);
  e.style.position = `fixed`;
  e.style.inset = `0`;
  e.style.backgroundColor = `rgba(0, 0, 0, 0.92)`;
  e.style.zIndex = `999998`;
  e.style.backdropFilter = `blur(6px)`;
  e.style.display = `flex`;
  e.style.alignItems = `center`;
  e.style.justifyContent = `center`;
  e.style.cursor = `zoom-out`;
  e.addEventListener(`click`, Hs);
  let t = document.createElement(`button`);
  t.type = `button`;
  t.textContent = `×`;
  t.title = `关闭 (Esc)`;
  t.style.cssText = [`position: absolute`, `top: 20px`, `right: 24px`, `width: 40px`, `height: 40px`, `border: none`, `outline: none`, `cursor: pointer`, `font-size: 28px`, `line-height: 1`, `color: #e5e7eb`, `background: rgba(255,255,255,0.08)`, `border-radius: 50%`, `backdrop-filter: blur(4px)`, `transition: background 0.15s ease`, `display: flex`, `align-items: center`, `justify-content: center`].join(`;`);
  t.addEventListener(`mouseenter`, () => {
    t.style.background = `rgba(255,255,255,0.18)`;
  });
  t.addEventListener(`mouseleave`, () => {
    t.style.background = `rgba(255,255,255,0.08)`;
  });
  t.addEventListener(`click`, e => {
    e.stopPropagation();
    Hs();
  });
  e.appendChild(t);
  document.body.appendChild(e);
  window.addEventListener(`keydown`, Ws);
  Bs = e;
  Vs = () => {
    window.removeEventListener(`keydown`, Ws);
  };
  return e;
}