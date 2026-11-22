// Tema, layout, dan komponen bersama untuk kedua deck (build_deck.js, build_materi.js).
const path = require('path');

module.exports = function setup(pres, footer) {
  const A = f => path.join(__dirname, 'assets', f);
  // Palet sama dengan aplikasi web: teal klinis, sage, panel teknis gelap, merah 119, warna ESI
  const K = {
    dark: '0F1915', dark2: '16231E', darkLine: '2C3D36', mint: '5FD3B6', mintText: '9DB3AA',
    teal: '0F6B5C', teal2: '0B5549', sage: 'EEF3F0', soft: 'E1EFE9', ink: '13201C', ink2: '3F4F4A', ink3: '56655F',
    line: 'D3DFD9', white: 'FFFFFF', sos: 'C8361F', sosSoft: 'FDECEA', gold: 'F3D58A',
    esi: ['B42318', 'C2410C', '9A6B00', '2B7D45', '2A62B0'],
  };
  const FONT = 'Calibri';

  pres.theme = { headFontFace: FONT, bodyFontFace: FONT };

  // ---------- layout ----------
  pres.defineSlideMaster({
    title: 'GELAP', background: { color: K.dark },
    objects: [{ placeholder: { options: { name: 'title', type: 'title', x: 0.8, y: 2.3, w: 11.7, h: 1.6, fontFace: FONT, fontSize: 44, bold: true, color: K.white, valign: 'top' }, text: '' } }],
  });
  pres.defineSlideMaster({
    title: 'ISI', background: { color: K.white },
    margin: [0.5, 0.6, 0.6, 0.6],
    objects: [
      { placeholder: { options: { name: 'title', type: 'title', x: 0.6, y: 0.4, w: 12.1, h: 0.9, fontFace: FONT, fontSize: 30, bold: true, color: K.ink, valign: 'middle', align: 'left', margin: 0 }, text: '' } },
      { text: { text: footer, options: { x: 0.6, y: 7.0, w: 8, h: 0.3, fontFace: FONT, fontSize: 10, color: K.ink3, margin: 0 } } },
    ],
    slideNumber: { x: 12.2, y: 7.0, w: 0.5, h: 0.3, fontFace: FONT, fontSize: 10, color: K.ink3, align: 'right' },
  });
  pres.defineSlideMaster({
    title: 'ISI_GELAP', background: { color: K.dark },
    objects: [
      { placeholder: { options: { name: 'title', type: 'title', x: 0.6, y: 0.4, w: 12.1, h: 0.9, fontFace: FONT, fontSize: 30, bold: true, color: K.white, valign: 'middle', align: 'left', margin: 0 }, text: '' } },
      { text: { text: footer, options: { x: 0.6, y: 7.0, w: 8, h: 0.3, fontFace: FONT, fontSize: 10, color: K.mintText, margin: 0 } } },
    ],
    slideNumber: { x: 12.2, y: 7.0, w: 0.5, h: 0.3, fontFace: FONT, fontSize: 10, color: K.mintText, align: 'right' },
  });

  // ---------- komponen ----------
  const T = (s, text, o) => s.addText(text, { isTextBox: true, fontFace: FONT, margin: 0, valign: 'top', color: K.ink, fontSize: 16, ...o });
  const box = (s, o) => s.addShape(pres.shapes.ROUNDED_RECTANGLE, { rectRadius: 0.12, line: { color: o.fill || K.sage, width: 0 }, ...o, fill: { color: o.fill || K.sage } });
  const circle = (s, x, y, d, fill, label, color = K.white, fs = 16) => {
    s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill, width: 0 } });
    T(s, label, { x, y, w: d, h: d, align: 'center', valign: 'middle', bold: true, color, fontSize: fs });
  };
  const arrow = (s, x1, y1, x2, y2, color = K.ink3) => s.addShape(pres.shapes.LINE, {
    x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1) || 0.001, h: Math.abs(y2 - y1) || 0.001,
    flipH: x2 < x1, flipV: y2 < y1, line: { color, width: 1.75, endArrowType: 'triangle' },
  });
  const bullets = (items, o = {}) => items.map((t, i) => ({ text: t, options: { bullet: { indent: 18 }, breakLine: i < items.length - 1, paraSpaceAfter: 8, ...o } }));
  const shadow = () => ({ type: 'outer', color: '13201C', opacity: 0.12, blur: 8, offset: 2, angle: 90 });
  const shot = (s, file, x, y, w, ratio = 768 / 1366) => {
    box(s, { x: x - 0.06, y: y - 0.06, w: w + 0.12, h: w * ratio + 0.12, fill: K.line, rectRadius: 0.1 });
    s.addImage({ path: A(file), x, y, w, h: w * ratio });
  };

  let sec = '';
  const add = (master, title, notes) => {
    const s = pres.addSlide({ masterName: master, sectionTitle: sec });
    if (title) s.addText(title, { placeholder: 'title' });
    if (notes) s.addNotes(notes);
    return s;
  };
  const section = t => { sec = t; pres.addSection({ title: t }); };

  return { K, FONT, A, T, box, circle, arrow, bullets, shadow, shot, add, section };
};
