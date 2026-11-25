const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isCompact = () => window.matchMedia('(max-width: 860px)').matches;

const HERO_SCENE = `
  <div class="bh-scene-glow"></div>
  <div class="bh-scene-inner">
    <svg class="bh-stadium-svg" viewBox="0 0 760 380" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="bhSky" cx="50%" cy="74%" r="68%">
          <stop offset="0" stop-color="#2c74ad" stop-opacity=".58" />
          <stop offset=".55" stop-color="#143d5e" stop-opacity=".26" />
          <stop offset="1" stop-color="#06101b" stop-opacity="0" />
        </radialGradient>
        <linearGradient id="bhBowl" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#1c3d59" />
          <stop offset="1" stop-color="#081523" />
        </linearGradient>
        <linearGradient id="bhTurf" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#1e6d4e" />
          <stop offset="1" stop-color="#0a3025" />
        </linearGradient>
        <linearGradient id="bhBeam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#c6efff" stop-opacity=".32" />
          <stop offset="1" stop-color="#c6efff" stop-opacity="0" />
        </linearGradient>
        <pattern id="bhCrowd" width="10" height="10" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" fill="#a7dcf1" opacity=".6" />
          <circle cx="7" cy="6" r=".85" fill="#e8c37a" opacity=".45" />
        </pattern>
        <filter id="bhLampGlow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>

      <ellipse cx="380" cy="292" rx="356" ry="120" fill="url(#bhSky)" />
      <ellipse cx="380" cy="294" rx="340" ry="124" fill="url(#bhBowl)" stroke="#78c9e8" stroke-opacity=".28" stroke-width="2" />
      <ellipse cx="380" cy="294" rx="340" ry="124" fill="url(#bhCrowd)" opacity=".5" />
      <ellipse cx="380" cy="288" rx="298" ry="106" fill="#112b41" stroke="#78c9e8" stroke-opacity=".26" stroke-width="1.5" />
      <ellipse cx="380" cy="288" rx="298" ry="106" fill="url(#bhCrowd)" opacity=".42" />
      <ellipse cx="380" cy="282" rx="258" ry="88" fill="#0d2235" stroke="#78c9e8" stroke-opacity=".22" stroke-width="1.2" />
      <ellipse cx="380" cy="282" rx="258" ry="88" fill="url(#bhCrowd)" opacity=".32" />
      <ellipse cx="380" cy="278" rx="220" ry="72" fill="#091827" stroke="#8b6cff" stroke-opacity=".28" stroke-width="1" />

      <polygon points="262,232 498,232 566,318 194,318" fill="url(#bhTurf)" stroke="#c4f5dc" stroke-opacity=".38" stroke-width="1.5" />
      <polygon points="274,240 486,240 540,309 220,309" fill="none" stroke="#e0ffef" stroke-opacity=".44" stroke-width="1.2" />
      <line x1="380" y1="240" x2="380" y2="309" stroke="#e0ffef" stroke-opacity=".44" stroke-width="1.2" />
      <ellipse cx="380" cy="274" rx="34" ry="13" fill="none" stroke="#e0ffef" stroke-opacity=".44" stroke-width="1.2" />
      <polygon points="312,240 448,240 442,253 318,253" fill="none" stroke="#e0ffef" stroke-opacity=".3" stroke-width="1" />
      <polygon points="318,296 442,296 448,309 312,309" fill="none" stroke="#e0ffef" stroke-opacity=".3" stroke-width="1" />

      <g class="bh-beams">
        <path class="bh-beam" d="M96 208 L118 96 L152 96 L174 208 Z" fill="url(#bhBeam)" />
        <path class="bh-beam" d="M586 208 L608 96 L642 96 L664 208 Z" fill="url(#bhBeam)" />
        <path class="bh-beam" d="M226 200 L240 126 L262 126 L276 200 Z" fill="url(#bhBeam)" opacity=".6" />
        <path class="bh-beam" d="M484 200 L498 126 L520 126 L534 200 Z" fill="url(#bhBeam)" opacity=".6" />
        <g stroke="#678ea7" stroke-width="2">
          <line x1="135" y1="208" x2="135" y2="96" />
          <line x1="625" y1="208" x2="625" y2="96" />
        </g>
        <g stroke="#678ea7" stroke-width="1.2" opacity=".7">
          <line x1="251" y1="200" x2="251" y2="126" />
          <line x1="509" y1="200" x2="509" y2="126" />
        </g>
        <g fill="#eafaff">
          <circle cx="135" cy="94" r="5" />
          <circle cx="625" cy="94" r="5" />
          <circle cx="251" cy="124" r="3.5" opacity=".85" />
          <circle cx="509" cy="124" r="3.5" opacity=".85" />
        </g>
        <g fill="#bfeeff" opacity=".55" filter="url(#bhLampGlow)">
          <circle cx="135" cy="94" r="13" />
          <circle cx="625" cy="94" r="13" />
        </g>
      </g>
    </svg>

    <div class="bh-crest">
      <img src="./public/escudo-baba-humildes-web.png" alt="" width="60" height="64" decoding="async">
    </div>
    <div class="bh-ball-wrap"><div class="bh-ball"></div></div>
    <div class="bh-particles"></div>
  </div>
`;

let revealObserver = null;
let pageTimer = null;
let scheduled = false;

function addParticles(scene) {
  const holder = $('.bh-particles', scene);
  if (!holder || holder.childElementCount) return;
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < 16; i += 1) {
    const particle = document.createElement('span');
    particle.className = 'bh-particle';
    particle.style.left = `${36 + Math.random() * 62}%`;
    particle.style.setProperty('--drift', `${Math.round(Math.random() * 60 - 30)}px`);
    particle.style.setProperty('--dur', `${(9 + Math.random() * 9).toFixed(1)}s`);
    particle.style.setProperty('--delay', `${(-Math.random() * 14).toFixed(1)}s`);
    particle.style.width = particle.style.height = `${2 + Math.round(Math.random() * 2)}px`;
    fragment.appendChild(particle);
  }
  holder.appendChild(fragment);
}

function bindParallax(hero, scene) {
  if (hero.dataset.bhParallax || prefersReducedMotion || isCompact()) return;
  hero.dataset.bhParallax = '1';
  hero.addEventListener('pointermove', event => {
    const rect = hero.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 20;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 14;
    scene.style.setProperty('--bh-mx', `${x.toFixed(1)}px`);
    scene.style.setProperty('--bh-my', `${y.toFixed(1)}px`);
  });
  hero.addEventListener('pointerleave', () => {
    scene.style.setProperty('--bh-mx', '0px');
    scene.style.setProperty('--bh-my', '0px');
  });
}

function buildHeroScene(hero) {
  if (!hero || $('.bh-scene', hero)) return;
  const scene = document.createElement('div');
  scene.className = 'bh-scene';
  scene.setAttribute('aria-hidden', 'true');
  scene.innerHTML = HERO_SCENE;
  hero.prepend(scene);
  if (!prefersReducedMotion && !isCompact()) addParticles(scene);
  bindParallax(hero, scene);
}

function animateCounters(root) {
  if (prefersReducedMotion) return;
  $$('.stat-value', root).forEach(element => {
    if (element.dataset.bhCounted) return;
    const textNode = Array.from(element.childNodes).find(
      node => node.nodeType === Node.TEXT_NODE && /\d/.test(node.textContent)
    );
    if (!textNode) return;
    const match = textNode.textContent.match(/^(\s*)(\d+(?:\.\d+)?)(.*)$/);
    if (!match) return;
    const target = Number(match[2]);
    if (!Number.isFinite(target) || target > 1000000) return;
    element.dataset.bhCounted = '1';
    const duration = 900;
    const start = performance.now();
    const step = now => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = progress >= 1 ? target : Math.round(target * eased);
      textNode.textContent = `${match[1]}${value}${match[3]}`;
      if (progress < 1) requestAnimationFrame(step);
    };
    textNode.textContent = `${match[1]}0${match[3]}`;
    requestAnimationFrame(step);
  });
}

function parseCurrency(text) {
  const raw = String(text || '').replace(/\s/g, '');
  const digits = raw.replace(/[^\d,]/g, '').replace(/\./g, '').replace(',', '.');
  const value = Number(digits);
  return raw.startsWith('-') ? -value : value;
}

function addFinanceChart(root) {
  const title = $('#pageTitle')?.textContent || '';
  if (!title.includes('Financeiro')) return;
  const grid = $('.panel .stats-grid', root);
  const panel = grid?.closest('.panel');
  if (!panel) return;

  const labels = ['Arrecadação', 'Despesas', 'Saldo', 'A cobrar'];
  const values = $$('.stat-card', grid).slice(0, 4).map(card =>
    parseCurrency($('.stat-value', card)?.textContent)
  );
  if (values.length !== 4 || values.some(value => !Number.isFinite(value))) return;

  const signature = values.join('|');
  let chart = $('.bh-chart', panel);
  if (chart?.dataset.signature === signature) return;
  if (!chart) {
    chart = document.createElement('div');
    chart.className = 'bh-chart';
    panel.appendChild(chart);
  }
  chart.dataset.signature = signature;
  const max = Math.max(...values.map(Math.abs), 1);
  chart.innerHTML = `
    <div class="bh-chart-title">FLUXO DA TEMPORADA</div>
    ${labels.map((label, index) => `
      <div class="bh-chart-row">
        <span>${label}</span>
        <div class="bh-chart-track"><i data-width="${Math.max(3, Math.abs(values[index]) / max * 100).toFixed(1)}%"></i></div>
        <b>${values[index] < 0 ? '- ' : ''}R$ ${Math.abs(values[index]).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
      </div>
    `).join('')}
  `;
  requestAnimationFrame(() => {
    $$('.bh-chart-track i', chart).forEach(bar => {
      bar.style.width = bar.dataset.width;
    });
  });
}

function setupReveals(root) {
  if (prefersReducedMotion || !('IntersectionObserver' in window)) return;
  const selector = [
    '.panel', '.stat-card', '.team-card', '.notice-card', '.referee-card',
    '.athlete-row', '.home-match-card', '.home-matchup', '.memory-year',
    '.memory-card', '.table-wrap', '.cards-grid > *'
  ].join(',');
  const targets = $$(selector, root).filter(element => !element.dataset.bhReveal);
  if (!targets.length) return;
  targets.forEach(element => {
    element.dataset.bhReveal = '1';
    element.classList.add('bh-reveal');
  });
  if (!revealObserver) {
    revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.06, rootMargin: '0px 0px -32px 0px' });
  }
  targets.forEach(element => revealObserver.observe(element));
}

function enhance() {
  const content = $('#appContent');
  if (!content || !content.firstElementChild || $('.loading-state', content)) return;
  buildHeroScene($('.hero', content));
  animateCounters(content);
  addFinanceChart(content);
  setupReveals(content);
}

function scheduleEnhance() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    enhance();
  });
}

function playPageTransition() {
  if (prefersReducedMotion) return;
  const content = $('#appContent');
  if (!content) return;
  content.classList.remove('bh-page-enter');
  void content.offsetWidth;
  content.classList.add('bh-page-enter');
  clearTimeout(pageTimer);
  pageTimer = setTimeout(() => content.classList.remove('bh-page-enter'), 700);
}

function setupMobileMenu() {
  const sidebar = $('#sidebar');
  if (!sidebar || $('.sidebar-backdrop')) return;
  const backdrop = document.createElement('div');
  backdrop.className = 'sidebar-backdrop';
  backdrop.setAttribute('aria-hidden', 'true');
  document.body.appendChild(backdrop);
  backdrop.addEventListener('click', () => sidebar.classList.remove('open'));
  const sync = () => backdrop.classList.toggle('show', sidebar.classList.contains('open'));
  new MutationObserver(sync).observe(sidebar, { attributes: true, attributeFilter: ['class'] });
  sync();
}

function initVisualLayer() {
  document.documentElement.classList.add('bh-enhanced');
  setupMobileMenu();
  enhance();

  const content = $('#appContent');
  if (content && 'MutationObserver' in window) {
    new MutationObserver(scheduleEnhance).observe(content, { childList: true, subtree: true });
  }

  document.addEventListener('click', event => {
    if (event.target.closest('#navigation .nav-item, [data-goto], [data-page]')) {
      requestAnimationFrame(playPageTransition);
    }
  });

  window.addEventListener('resize', () => {
    if (!isCompact()) addParticles($('.bh-scene'));
  }, { passive: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initVisualLayer, { once: true });
} else {
  initVisualLayer();
}
