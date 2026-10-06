// Treatment-page 3D stories, loaded only on the page that needs them.
export const STORIES = {
  implant: () => import('./implant.js'),
  rct: () => import('./rct.js'),
  braces: () => import('./braces.js'),
  crown: () => import('./crown.js'),
  veneer: () => import('./veneer.js'),
  whitening: () => import('./whitening.js'),
  // filling: () => import('./filling.js'),
  // extraction: () => import('./extraction.js'),
  // denture: () => import('./denture.js'),
  // partial: () => import('./partial.js'),
};
