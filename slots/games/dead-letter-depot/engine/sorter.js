// Dead Letter Depot: the sorter's geometry, shared by the resolver, the engine
// and the screen. Five stages (columns) of three lanes; lane 0 is the top.
export const STAGES = 5, LANES = 3, ENTRY = 1; // a spin's letter enters the middle lane
export const STAMPS = Object.freeze(['U', 'S', 'D', 'F', 'J']);
export const STAMP_NAMES = Object.freeze({ U: 'Up', S: 'Straight', D: 'Down', F: 'Fork', J: 'Jam' });
