/* Event theme presets shared by the broadcast control panel. */
(() => {
  const names=['boundary-ripple','orbital-rays','stadium-surge','impact-ribbons','lightning-grid','halo-pulse','starburst-field','radial-bloom','shard-break','spotlight-ring'];
  const labels=['Boundary Ripple','Orbital Rays','Stadium Surge','Impact Ribbons','Lightning Grid','Halo Pulse','Starburst Field','Radial Bloom','Shard Break','Spotlight Ring'];
  window.JangidEventAnimationThemes={names,labels,events:['FOUR','SIX','WICKET'],defaultFor:{FOUR:names[0],SIX:names[2],WICKET:names[8]}};
})();