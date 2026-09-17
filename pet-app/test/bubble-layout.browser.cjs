'use strict';
// Optional real-layout regression, no npm/browser download dependencies:
// node test/bubble-layout.browser.cjs /path/to/chrome [--baseline]
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

function fixture(css) {
  const html = fs.readFileSync(path.join(__dirname, '../src/index.html'), 'utf8')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<link\b[^>]*>/gi, '')
    .replace('</head>', `<style>${css}</style></head>`);
  return `<!doctype html><meta charset="utf-8"><iframe id="pet"></iframe><script>
    const frame = document.getElementById('pet');
    frame.onload = () => {
      const doc = frame.contentDocument, win = frame.contentWindow;
      const node = id => doc.getElementById(id);
      const box = el => {const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
      const results = [];
      for (const scale of [1,1.25,1.5,2]) for (const preset of ['classic','minimal','debug'])
      for (const text of ['Activity area is too small for this group. Enlarge it in Settings.', '这是一段需要完整行边界的中文提示。'.repeat(80), 'long_unbroken_text_'.repeat(80)]) {
        const container=node('pet-container'),bubble=node('speech-bubble'),span=node('status-text'),art=node('art-stage'),label=node('state-label');
        frame.width=Math.round(200*scale);frame.height=Math.round(240*scale);
        container.className='motion-intrinsic preset-'+preset+' anim-idle';
        container.dataset.identity='always';container.dataset.stateLabel='always';container.dataset.bubbleVisible='true';
        container.style.width=frame.width+'px';container.style.height=frame.height+'px';
        for (const el of [art,node('ferris-wrapper')]) {el.style.width=Math.round(140*scale)+'px';el.style.height=Math.round(140*scale)+'px';}
        node('session-name').textContent='Layout test';node('session-name').style.fontSize=Math.round(12*scale)+'px';
        node('state-gem').hidden=true;label.hidden=false;label.style.fontSize=Math.round(12*scale)+'px';
        bubble.classList.remove('hidden');bubble.style.transition='none';bubble.style.transform='none';bubble.style.maxWidth=Math.round(180*scale)+'px';
        span.style.fontSize=Math.round(13*scale)+'px';span.textContent=text;
        const b=box(bubble),t=box(span),c=box(container),a=box(art),l=box(label),n=box(node('session-name')),style=win.getComputedStyle(bubble);
        results.push({scale,preset,dpr:win.devicePixelRatio,bubble:b,text:t,container:c,art:a,label:l,name:n,
          textInside:t.bottom<=b.bottom-parseFloat(style.paddingBottom)-parseFloat(style.borderBottomWidth)+1,
          artInside:a.bottom<=c.bottom+1,labelInside:l.bottom<=c.bottom+1,nameInside:n.bottom<=c.bottom+1,
          lineHeight:parseFloat(win.getComputedStyle(span).lineHeight)});
      }
      const result=document.createElement('script');result.type='application/json';result.id='layout-results';result.textContent=JSON.stringify(results);document.body.appendChild(result);
    };
    frame.srcdoc=${JSON.stringify(html)};
  </script>`;
}

if (require.main === module) {
  const browser = process.argv[2];
  if (!browser) throw new Error('Supply an installed Chrome/Chromium executable; this test never downloads one.');
  const css = process.argv.includes('--baseline')
    ? cp.execFileSync('git', ['show', 'HEAD:pet-app/src/style.css'], { cwd: path.resolve(__dirname, '../..'), encoding: 'utf8' })
    : fs.readFileSync(path.join(__dirname, '../src/style.css'), 'utf8');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-bubble-layout-'));
  const file = path.join(dir, 'fixture.html');
  fs.writeFileSync(file, fixture(css));
  try {
    for (const dpr of [1,1.25]) {
      const run = cp.spawnSync(browser, ['--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
        '--no-first-run', '--disable-background-networking', '--disable-extensions', '--disable-sync',
        '--password-store=basic', '--user-data-dir='+path.join(dir,'profile-'+dpr), '--force-device-scale-factor='+dpr,
        '--virtual-time-budget=1500', '--dump-dom', pathToFileURL(file).href], { encoding:'utf8',timeout:30000,maxBuffer:2*1024*1024 });
      fs.writeFileSync(path.join(dir, 'browser-'+dpr+'.log'), run.stderr || '');
      assert.equal(run.status, 0, run.error?.message || run.stderr);
      const match = run.stdout.match(/<script type="application\/json" id="layout-results">([\s\S]*?)<\/script>/);
      assert.ok(match, 'browser did not finish fixture');
      const rows = JSON.parse(match[1]);fs.writeFileSync(path.join(dir, 'measurements-'+dpr+'.json'), JSON.stringify(rows,null,2));
      assert.equal(rows.length, 36);
      for (const row of rows) assert.ok(row.textInside && row.artInside && row.labelInside && row.nameInside, JSON.stringify(row));
      console.log('PASS: 36 text/scale/preset cases at DPR '+dpr);
    }
  } finally { console.log('Layout artifacts: '+dir); }
}
module.exports = { fixture };
