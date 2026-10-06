import { buildImplantStory } from '../implant-story.js';

export function build(kit) {
  const s = buildImplantStory(kit);
  const A = s.anchors;
  return {
    group: s.group,
    layout: 'wide',
    state: s.state,
    update: s.update,
    labels: [
      { group: 'heroParts', text: 'Crown', anchor: A.heroCrown },
      { group: 'heroParts', text: 'Abutment', anchor: A.heroAbutment },
      { group: 'heroParts', text: 'Implant', anchor: A.heroImplant },
      { group: 'gap', text: 'Missing tooth', anchor: A.gap },
      { group: 'plan', text: 'Planned position and angle', anchor: A.plan },
      { group: 'implant', text: 'Implant in the bone', anchor: A.implant },
      { group: 'month', text: () => `Healing: month ${s.state.month}`, anchor: A.month },
      { group: 'abutment', text: 'Abutment', anchor: A.abutment },
      { group: 'crown', text: 'Shade matched', anchor: A.crown },
      { group: 'bite', text: 'Bite checked', anchor: A.bite },
    ],
  };
}
