import { buildTypeModel as implantType } from '../implant-types.js';
import { RCT_TYPES, BRACES_TYPES } from './rct-braces.js';
import { CROWN_TYPES, VENEER_TYPES, WHITENING_TYPES } from './crown-smile.js';
import { FILLING_TYPES, EXTRACTION_TYPES } from './filling-extraction.js';

// Every type-card model by key (data-model in the page). New treatments add their builders here.
const BUILDERS = { ...RCT_TYPES, ...BRACES_TYPES, ...CROWN_TYPES, ...VENEER_TYPES, ...WHITENING_TYPES, ...FILLING_TYPES, ...EXTRACTION_TYPES };

export function buildTypeModel(kit, key) {
  if (BUILDERS[key]) return BUILDERS[key](kit);
  return implantType(kit, key);
}
