// Every picture on the home hub, drawn in code. No art files.
// PLACEHOLDER art: white ground, thick black outline, red as the one anchor color.
// Real art arrives through a later order.

function star(cx, cy, outer, inner) {
  const points = [];
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    points.push((cx + radius * Math.cos(angle)).toFixed(1) + ',' + (cy + radius * Math.sin(angle)).toFixed(1));
  }
  return points.join(' ');
}

// Line pictures, each drawn inside a 100 by 100 box.
const ART = {
  // A hero mask with two eye holes.
  mask: '<path class="ink" d="M8 43 C8 29 22 25 36 28 C44 30 47 34 50 34 C53 34 56 30 64 28 C78 25 92 29 92 43 C92 60 81 72 68 72 C59 72 55 63 50 63 C45 63 41 72 32 72 C19 72 8 60 8 43 Z"/>' +
    '<ellipse class="ink" cx="31" cy="47" rx="10" ry="7.5"/><ellipse class="ink" cx="69" cy="47" rx="10" ry="7.5"/>',
  // A crayon.
  crayon: '<g transform="rotate(-45 50 50)">' +
    '<rect class="ink" x="12" y="37" width="56" height="26" rx="4"/>' +
    '<path class="ink" d="M68 37 L92 50 L68 63 Z"/>' +
    '<path class="ink" d="M26 37 V63 M56 37 V63"/></g>',
  // A jigsaw piece.
  jigsaw: '<path class="ink" d="M19 34 h16 a9.5 9.5 0 1 1 16 0 h16 v16 a9.5 9.5 0 1 1 0 16 v16 h-16 a9.5 9.5 0 1 0 -16 0 h-16 v-16 a9.5 9.5 0 1 0 0 -16 z"/>',
  // A folded map with a dotted path.
  map: '<path class="ink" d="M12 28 L37 19 L63 28 L88 19 V72 L63 81 L37 72 L12 81 Z"/>' +
    '<path class="ink" d="M37 19 V72 M63 28 V81"/>' +
    '<path class="ink dots" d="M22 64 C30 50 44 62 50 50 C56 38 68 50 76 38"/>',
  // A lightning bolt. Not a coin.
  bolt: '<path class="ink" d="M58 8 L22 55 H45 L38 92 L78 42 H55 Z"/>',
  // A shopping bag.
  bag: '<path class="ink" d="M24 36 H76 L84 90 H16 Z"/>' +
    '<path class="ink open" d="M37 46 V28 a13 13 0 0 1 26 0 V46"/>',
  // A picture frame with a star inside.
  frame: '<rect class="ink" x="10" y="10" width="80" height="80" rx="7"/>' +
    '<rect class="ink" x="24" y="24" width="52" height="52" rx="3"/>' +
    '<polygon class="ink" points="' + star(50, 51, 19, 8) + '"/>',
  // A house, for the Home button.
  house: '<path class="ink" d="M24 48 V88 H76 V48"/>' +
    '<path class="ink" d="M12 54 L50 16 L88 54"/>' +
    '<rect class="ink" x="42" y="62" width="16" height="26" rx="2"/>'
};

function svg(size, inner, extraClass) {
  return '<svg class="pic ' + (extraClass || '') + '" viewBox="0 0 ' + size + ' ' + size +
    '" width="' + size + '" height="' + size + '" aria-hidden="true" focusable="false">' + inner + '</svg>';
}

// A hub button face: a rounded square with the picture inside.
// Dashed outline means the room is not built yet. Solid means ready.
export function modeFace(picture, built) {
  return svg(146,
    '<rect class="face' + (built ? '' : ' dashed') + '" x="4" y="4" width="138" height="138" rx="30"/>' +
    '<g transform="translate(25 25) scale(0.96)">' + ART[picture] + '</g>');
}

// The large picture on a Coming Soon card.
export function cardPicture(picture) {
  return svg(300,
    '<rect class="face dashed big" x="6" y="6" width="288" height="288" rx="52"/>' +
    '<g transform="translate(50 50) scale(2)">' + ART[picture] + '</g>', 'pic--card');
}

// The red Home button.
export function homeFace() {
  return svg(150,
    '<rect class="face red" x="4" y="4" width="142" height="142" rx="34"/>' +
    '<g transform="translate(27 25) scale(0.96)">' + ART.house + '</g>', 'pic--home');
}

// The stand-in character. Chunky, round head, small body, one flat red cape.
// It has no name and is not a likeness of anyone or of any existing character.
export function buddy() {
  return '<svg class="buddy__art" viewBox="0 0 280 400" width="280" height="400" aria-hidden="true" focusable="false">' +
    '<g class="buddy__all">' +
      '<path class="ink red-fill" d="M98 214 C58 246 46 318 38 362 L242 362 C234 318 222 246 182 214 Z"/>' +
      '<rect class="ink" x="103" y="296" width="32" height="64" rx="16"/>' +
      '<rect class="ink" x="145" y="296" width="32" height="64" rx="16"/>' +
      '<g class="buddy__body">' +
        '<rect class="ink" x="62" y="222" width="30" height="78" rx="15" transform="rotate(16 77 228)"/>' +
        '<g class="buddy__arm"><rect class="ink" x="188" y="222" width="30" height="78" rx="15" transform="rotate(-150 203 232)"/></g>' +
        '<rect class="ink" x="90" y="200" width="100" height="116" rx="38"/>' +
      '</g>' +
      '<g class="buddy__head">' +
        '<circle class="ink" cx="140" cy="118" r="94"/>' +
        '<g class="buddy__eyes">' +
          '<ellipse class="dot" cx="106" cy="116" rx="15" ry="20"/><ellipse class="dot" cx="174" cy="116" rx="15" ry="20"/>' +
          '<circle class="glint" cx="111" cy="108" r="5.5"/><circle class="glint" cx="179" cy="108" r="5.5"/>' +
        '</g>' +
        '<path class="ink open" d="M110 158 Q140 188 170 158"/>' +
      '</g>' +
    '</g></svg>';
}

// Shown only when the tablet is held upright: a picture of it turning. No words.
export function turnPicture() {
  return '<svg class="turn__art" viewBox="0 0 300 300" width="300" height="300" aria-hidden="true" focusable="false">' +
    '<g class="turn__tablet"><rect class="ink" x="95" y="60" width="110" height="180" rx="16"/>' +
    '<circle class="dot" cx="150" cy="224" r="6"/></g>' +
    '<path class="ink open red-line" d="M228 96 A96 96 0 0 1 244 190"/>' +
    '<path class="ink open red-line" d="M226 176 L244 192 L258 172"/>' +
    '</svg>';
}
