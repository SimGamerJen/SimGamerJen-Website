(() => {
  const map = document.querySelector('.architecture-map');
  const svg = map?.querySelector('.architecture-lines');
  if (!map || !svg) return;

  const NS = 'http://www.w3.org/2000/svg';
  const selectors = {
    payroll: '.node-helper-payroll',
    profiles: '.node-helper-profiles',
    dispatcher: '.node-remote-dispatcher',
    avatar: '.node-avatar-switcher',
    autodrive: '.node-autodrive',
    courseplay: '.node-courseplay',
    silage: '.node-silage-realism',
    pastures: '.node-managed-pastures',
    nutrition: '.node-precision-nutrition',
    cco: '.node-cco',
    fsm: '.node-fsm'
  };

  const edges = [
    { from: 'payroll', to: 'profiles', type: 'confirmed', fromSide: 'right', toSide: 'left', fromAt: .5, toAt: .5, route: 'horizontal' },
    { from: 'dispatcher', to: 'profiles', type: 'confirmed', fromSide: 'right', toSide: 'left', fromAt: .42, toAt: .82, route: 'archUp', bend: 26 },
    { from: 'profiles', to: 'avatar', type: 'optional', fromSide: 'bottom', toSide: 'top', fromAt: .72, toAt: .22, route: 'vertical' },
    { from: 'dispatcher', to: 'avatar', type: 'optional', fromSide: 'right', toSide: 'left', fromAt: .82, toAt: .82, route: 'archDown', bend: 54 },
    { from: 'dispatcher', to: 'autodrive', type: 'third', fromSide: 'right', toSide: 'left', fromAt: .18, toAt: .52, route: 'archUp', bend: 92 },
    { from: 'dispatcher', to: 'courseplay', type: 'third', fromSide: 'right', toSide: 'left', fromAt: .62, toAt: .5, route: 'archUp', bend: 30 },
    { from: 'silage', to: 'nutrition', type: 'optional', fromSide: 'right', toSide: 'left', fromAt: .5, toAt: .42, route: 'horizontal' },
    { from: 'pastures', to: 'nutrition', type: 'optional', fromSide: 'right', toSide: 'left', fromAt: .46, toAt: .78, route: 'archUp', bend: 24 },
    { from: 'pastures', to: 'silage', type: 'optional', fromSide: 'top', toSide: 'bottom', fromAt: .52, toAt: .52, route: 'vertical' },
    { from: 'cco', to: 'fsm', type: 'tooling', fromSide: 'right', toSide: 'left', fromAt: .52, toAt: .52, route: 'horizontal' }
  ];

  const styles = {
    confirmed: { stroke: '#4ca77a', marker: 'arrow-confirmed', dash: '' },
    optional: { stroke: '#c88719', marker: 'arrow-optional', dash: '9 8' },
    third: { stroke: '#71839a', marker: 'arrow-third', dash: '2 7' },
    tooling: { stroke: '#8b45d8', marker: 'arrow-tooling', dash: '9 7' }
  };

  function point(el, side, at, mapRect) {
    const r = el.getBoundingClientRect();
    const x0 = r.left - mapRect.left;
    const y0 = r.top - mapRect.top;
    if (side === 'left') return { x: x0, y: y0 + r.height * at };
    if (side === 'right') return { x: x0 + r.width, y: y0 + r.height * at };
    if (side === 'top') return { x: x0 + r.width * at, y: y0 };
    return { x: x0 + r.width * at, y: y0 + r.height };
  }

  function pathData(a, b, edge) {
    const dx = Math.max(34, Math.abs(b.x - a.x) * .34);
    const dy = Math.max(28, Math.abs(b.y - a.y) * .5);
    const bend = edge.bend || 0;
    if (edge.route === 'vertical') {
      const dir = b.y >= a.y ? 1 : -1;
      return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} C ${a.x.toFixed(1)} ${(a.y + dy * dir).toFixed(1)}, ${b.x.toFixed(1)} ${(b.y - dy * dir).toFixed(1)}, ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
    }
    if (edge.route === 'archUp') {
      const controlY = Math.min(a.y, b.y) - bend;
      return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} C ${(a.x + dx).toFixed(1)} ${controlY.toFixed(1)}, ${(b.x - dx).toFixed(1)} ${controlY.toFixed(1)}, ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
    }
    if (edge.route === 'archDown') {
      const controlY = Math.max(a.y, b.y) + bend;
      return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} C ${(a.x + dx).toFixed(1)} ${controlY.toFixed(1)}, ${(b.x - dx).toFixed(1)} ${controlY.toFixed(1)}, ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
    }
    return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} C ${(a.x + dx).toFixed(1)} ${a.y.toFixed(1)}, ${(b.x - dx).toFixed(1)} ${b.y.toFixed(1)}, ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
  }

  function draw() {
    svg.querySelectorAll(':scope > path').forEach(path => path.remove());
    if (window.matchMedia('(max-width: 950px)').matches) return;

    const mapRect = map.getBoundingClientRect();
    if (!mapRect.width || !mapRect.height) return;
    svg.setAttribute('viewBox', `0 0 ${mapRect.width} ${mapRect.height}`);
    svg.setAttribute('preserveAspectRatio', 'none');

    edges.forEach(edge => {
      const fromEl = map.querySelector(selectors[edge.from]);
      const toEl = map.querySelector(selectors[edge.to]);
      if (!fromEl || !toEl) return;
      const a = point(fromEl, edge.fromSide, edge.fromAt, mapRect);
      const b = point(toEl, edge.toSide, edge.toAt, mapRect);
      const style = styles[edge.type];
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', pathData(a, b, edge));
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', style.stroke);
      path.setAttribute('stroke-width', '3');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('vector-effect', 'non-scaling-stroke');
      if (style.dash) path.setAttribute('stroke-dasharray', style.dash);
      path.setAttribute('marker-end', `url(#${style.marker})`);
      svg.appendChild(path);
    });
  }

  let frame = 0;
  const scheduleDraw = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(draw);
  };

  window.addEventListener('load', scheduleDraw, { once: true });
  window.addEventListener('resize', scheduleDraw, { passive: true });
  document.fonts?.ready?.then(scheduleDraw);
  if ('ResizeObserver' in window) new ResizeObserver(scheduleDraw).observe(map);
  scheduleDraw();
})();
