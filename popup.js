const ext = (typeof browser !== 'undefined') ? browser : chrome;

const btnGet    = document.getElementById('btn-get');
const btnCopy   = document.getElementById('btn-copy');
const output    = document.getElementById('output');
const domainBdg = document.getElementById('domain-badge');
const countBdg  = document.getElementById('count-badge');
const countNum  = document.getElementById('count-num');
const footerTs  = document.getElementById('footer-ts');

let currentJson = '';

async function getActiveTabUrl() {
  const [tab] = await ext.tabs.query({ active: true, currentWindow: true });
  return tab?.url ?? null;
}

async function fetchAllCookies(url) {
  const { hostname } = new URL(url);
  const cleanDomain = hostname.replace(/^www\./, '');
  let allCookies = [];
  
  try {
    const byDomain = await ext.cookies.getAll({ domain: cleanDomain });
    allCookies = allCookies.concat(byDomain);
  } catch (e) {}
  
  if (!cleanDomain.startsWith('www.')) {
    try {
      const byWwwDomain = await ext.cookies.getAll({ domain: 'www.' + cleanDomain });
      allCookies = allCookies.concat(byWwwDomain);
    } catch (e) {}
  }
  
  try {
    const byUrl = await ext.cookies.getAll({ url });
    allCookies = allCookies.concat(byUrl);
  } catch (e) {}
  
  const parts = cleanDomain.split('.');
  if (parts.length > 2) {
    const rootDomain = '.' + parts.slice(-2).join('.');
    try {
      const byRoot = await ext.cookies.getAll({ domain: rootDomain });
      allCookies = allCookies.concat(byRoot);
    } catch (e) {}
  }
  
  const seen = new Map();
  for (const c of allCookies) {
    if (!seen.has(c.name)) {
      seen.set(c.name, c);
    }
  }
  
  return Array.from(seen.values());
}

function cookiesToObject(cookies) {
  const obj = {};
  for (const c of cookies) {
    let key = c.name || '(unnamed)';
    if (key in obj) {
      let i = 2;
      while (`${key}_${i}` in obj) i++;
      key = `${key}_${i}`;
    }
    obj[key] = c.value;
  }
  return obj;
}

function renderJson(obj) {
  const entries = Object.entries(obj);

  if (entries.length === 0) {
    output.innerHTML = `
      <div class="state-empty">
        <div class="emoji">🤷</div>
        <div>No cookies found<br>for this domain</div>
      </div>`;
    return;
  }

  const lines = entries.map(([k, v], i) => {
    const comma = i < entries.length - 1 ? '<span class="j-comma">,</span>' : '';
    const keyHtml  = `<span class="j-key">"${escHtml(k)}"</span>`;
    const valHtml  = `<span class="j-str">"${escHtml(v)}"</span>`;
    return `<div class="j-entry">&nbsp;&nbsp;${keyHtml}<span class="j-brace">:</span>&nbsp;${valHtml}${comma}</div>`;
  });

  output.innerHTML = `
    <div class="json-root">
      <span class="j-brace">{</span>
      ${lines.join('')}
      <span class="j-brace">}</span>
    </div>`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function setLoading(on) {
  btnGet.disabled = on;
  btnGet.innerHTML = on
    ? `<span class="loading">⏳</span>&nbsp;LOADING…`
    : `<svg width="13" height="13" viewBox="0 0 13 13" fill="none">
         <circle cx="6.5" cy="6.5" r="5.5" stroke="#0d0f14" stroke-width="1.6"/>
         <path d="M6.5 3.5V6.5L8.5 8" stroke="#0d0f14" stroke-width="1.6" stroke-linecap="round"/>
       </svg> GET COOKIES`;
}

btnGet.addEventListener('click', async () => {
  setLoading(true);
  btnCopy.disabled = true;
  btnCopy.classList.remove('copied');
  countBdg.style.display = 'none';
  currentJson = '';

  try {
    const url = await getActiveTabUrl();

    if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
      throw new Error('Page not supported (use http/https).');
    }

    const { hostname } = new URL(url);
    domainBdg.textContent = hostname;

    const cookies = await fetchAllCookies(url);
    const obj     = cookiesToObject(cookies);
    currentJson = JSON.stringify(obj, null, 2);

    renderJson(obj);

    const n = Object.keys(obj).length;
    countNum.textContent = n;
    countBdg.style.display = 'flex';
    footerTs.textContent = new Date().toLocaleTimeString('en-US');

    if (n > 0) btnCopy.disabled = false;

  } catch (err) {
    output.innerHTML = `<div class="state-error">⚠️ ${escHtml(err.message)}</div>`;
    domainBdg.textContent = 'error';
  } finally {
    setLoading(false);
  }
});

btnCopy.addEventListener('click', async () => {
  if (!currentJson) return;
  try {
    await navigator.clipboard.writeText(currentJson);
    btnCopy.textContent = '✓ COPIED';
    btnCopy.classList.add('copied');
    setTimeout(() => {
      btnCopy.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.3"/>
        <path d="M3 8H2a1 1 0 01-1-1V2a1 1 0 011-1h5a1 1 0 011 1v1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
      </svg> COPY JSON`;
      btnCopy.classList.remove('copied');
    }, 1800);
  } catch {
    btnCopy.textContent = '✗ Error';
  }
});