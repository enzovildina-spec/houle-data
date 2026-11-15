/* Houle - téléphone en vertical : la liste (panneau) se replie pour laisser la carte seule.
   Un clic sur la poignée, ou un glissement du doigt vers le bas / le haut. */
(function () {
  const H = (globalThis.Houle = globalThis.Houle || {});
  const A = H.app;
  const grip = document.getElementById('panelGrip'), stage = document.querySelector('.stage'), txt = document.getElementById('gripTxt');
  if (!grip || !stage) return;

  const set = (full) => {
    stage.classList.toggle('is-mapfull', !!full);
    grip.setAttribute('aria-expanded', String(!full));
    grip.setAttribute('aria-label', full ? 'Remonter la liste' : 'Replier la liste pour voir la carte seule');
    txt.textContent = full ? 'Glisser vers le haut : la liste' : 'Glisser vers le bas : carte seule';
    // la carte change de taille : on la remet d'aplomb après la mise en page
    setTimeout(() => { try { A.S.mapObj && A.S.mapObj.invalidate && A.S.mapObj.invalidate(); } catch (e) { /* carte pas prête */ } }, 60);
  };
  A.panelFull = set;
  H.panel = { isFull: () => stage.classList.contains('is-mapfull'), set };

  let y0 = null, moved = false;
  grip.addEventListener('pointerdown', (e) => { y0 = e.clientY; moved = false; try { grip.setPointerCapture(e.pointerId); } catch (x) { /* ignoré */ } });
  grip.addEventListener('pointermove', (e) => { if (y0 !== null && Math.abs(e.clientY - y0) > 8) moved = true; });
  grip.addEventListener('pointerup', (e) => {
    if (y0 === null) return;
    const dy = e.clientY - y0; y0 = null;
    if (moved && Math.abs(dy) >= 24) set(dy > 0); // vers le bas = carte seule, vers le haut = liste
    else if (!moved) set(!H.panel.isFull());
  });
  grip.addEventListener('pointercancel', () => { y0 = null; });
  grip.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown') { set(true); e.preventDefault(); } else if (e.key === 'ArrowUp') { set(false); e.preventDefault(); } });
})();
