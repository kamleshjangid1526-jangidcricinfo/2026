/* Event theme presets shared by the broadcast control panel. */
(() => {
  const names=["boundary-ripple","orbital-rays","stadium-surge","impact-ribbons","lightning-grid","halo-pulse","starburst-field","radial-bloom","shard-break","spotlight-ring","laser-sweep","velocity-trails","split-impact","pulse-tunnel","chromatic-wave","stadium-flash","ribbon-burst","glass-shatter","orbit-launch","impact-digital"];
  const labels=["Boundary Ripple","Orbital Rays","Stadium Surge","Impact Ribbons","Lightning Grid","Halo Pulse","Starburst Field","Radial Bloom","Shard Break","Spotlight Ring","Laser Sweep","Velocity Trails","Split Impact","Pulse Tunnel","Chromatic Wave","Stadium Flash","Ribbon Burst","Glass Shatter","Orbit Launch","Impact Digital"];
  window.JangidEventAnimationThemes={names,labels,events:['FOUR','SIX','WICKET'],defaultFor:{FOUR:names[0],SIX:names[2],WICKET:names[8]}};
})();