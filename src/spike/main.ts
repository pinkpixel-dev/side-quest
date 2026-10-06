import './spike.css';
import { GemmaClient, type GemmaState } from '../lib/gemma/client';
import { IMAGE_BUDGETS, MODELS, formatBytes, type ModelKey } from '../lib/gemma/models';
import { preparePhoto, type PreparedImage } from '../lib/images/preprocess';
import { extractJson } from '../lib/ai/extract-json';
import { RARITIES, SPIKE_QUESTS, SYSTEM_PROMPT, questPrompt } from './prompts';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const gemma = new GemmaClient();
const report: Record<string, string> = {};
let photo: PreparedImage | null = null;
let photoUrl: string | null = null;
let busy = false;

// --- environment ---------------------------------------------------------------

const nav = navigator as Navigator & { deviceMemory?: number; gpu?: unknown };
report.browser = navigator.userAgent;
report.secureContext = String(window.isSecureContext);
report.webgpu = String('gpu' in nav);
report.deviceMemory = nav.deviceMemory ? `${nav.deviceMemory} GB` : 'n/a';
$('env').textContent = `WebGPU ${'gpu' in nav ? 'yes' : 'NO'} · secure ${window.isSecureContext ? 'yes' : 'NO'} · RAM ${report.deviceMemory}`;

// Ask the browser not to evict the model cache. Safari is the one most likely to evict.
navigator.storage?.persist?.().then((granted) => (report.persistentStorage = String(granted)));

// --- controls ------------------------------------------------------------------

const modelBox = $('models');
modelBox.innerHTML = '<legend class="dim">Which build</legend>';
for (const m of Object.values(MODELS)) {
  const label = document.createElement('label');
  label.className = 'choice';
  label.innerHTML = `<input type="radio" name="model" value="${m.key}" ${m.key === 'e2b-mobile' ? 'checked' : ''} />
    <span>${m.label}<br /><span class="mono dim">${formatBytes(m.approxBytes)} download</span></span>`;
  modelBox.append(label);
}

const questSelect = $<HTMLSelectElement>('quest');
SPIKE_QUESTS.forEach((q, i) => questSelect.add(new Option(q.title, String(i))));

const budgetSelect = $<HTMLSelectElement>('budget');
IMAGE_BUDGETS.forEach((b) => budgetSelect.add(new Option(String(b), String(b), b === 140, b === 140)));

const selectedModel = () =>
  (modelBox.querySelector<HTMLInputElement>('input[name=model]:checked')?.value ?? 'e2b-mobile') as ModelKey;

$('load').addEventListener('click', () => gemma.load(selectedModel()));

$<HTMLInputElement>('photo').addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const started = performance.now();
    photo = await preparePhoto(file);
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    photoUrl = URL.createObjectURL(photo.blob);
    const img = $<HTMLImageElement>('preview');
    img.src = photoUrl;
    img.hidden = false;
    const info = `${formatBytes(file.size)} → ${photo.width}×${photo.height}, ${formatBytes(photo.blob.size)} in ${Math.round(performance.now() - started)} ms`;
    $('photo-info').textContent = info;
    report.photo = info;
  } catch (err) {
    $('photo-info').textContent = `Couldn't read that image: ${(err as Error).message}`;
    photo = null;
  }
  syncButtons();
});

$('run').addEventListener('click', analyze);

$('copy').addEventListener('click', async () => {
  const text = Object.entries(report)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
  try {
    await navigator.clipboard.writeText(text);
    $('copy').textContent = 'Copied';
  } catch {
    $('raw').textContent = text;
    $('copy').textContent = 'Copy failed, report shown above';
  }
  setTimeout(() => ($('copy').textContent = 'Copy report'), 2000);
});

// --- model state ---------------------------------------------------------------

function syncButtons() {
  const loading = gemma.state.status === 'loading';
  $<HTMLButtonElement>('load').disabled = loading || busy;
  $<HTMLButtonElement>('run').disabled = gemma.state.status !== 'ready' || !photo || busy;
  modelBox.querySelectorAll('input').forEach((i) => (i.disabled = loading || busy));
}

gemma.subscribe((s: GemmaState) => {
  const status = $('status');
  const bar = $('bar');
  status.classList.toggle('error', s.status === 'error');
  switch (s.status) {
    case 'off':
      status.textContent = 'Not loaded';
      bar.style.transform = 'scaleX(0)';
      break;
    case 'loading': {
      const frac = s.total ? s.loaded / s.total : 0;
      bar.style.transform = `scaleX(${frac})`;
      const where = s.adapter ? ` on ${s.adapter}${s.f16 ? ' (f16)' : ''}` : '';
      status.textContent = s.total
        ? `Loading${where}: ${formatBytes(s.loaded)} / ${formatBytes(s.total)}`
        : `Starting${where}…`;
      break;
    }
    case 'ready':
      bar.style.transform = 'scaleX(1)';
      status.textContent = `Ready on ${s.adapter}${s.f16 ? ' (f16)' : ''} in ${(s.loadMs / 1000).toFixed(1)} s`;
      Object.assign(report, {
        model: MODELS[s.model].label,
        adapter: s.adapter,
        shaderF16: String(s.f16),
        loadSeconds: (s.loadMs / 1000).toFixed(1),
      });
      break;
    case 'error':
      status.textContent = `Error: ${s.message}`;
      report.loadError = s.message;
      break;
  }
  syncButtons();
});

// --- analyze -------------------------------------------------------------------

async function analyze() {
  if (!photo || busy) return;
  busy = true;
  syncButtons();
  const quest = SPIKE_QUESTS[Number(questSelect.value)];
  const rarity = RARITIES[Math.floor(Math.random() * RARITIES.length)];
  const raw = $('raw');
  const parsed = $('parsed');
  raw.textContent = '';
  parsed.textContent = '';
  $('stats').innerHTML = '';
  $('run').textContent = 'Looking…';

  try {
    const result = await gemma.generate(
      {
        system: SYSTEM_PROMPT,
        prompt: questPrompt(quest, rarity),
        image: photo.blob,
        imageBudget: Number(budgetSelect.value),
        maxTokens: 320,
      },
      (chunk) => (raw.textContent += chunk),
    );
    const json = extractJson(result.text);
    parsed.textContent = json ? JSON.stringify(json, null, 2) : 'No valid JSON in the output.';
    parsed.classList.toggle('error', !json);

    const stats = {
      quest: quest.title,
      imageBudget: budgetSelect.value,
      imageTokens: String(result.stats.imageTokens),
      firstTokenSeconds: (result.stats.firstTokenMs / 1000).toFixed(1),
      tokensPerSecond: result.stats.tokensPerSecond.toFixed(1),
      outputTokens: String(result.stats.tokens),
      validJson: String(!!json),
    };
    Object.assign(report, stats, { output: result.text.replace(/\s+/g, ' ').trim() });
    $('stats').innerHTML = Object.entries(stats)
      .map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`)
      .join('');
    $<HTMLButtonElement>('copy').disabled = false;
  } catch (err) {
    parsed.textContent = `Failed: ${(err as Error).message}`;
    parsed.classList.add('error');
    report.runError = (err as Error).message;
    $<HTMLButtonElement>('copy').disabled = false;
  } finally {
    busy = false;
    $('run').textContent = 'Analyze';
    syncButtons();
  }
}
