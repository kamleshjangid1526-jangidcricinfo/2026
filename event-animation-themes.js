/* Ten transparent cricket-event animations and ten gentle player-card motions. */
(() => {
  const names=['fireworks-burst','umpire-signal','stadium-lights','shockwave-rings','gold-confetti','neon-wave','lightning-flash','comet-trail','pulse-tunnel','trophy-spin'];
  const labels=['Fireworks Burst','Umpire Boundary Signal','Stadium Lights Sweep','Shockwave Rings','Gold Confetti','Neon Wave','Lightning Flash','Comet Ball Trail','Pulse Tunnel','Trophy Spin'];
  const cardMotions=['soft-pop','glass-reveal','halo-lift','prism-flip','spotlight-rise','confetti-float','smooth-zoom','orbit-reveal','trophy-glow','ribbon-sweep'];
  const cardLabels=['Soft Pop','Glass Reveal','Halo Lift','Prism Flip','Spotlight Rise','Confetti Float','Smooth Zoom','Orbit Reveal','Trophy Glow','Ribbon Sweep'];
  window.JangidEventAnimationThemes={names,labels,cardMotions,cardLabels,events:['FOUR','SIX','WICKET','FREE HIT'],defaultFor:{FOUR:names[0],SIX:names[7],WICKET:names[1],'FREE HIT':names[2]}};
})();
