// The seven rooms on the home hub, in the order they appear (four on top, three below).
// "id" is how the engine, the save and the voice pack know the room.
// "built" is false until a later order builds the room. Not built shows a dashed outline.
// There are no words here. Each room's spoken name comes from the voice pack.

export const MODES = [
  { id: 'skin-studio', picture: 'mask', built: false },
  { id: 'color-lab', picture: 'crayon', built: false },
  { id: 'puzzle-forge', picture: 'jigsaw', built: false },
  { id: 'map-maker', picture: 'map', built: false },
  { id: 'power-up', picture: 'bolt', built: false },
  { id: 'shop', picture: 'bag', built: false },
  { id: 'gallery', picture: 'frame', built: false }
];
