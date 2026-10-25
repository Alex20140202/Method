/* =========================================================
   METHOD — workspace application
   ========================================================= */

import {
  store, TEMPLATES, NODE_COLORS, relativeTime, formatTime,
  greeting, escapeHtml, uid,
} from './store.js';
import { CanvasEditor } from './canvas.js';
import { Collab, PEOPLE_COLORS } from './collab.js';
import { askAI, QUICK_PROMPTS } from './ai.js';

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const pad = (n) => String(n).padStart(2, '0');

const state = {
  view: 'dashboard',
  projectId: null,
  peers: [],
  template: 'blank',
  filter: 'all',
  query: '',
  aiBusy: false,
  confirmAction: null,
  onboardingColor: 'violet',
  settingsColor: 'violet',
  publishedUrl: null,
  saveTimer: null,
  aiTimer: null,
};

let canvas;
let collab;

/* =========================================================
   Helpers
   ========================================================= */
function openOverlay(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('is-open');
  el.setAttribute('aria-hidden', 'false');
  document.documentElement.classList.add('lock');
  const focusable = el.querySelector('input, textarea, button');
  if (focusable) setTimeout(() => focusable.focus(), 80);
}

function closeOverlay(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('is-open');
  el.setAttribute('aria-hidden', 'true');
  if (!document.querySelector('.overlay.is-open')) {
    document.documentElement.classList.remove('lock');
  }
}

function toast(message, type = 'info') {
  const wrap = $('#toasts');
  if (!wrap) return;
  const icons = { info: '✦', success: '✓', warn: '!', collab: '◉' };
  const item = document.createElement('div');
  item.className = `toast toast--${type}`;
  item.innerHTML = `<span class="toast__icon">${icons[type] || '✦'}</span><span></span>`;
  item.lastElementChild.textContent = message;
  wrap.appendChild(item);
  requestAnimationFrame(() => item.classList.add('is-in'));
  setTimeout(() => {
    item.classList.remove('is-in');
    setTimeout(() => item.remove(), 300);
  }, 2800);
  while (wrap.children.length > 3) wrap.firstElementChild.remove();
}

function initials(name = '') {
  const trimmed = name.trim();
  if (!trimmed) return 'M';
  if (/[\u4e00-\u9fa5]/.test(trimmed)) return trimmed.slice(0, 1);
  return trimmed.slice(0, 2).toUpperCase();
}

const colorHex = (c) => PEOPLE_COLORS[c] || PEOPLE_COLORS.violet;

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }
}

function download(filename, content, type = 'application/json') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

const slugify = (text) =>
  (text || 'method')
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'method';

/* =========================================================
   Theme + user
   ========================================================= */
function applyTheme(theme, { persist = true } = {}) {
  document.documentElement.setAttribute('data-theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'light' ? '#f7f7fb' : '#05060a');
  $$('#themeChoices .theme-choice').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.themeChoice === theme);
  });
  if (persist) store.setTheme(theme);
}

function toggleTheme() {
  applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
}

function renderUser() {
  const user = store.state.user || { name: '创造者', color: 'violet' };
  const name = user.name;
  $('#sidebarName').textContent = name;
  $('#sidebarAvatar').textContent = initials(name);
  $('#sidebarAvatar').className = `avatar avatar--${user.color}`;
  $('#topbarAvatar').textContent = initials(name);
  $('#topbarAvatar').className = `avatar avatar--${user.color} topbar__avatar`;
  $('#userName').textContent = name;
  $('#onboardingName').value = store.state.user ? name : '';
  $('#settingsName').value = name;
  state.settingsColor = user.color;
  state.onboardingColor = user.color;
  fillColorRows();
}

function fillColorRows() {
  const build = (container, selected, handler) => {
    if (!container) return;
    container.innerHTML = NODE_COLORS.map((c) => `
      <button type="button" class="swatch swatch--${c} ${c === selected ? 'is-active' : ''}"
        data-color="${c}" aria-label="${c}" title="${c}"></button>
    `).join('');
    container.onclick = (e) => {
      const btn = e.target.closest('[data-color]');
      if (!btn) return;
      container.querySelectorAll('.swatch').forEach((s) => s.classList.remove('is-active'));
      btn.classList.add('is-active');
      handler(btn.dataset.color);
    };
  };
  build($('#onboardingColors'), state.onboardingColor, (c) => { state.onboardingColor = c; });
  build($('#settingsColors'), state.settingsColor, (c) => { state.settingsColor = c; });
}

/* =========================================================
   Routing / views
   ========================================================= */
function showView(name) {
  state.view = name;
  $$('.view').forEach((view) => view.classList.toggle('is-active', view.id === `view-${name}`));
  $$('.nav-item').forEach((item) => item.classList.toggle('is-active', item.dataset.view === name));
  document.title = name === 'editor' ? `${$('#projectTitle').value || '项目'} — METHOD` : '工作台 — METHOD';
  const crumbs = $('#crumbs');
  if (name === 'editor') {
    const project = store.getProject(state.projectId);
    crumbs.innerHTML = `<span>工作台</span><i>/</i><strong>${escapeHtml(project?.title || '项目')}</strong>`;
  } else {
    const labels = { dashboard: '工作台', activity: '活动', settings: '设置' };
    crumbs.innerHTML = `<span>${labels[name] || '工作台'}</span>`;
  }
  if (name === 'dashboard') renderDashboard();
  if (name === 'activity') renderActivity();
  if (name === 'settings') syncSettings();
  closeSidebar();
}

function setHash(projectId) {
  if (projectId) history.replaceState(null, '', `#project=${projectId}`);
  else history.replaceState(null, '', location.pathname + location.search);
}

/* =========================================================
   Dashboard
   ========================================================= */
function renderDashboard() {
  const user = store.state.user || { name: '创造者' };
  $('#greeting').textContent = greeting();
  $('#userName').textContent = user.name;

  const stats = store.stats();
  $('#statProjects').textContent = stats.projects;
  $('#statNodes').textContent = stats.nodes;
  $('#statVersions').textContent = stats.versions;
  $('#statPublished').textContent = stats.published;

  const projects = [...store.state.projects]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .filter((p) => {
      if (state.filter === 'published') return Boolean(p.publishedAt);
      if (state.filter === 'draft') return !p.publishedAt;
      return true;
    })
    .filter((p) => {
      if (!state.query) return true;
      return p.title.toLowerCase().includes(state.query.toLowerCase());
    });

  const grid = $('#projectGrid');
  grid.innerHTML = projects.map(projectCard).join('');
  $('#emptyProjects').hidden = projects.length > 0;
  grid.hidden = projects.length === 0;

  const recent = [...store.state.projects].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);
  $('#recentCount').textContent = store.state.projects.length;
  $('#recentProjects').innerHTML = recent.map((p) => `
    <button class="recent-item" data-open="${p.id}">
      <span class="recent-item__emoji">${escapeHtml(p.emoji || '✦')}</span>
      <span class="recent-item__text">
        <strong>${escapeHtml(p.title)}</strong>
        <small>${relativeTime(p.updatedAt)}</small>
      </span>
      ${p.publishedAt ? '<span class="recent-item__live" title="已发布"></span>' : ''}
    </button>
  `).join('');
}

function projectCard(project) {
  return `
    <article class="project-card" data-open="${project.id}" tabindex="0" role="button" aria-label="打开 ${escapeHtml(project.title)}">
      <div class="project-card__cover cover--${project.cover}">
        <div class="project-card__glow"></div>
        <span class="project-card__emoji">${escapeHtml(project.emoji || '✦')}</span>
        <div class="project-card__badges">
          ${project.publishedAt ? '<span class="badge badge--live"><i></i>已发布</span>' : '<span class="badge">草稿</span>'}
          <span class="badge badge--ghost">${project.nodes.length} 块</span>
        </div>
        <div class="card-menu">
          <button class="card-menu__trigger" data-menu="${project.id}" aria-label="项目菜单">···</button>
          <div class="card-menu__list" data-menu-list="${project.id}">
            <button data-act="open" data-id="${project.id}">打开</button>
            <button data-act="duplicate" data-id="${project.id}">创建副本</button>
            <button data-act="publish" data-id="${project.id}">发布</button>
            <button data-act="delete" data-id="${project.id}" class="is-danger">删除</button>
          </div>
        </div>
      </div>
      <div class="project-card__body">
        <div class="project-card__text">
          <h3>${escapeHtml(project.title)}</h3>
          <p>更新于 ${relativeTime(project.updatedAt)}</p>
        </div>
        <div class="project-card__foot">
          <span class="project-card__versions">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" stroke-linecap="round"/><path d="M3 3v5h5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            ${project.versions.length} 个版本
          </span>
          <span class="project-card__open">打开 →</span>
        </div>
      </div>
    </article>
  `;
}

function renderActivity() {
  const list = $('#activityList');
  const items = store.state.activity;
  if (!items.length) {
    list.innerHTML = '<div class="empty"><div class="empty__mark">◌</div><h3>还没有活动</h3><p>创建第一个项目后，这里会记录你的每一步。</p></div>';
    return;
  }
  const icons = { create: '＋', update: '✎', publish: '↑', version: '◷', restore: '↺', delete: '×' };
  list.innerHTML = items.map((item) => {
    const project = item.projectId ? store.getProject(item.projectId) : null;
    return `
      <div class="activity-item ${project ? 'is-clickable' : ''}" ${project ? `data-open="${project.id}"` : ''}>
        <span class="activity-item__icon activity-item__icon--${item.type}">${icons[item.type] || '·'}</span>
        <div class="activity-item__body">
          <p>${escapeHtml(item.text)}</p>
          <small>${formatTime(item.at)}${project ? ` · ${escapeHtml(project.title)}` : ''}</small>
        </div>
        <span class="activity-item__time">${relativeTime(item.at)}</span>
      </div>
    `;
  }).join('');
}

/* =========================================================
   New project
   ========================================================= */
function renderTemplates() {
  const grid = $('#templateGrid');
  grid.innerHTML = TEMPLATES.map((tpl) => `
    <button class="template-card ${tpl.id === state.template ? 'is-active' : ''}" data-template="${tpl.id}">
      <span class="template-card__cover cover--${tpl.cover}">${tpl.icon}</span>
      <strong>${tpl.name}</strong>
      <small>${tpl.desc}</small>
      <span class="template-card__check">✓</span>
    </button>
  `).join('');
}

function openNewProject() {
  state.template = 'blank';
  $('#projectName').value = '';
  renderTemplates();
  openOverlay('newProjectModal');
  setTimeout(() => $('#projectName').focus(), 120);
}

function createProject() {
  const title = $('#projectName').value.trim() || '未命名项目';
  const project = store.createProject({ title, templateId: state.template });
  closeOverlay('newProjectModal');
  renderDashboard();
  openProject(project.id);
  requestAnimationFrame(() => canvas.fitContent());
  toast('项目已创建，开始吧', 'success');
}

/* =========================================================
   Editor
   ========================================================= */
function setSaveState(mode) {
  const el = $('#saveState');
  if (!el) return;
  el.classList.toggle('is-saving', mode === 'saving');
  el.innerHTML = `<i></i>${mode === 'saving' ? '保存中…' : '已保存'}`;
}

function openProject(id, { push = true } = {}) {
  const project = store.getProject(id);
  if (!project) { toast('项目不存在或已被删除', 'warn'); return; }
  state.projectId = id;
  store.state.lastProjectId = id;
  store.save();

  $('#projectTitle').value = project.title;
  $('#projectEmoji').textContent = project.emoji || '✦';
  showView('editor');
  canvas.load(project);
  collab.setProject(id);
  collab.setUser(store.state.user);
  setSaveState('saved');
  updateNodeCount(project.nodes.length);
  renderVersions();
  resetAI(project);
  if (push) setHash(id);
  requestAnimationFrame(() => {
    canvas.applyView();
    if (!canvas.hasVisibleContent()) canvas.fitContent();
  });
  $('#projectTitle').blur();
}

function leaveEditor() {
  canvas?.finishEditing();
  const project = store.getProject(state.projectId);
  if (project) { project.updatedAt = Date.now(); store.save(); }
  collab.setProject(null);
  state.projectId = null;
  setHash(null);
  showView('dashboard');
}

function updateNodeCount(count) {
  $('#nodeCountChip').textContent = `${count} 个内容块`;
}

function updateCollabUI() {
  const peers = state.peers;
  const presence = $('#presence');
  presence.innerHTML = peers.slice(0, 4).map((peer) => `
    <span class="presence__avatar avatar--${peer.color}" title="${escapeHtml(peer.name)}">${initials(peer.name)}</span>
  `).join('') + (peers.length > 4 ? `<span class="presence__more">+${peers.length - 4}</span>` : '');
  const text = $('#collabText');
  if (text) text.textContent = peers.length ? `${peers.length + 1} 人协作中` : '仅自己';
  $('#collabStatus')?.classList.toggle('is-live', peers.length > 0);
  peers.forEach((peer) => canvas?.setPeerCursor(peer.clientId, peer));
  if (canvas) {
    [...canvas.remoteCursors.keys()].forEach((id) => {
      if (!peers.some((p) => p.clientId === id)) canvas.setPeerCursor(id, null);
    });
  }
}

/* =========================================================
   Versions
   ========================================================= */
function openVersions() {
  renderVersions();
  $('#versionsDrawer').classList.add('is-open');
  $('#versionsDrawer').setAttribute('aria-hidden', 'false');
  $('#drawerBackdrop').classList.add('is-visible');
}

function closeVersions() {
  $('#versionsDrawer').classList.remove('is-open');
  $('#versionsDrawer').setAttribute('aria-hidden', 'true');
  $('#drawerBackdrop').classList.remove('is-visible');
}

function renderVersions() {
  const project = store.getProject(state.projectId);
  const list = $('#versionList');
  if (!project) { list.innerHTML = ''; return; }
  $('#versionSub').textContent = `${project.versions.length} 个版本 · 全部保存在本地`;
  if (!project.versions.length) {
    list.innerHTML = `
      <div class="version-empty">
        <span>◷</span>
        <strong>还没有版本</strong>
        <p>点击上方按钮保存当前画布，之后可以随时回滚。</p>
      </div>`;
    return;
  }
  const versions = [...project.versions].sort((a, b) => b.at - a.at);
  list.innerHTML = versions.map((version, i) => `
    <div class="version-item">
      <div class="version-item__dot ${i === 0 ? 'is-current' : ''}"></div>
      <div class="version-item__body">
        <div class="version-item__head">
          <strong>${escapeHtml(version.label)}</strong>
          ${i === 0 ? '<span class="version-tag">最新</span>' : ''}
        </div>
        <small>${formatTime(version.at)} · ${version.nodes.length} 个内容块</small>
        <div class="version-item__actions">
          <button class="mini-link" data-restore="${version.id}">回滚到此版本</button>
          <button class="mini-link mini-link--danger" data-delete-version="${version.id}">删除</button>
        </div>
      </div>
    </div>
  `).join('');
}

function saveVersion() {
  const project = store.getProject(state.projectId);
  if (!project) return;
  const version = store.addVersion(project.id, `版本 ${project.versions.length + 1}`);
  renderVersions();
  toast(`已保存「${version.label}」`, 'success');
  setSaveState('saved');
}

/* =========================================================
   AI panel
   ========================================================= */
function resetAI(project) {
  const messages = $('#aiMessages');
  messages.innerHTML = '';
  addAIMessage('bot', `我在。这个画布有 ${project.nodes.length} 个内容块${project.nodes.length ? '，我可以继续往下搭' : '，现在还很空，正适合开始'}。\n\n需要我帮你搭结构、写文案、推荐配色，还是整理一下布局？`);
  renderQuickPrompts();
}

function renderQuickPrompts() {
  $('#aiQuick').innerHTML = QUICK_PROMPTS.map((prompt) =>
    `<button class="ai-chip" data-prompt="${escapeHtml(prompt)}">${escapeHtml(prompt)}</button>`).join('');
}

function addAIMessage(role, text) {
  const messages = $('#aiMessages');
  const item = document.createElement('div');
  item.className = `ai-msg ai-msg--${role}`;
  if (role === 'bot') {
    const avatar = document.createElement('span');
    avatar.className = 'ai-msg__avatar';
    avatar.textContent = 'M';
    item.appendChild(avatar);
  }
  const bubble = document.createElement('div');
  bubble.className = 'ai-msg__bubble';
  bubble.textContent = text;
  item.appendChild(bubble);
  messages.appendChild(item);
  messages.scrollTop = messages.scrollHeight;
  return item;
}

function addTyping() {
  const messages = $('#aiMessages');
  const item = document.createElement('div');
  item.className = 'ai-msg ai-msg--bot ai-msg--typing';
  item.innerHTML = `<span class="ai-msg__avatar">M</span><div class="ai-msg__bubble"><span class="typing"><i></i><i></i><i></i></span></div>`;
  messages.appendChild(item);
  messages.scrollTop = messages.scrollHeight;
  return item;
}

function askAIPanel(prompt) {
  if (state.aiBusy) return;
  const text = (prompt || $('#aiInput').value).trim();
  if (!text) return;
  state.aiBusy = true;
  addAIMessage('user', text);
  $('#aiInput').value = '';
  autoSizeAI();
  const typing = addTyping();

  clearTimeout(state.aiTimer);
  state.aiTimer = setTimeout(() => {
    typing.remove();
    const project = store.getProject(state.projectId);
    const vp = canvas.viewport;
    const center = {
      x: (vp.clientWidth / 2 - canvas.view.x) / canvas.view.zoom,
      y: (vp.clientHeight / 2 - canvas.view.y) / canvas.view.zoom,
    };
    const result = askAI(text, {
      nodes: canvas.nodes,
      projectTitle: project?.title,
      center,
    });
    addAIMessage('bot', result.text);

    if (result.action?.type === 'addNodes' && result.action.nodes?.length) {
      const placed = placeNewNodes(result.action.nodes);
      const added = canvas.addNodes(placed);
      canvas.focusNodes(added);
      toast(`AI 已在画布上添加 ${result.action.nodes.length} 个内容块`, 'success');
    } else if (result.action?.type === 'arrange') {
      canvas.arrange();
      toast('已重新整理画布布局', 'success');
    }
    state.aiBusy = false;
  }, 620);
}

function placeNewNodes(nodes) {
  if (!canvas.nodes.length) return nodes;
  const maxX = Math.max(...canvas.nodes.map((n) => n.x + n.w));
  const minY = Math.min(...canvas.nodes.map((n) => n.y));
  const minXNew = Math.min(...nodes.map((n) => n.x));
  const minYNew = Math.min(...nodes.map((n) => n.y));
  const dx = maxX + 120 - minXNew;
  const dy = minY - minYNew;
  return nodes.map((n) => ({ ...n, x: Math.round(n.x + dx), y: Math.round(n.y + dy) }));
}

function toggleAI() {
  const panel = $('#aiPanel');
  const hidden = panel.classList.contains('is-hidden') || panel.classList.contains('is-open');
  if (window.innerWidth <= 1180) {
    panel.classList.toggle('is-open');
  } else {
    panel.classList.toggle('is-hidden');
  }
  if (window.innerWidth <= 1180 ? panel.classList.contains('is-open') : !panel.classList.contains('is-hidden')) {
    setTimeout(() => $('#aiInput').focus(), 150);
  }
}

function autoSizeAI() {
  const input = $('#aiInput');
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
}

/* =========================================================
   Publish
   ========================================================= */
function openPublish() {
  const project = store.getProject(state.projectId);
  if (!project) return;
  $('#publishName').textContent = project.title;
  $('#publishNodes').textContent = project.nodes.length;
  $('#publishVersions').textContent = project.versions.length;
  $('#publishResult').hidden = true;
  $('#downloadHtmlBtn').hidden = true;
  $('#publishPreview').innerHTML = miniPreview(project);
  openOverlay('publishModal');
}

function miniPreview(project) {
  const nodes = project.nodes;
  if (!nodes.length) return '<div class="mini-empty">画布还是空的</div>';
  const minX = Math.min(...nodes.map((n) => n.x));
  const minY = Math.min(...nodes.map((n) => n.y));
  const maxX = Math.max(...nodes.map((n) => n.x + n.w));
  const maxY = Math.max(...nodes.map((n) => n.y + n.h));
  const w = maxX - minX || 1;
  const h = maxY - minY || 1;
  const scale = Math.min(330 / w, 170 / h, 0.34);
  const body = nodes.map((n) => `
    <span class="mini-node mini-node--${n.type} c-${n.color}" style="
      left:${(n.x - minX) * scale}px;top:${(n.y - minY) * scale}px;
      width:${Math.max(4, n.w * scale)}px;height:${Math.max(3, n.h * scale)}px;
      border-radius:${Math.max(2, (n.radius ?? 16) * scale)}px;"></span>
  `).join('');
  return `<div class="mini-map"><div class="mini-map__inner" style="width:${w * scale}px;height:${h * scale}px">${body}</div></div>`;
}

function buildPublishedHTML(project) {
  const nodes = project.nodes || [];
  const edges = project.edges || [];
  const minX = nodes.length ? Math.min(...nodes.map((n) => n.x)) : 0;
  const minY = nodes.length ? Math.min(...nodes.map((n) => n.y)) : 0;
  const maxX = nodes.length ? Math.max(...nodes.map((n) => n.x + n.w)) : 800;
  const maxY = nodes.length ? Math.max(...nodes.map((n) => n.y + n.h)) : 600;
  const padPx = 80;
  const width = Math.max(720, maxX - minX + padPx * 2);
  const height = Math.max(420, maxY - minY + padPx * 2);
  const offsetX = padPx - minX;
  const offsetY = padPx - minY;

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const paths = edges.map((edge) => {
    const a = byId.get(edge.from);
    const b = byId.get(edge.to);
    if (!a || !b) return '';
    const ax = a.x + a.w + offsetX;
    const ay = a.y + a.h / 2 + offsetY;
    const bx = b.x + offsetX;
    const by = b.y + b.h / 2 + offsetY;
    const dx = Math.max(50, Math.abs(bx - ax) * 0.45);
    return `<path d="M ${ax} ${ay} C ${ax + dx} ${ay}, ${bx - dx} ${by}, ${bx} ${by}" />`;
  }).join('');

  const nodeHtml = nodes.map((n) => {
    const style = `left:${n.x + offsetX}px;top:${n.y + offsetY}px;width:${n.w}px;height:${n.h}px;`;
    if (n.type === 'text') {
      return `<div class="pub-text size-${n.size || 'md'}" style="${style}">${escapeHtml(n.text)}</div>`;
    }
    if (n.type === 'shape') {
      return `<div class="pub-shape c-${n.color}" style="${style};border-radius:${Math.min(n.radius ?? 999, n.h / 2)}px">${escapeHtml(n.text)}</div>`;
    }
    return `<div class="pub-note c-${n.color}" style="${style};border-radius:${n.radius ?? 18}px">
      <span class="pub-note__bar"></span><div>${escapeHtml(n.text)}</div>
    </div>`;
  }).join('');

  const date = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="generator" content="METHOD" />
<title>${escapeHtml(project.title)} — METHOD</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #05060a; color: #f3f4f8; font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; -webkit-font-smoothing: antialiased; }
  .page { position: relative; min-height: 100vh; overflow: hidden; }
  .page::before { content: ""; position: fixed; inset: 0; background: radial-gradient(70% 50% at 10% 0%, rgba(124,92,255,.24), transparent 60%), radial-gradient(60% 50% at 92% 20%, rgba(0,229,200,.16), transparent 65%), radial-gradient(50% 40% at 50% 100%, rgba(255,95,162,.12), transparent 70%); pointer-events: none; }
  .pub-head { position: relative; max-width: 1100px; margin: 0 auto; padding: 72px 32px 30px; text-align: center; }
  .pub-brand { display: inline-flex; align-items: center; gap: 8px; font-family: "Space Grotesk", ui-sans-serif, sans-serif; font-size: .72rem; letter-spacing: .3em; color: #6d7286; text-transform: uppercase; margin-bottom: 22px; }
  .pub-brand::before { content: "◆"; color: #7c5cff; }
  h1 { font-family: "Space Grotesk", ui-sans-serif, sans-serif; font-size: clamp(2.2rem, 5vw, 3.6rem); letter-spacing: -.04em; line-height: 1.06; margin: 0 0 14px; }
  .pub-meta { color: #6d7286; font-size: .8rem; letter-spacing: .04em; }
  .pub-board-wrap { position: relative; max-width: 1160px; margin: 0 auto; padding: 20px 32px 60px; }
  .pub-board-frame { position: relative; margin: 0 auto; }
  .pub-board { position: absolute; top: 0; left: 50%; transform-origin: top center; border: 1px solid rgba(255,255,255,.08); border-radius: 26px; background-color: rgba(255,255,255,.015); background-image: radial-gradient(rgba(255,255,255,.075) 1px, transparent 1px); background-size: 24px 24px; box-shadow: 0 40px 120px -50px rgba(124,92,255,.55); }
  .pub-board svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
  .pub-board path { fill: none; stroke: rgba(160,170,255,.3); stroke-width: 1.4; }
  .pub-text { position: absolute; white-space: pre-wrap; overflow: hidden; line-height: 1.35; letter-spacing: -.02em; font-weight: 500; color: #f3f4f8; }
  .pub-text.size-sm { font-size: 15px; line-height: 1.6; color: #a6abbd; font-weight: 400; }
  .pub-text.size-md { font-size: 18px; line-height: 1.6; color: #c9cbd8; font-weight: 400; }
  .pub-text.size-lg { font-size: 32px; font-weight: 600; }
  .pub-text.size-xl { font-size: 48px; font-weight: 700; letter-spacing: -.04em; }
  .pub-note { position: absolute; background: #0f111b; border: 1px solid rgba(255,255,255,.09); padding: 18px 18px 18px 20px; white-space: pre-wrap; overflow: hidden; font-size: 14px; line-height: 1.6; color: #c9cbd8; box-shadow: 0 20px 50px -30px rgba(0,0,0,.9); }
  .pub-note__bar { position: absolute; left: 0; top: 16px; bottom: 16px; width: 2px; border-radius: 2px; background: var(--c, #7c5cff); }
  .pub-shape { position: absolute; display: grid; place-items: center; text-align: center; padding: 0 14px; font-size: 14px; font-weight: 600; color: #fff; background: linear-gradient(120deg, var(--c, #7c5cff), rgba(0,229,200,.9)); box-shadow: 0 14px 34px -16px var(--c, #7c5cff); }
  .c-violet { --c: #7c5cff; } .c-cyan { --c: #00e5c8; } .c-pink { --c: #ff5fa2; }
  .c-amber { --c: #ffb86b; } .c-green { --c: #34d399; } .c-slate { --c: #8c92a6; }
  .pub-foot { position: relative; max-width: 1100px; margin: 0 auto; padding: 0 32px 56px; display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; color: #4b5068; font-size: .72rem; letter-spacing: .06em; border-top: 1px solid rgba(255,255,255,.06); padding-top: 24px; }
  .pub-foot strong { color: #8c92a6; font-weight: 500; }
  @media (max-width: 720px) { .pub-head { padding-top: 48px; } .pub-board-wrap { padding-inline: 16px; } .pub-text.size-xl { font-size: 36px; } .pub-text.size-lg { font-size: 26px; } }
</style>
</head>
<body>
  <div class="page">
    <header class="pub-head">
      <div class="pub-brand">Method · Canvas</div>
      <h1>${escapeHtml(project.title)}</h1>
      <p class="pub-meta">${nodes.length} 个内容块 · 发布于 ${date}</p>
    </header>
    <div class="pub-board-wrap">
      <div class="pub-board-frame" style="width:${width}px;height:${height}px">
        <div class="pub-board" style="width:${width}px;height:${height}px">
          <svg viewBox="0 0 ${width} ${height}" aria-hidden="true">${paths}</svg>
          ${nodeHtml}
        </div>
      </div>
    </div>
    <footer class="pub-foot">
      <span>Made with <strong>METHOD</strong> · 本地优先的创作工作台</span>
      <span>${escapeHtml(project.title)}</span>
    </footer>
  </div>
  <script>
    (function () {
      var frame = document.querySelector('.pub-board-frame');
      var board = document.querySelector('.pub-board');
      var wrap = document.querySelector('.pub-board-wrap');
      function fit() {
        var w = board.offsetWidth || 1;
        var h = board.offsetHeight || 1;
        var avail = Math.max(260, wrap.clientWidth - 64);
        var s = Math.min(1, avail / w);
        board.style.transform = 'translateX(-50%) scale(' + s + ')';
        frame.style.width = (w * s) + 'px';
        frame.style.height = (h * s) + 'px';
      }
      fit();
      window.addEventListener('resize', fit);
      setTimeout(fit, 80);
    })();
  </script>
</body>
</html>`;
}

function doPublish() {
  const project = store.getProject(state.projectId);
  if (!project) return;
  if (!project.nodes.length) { toast('画布还是空的，先放点内容吧', 'warn'); return; }
  store.addVersion(project.id, '发布快照');

  const html = buildPublishedHTML(project);
  if (state.publishedUrl) URL.revokeObjectURL(state.publishedUrl);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  state.publishedUrl = url;

  window.open(url, '_blank', 'noopener');

  const downloadBtn = $('#downloadHtmlBtn');
  downloadBtn.href = url;
  downloadBtn.download = `${slugify(project.title)}.html`;
  downloadBtn.hidden = false;

  $('#publishResult').hidden = false;
  $('#publishResultText').textContent = '发布页面已生成，并在新标签页打开；也可以下载 HTML 自行托管。';
  $('#publishVersions').textContent = project.versions.length;
  $('#publishNodes').textContent = project.nodes.length;

  store.markPublished(project.id);
  renderVersions();
  toast('已发布，并保存了发布快照', 'success');
}

/* =========================================================
   Share
   ========================================================= */
function projectMarkdown(project) {
  const sorted = [...project.nodes].sort((a, b) => (a.y - b.y) || (a.x - b.x));
  const lines = [`# ${project.title}`, ''];
  sorted.forEach((node) => {
    const text = (node.text || '').trim();
    if (!text) return;
    if (node.type === 'text' && (node.size === 'xl' || node.size === 'lg')) {
      lines.push(`## ${text.replace(/\n/g, ' ')}`, '');
    } else if (node.type === 'shape') {
      lines.push(`- **${text}**`);
    } else {
      lines.push(text, '');
    }
  });
  lines.push('---', `由 METHOD 导出 · ${new Date().toLocaleString('zh-CN')}`);
  return lines.join('\n');
}

async function shareAction(type) {
  const project = store.getProject(state.projectId);
  if (!project) return;
  if (type === 'link') {
    const url = `${location.origin}${location.pathname}#project=${project.id}`;
    const ok = await copyText(url);
    toast(ok ? '项目链接已复制' : '复制失败，请手动复制', ok ? 'success' : 'warn');
  }
  if (type === 'markdown') {
    const ok = await copyText(projectMarkdown(project));
    toast(ok ? 'Markdown 已复制' : '复制失败', ok ? 'success' : 'warn');
  }
  if (type === 'json') {
    const ok = await copyText(JSON.stringify(project, null, 2));
    toast(ok ? '项目 JSON 已复制' : '复制失败', ok ? 'success' : 'warn');
  }
  closeOverlay('shareModal');
}

/* =========================================================
   Settings
   ========================================================= */
function syncSettings() {
  const user = store.state.user || { name: '创造者', color: 'violet' };
  $('#settingsName').value = user.name;
  state.settingsColor = user.color;
  fillColorRows();
  applyTheme(document.documentElement.getAttribute('data-theme'), { persist: false });
}

function saveProfile() {
  const name = $('#settingsName').value.trim();
  if (!name) { toast('名字不能为空', 'warn'); return; }
  store.setUser(name, state.settingsColor);
  renderUser();
  renderDashboard();
  toast('资料已更新', 'success');
}

function openConfirm(title, text, okLabel, fn, danger = true) {
  $('#confirmTitle').textContent = title;
  $('#confirmText').textContent = text;
  const ok = $('#confirmOk');
  ok.textContent = okLabel || '确认';
  ok.className = `btn ${danger ? 'btn--danger' : 'btn--primary'}`;
  state.confirmAction = fn;
  openOverlay('confirmModal');
}

/* =========================================================
   Command palette
   ========================================================= */
let paletteCommands = [];
let paletteIndex = 0;

function buildPaletteCommands() {
  const cmds = [
    { label: '回到工作台', hint: '视图', icon: '⌂', run: () => showView('dashboard') },
    { label: '新建项目', hint: '操作', icon: '＋', run: openNewProject },
    { label: '活动记录', hint: '视图', icon: '≈', run: () => showView('activity') },
    { label: '设置', hint: '视图', icon: '⚙', run: () => showView('settings') },
    { label: '切换明暗主题', hint: '外观', icon: '◐', run: toggleTheme },
  ];
  if (state.projectId) {
    cmds.push(
      { label: '保存一个版本', hint: '项目', icon: '◷', run: saveVersion },
      { label: '打开版本时光机', hint: '项目', icon: '↺', run: openVersions },
      { label: '发布当前项目', hint: '项目', icon: '↑', run: openPublish },
      { label: '适应画布', hint: '画布', icon: '⛶', run: () => canvas.fitContent() },
      { label: '和 AI 对话', hint: '画布', icon: '✦', run: () => { toggleAI(); setTimeout(() => $('#aiInput')?.focus(), 120); } },
    );
  }
  const projectCmds = [...store.state.projects]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((p) => ({
      label: p.title,
      hint: '项目',
      icon: p.emoji || '✦',
      run: () => openProject(p.id),
    }));
  return [...cmds, ...projectCmds];
}

function renderPalette(query = '') {
  const q = query.trim().toLowerCase();
  const filtered = paletteCommands.filter((c) =>
    c.label.toLowerCase().includes(q) || c.hint.toLowerCase().includes(q));
  paletteIndex = 0;
  const list = $('#paletteList');
  if (!filtered.length) {
    list.innerHTML = '<div class="palette__empty">没有找到相关命令</div>';
    return;
  }
  list.innerHTML = filtered.map((c, i) => `
    <button class="palette__item ${i === 0 ? 'is-active' : ''}" data-index="${i}">
      <span class="palette__icon">${c.icon}</span>
      <span>${escapeHtml(c.label)}</span>
      <small>${c.hint}</small>
    </button>
  `).join('');
  list._filtered = filtered;
}

function openPalette() {
  paletteCommands = buildPaletteCommands();
  const input = $('#paletteInput');
  input.value = '';
  renderPalette('');
  openOverlay('palette');
  setTimeout(() => input.focus(), 80);
}

function closePalette() { closeOverlay('palette'); }

function movePalette(dir) {
  const items = $$('.palette__item', $('#paletteList'));
  if (!items.length) return;
  paletteIndex = (paletteIndex + dir + items.length) % items.length;
  items.forEach((item, i) => item.classList.toggle('is-active', i === paletteIndex));
  items[paletteIndex].scrollIntoView({ block: 'nearest' });
}

function runPalette(index) {
  const filtered = $('#paletteList')._filtered || [];
  const cmd = filtered[index];
  if (!cmd) return;
  closePalette();
  setTimeout(() => cmd.run(), 60);
}

/* =========================================================
   Sidebar / responsive
   ========================================================= */
function openSidebar() {
  $('#sidebar').classList.add('is-open');
  $('#sidebarBackdrop').classList.add('is-visible');
}
function closeSidebar() {
  $('#sidebar').classList.remove('is-open');
  $('#sidebarBackdrop').classList.remove('is-visible');
}

/* =========================================================
   Canvas + collab wiring
   ========================================================= */
function initCanvas() {
  canvas = new CanvasEditor({
    viewport: $('#canvasViewport'),
    world: $('#canvasWorld'),
    nodeLayer: $('#nodeLayer'),
    edgeLayer: $('#edgeLayer'),
    cursorLayer: $('#cursorLayer'),
    onCommit: ({ nodes, edges }) => {
      const project = store.getProject(state.projectId);
      if (!project) return;
      project.nodes = nodes;
      project.edges = edges;
      project.updatedAt = Date.now();
      store.save();
      collab?.sendState({ nodes, edges });
      setSaveState('saving');
      updateNodeCount(nodes.length);
      clearTimeout(state.saveTimer);
      state.saveTimer = setTimeout(() => setSaveState('saved'), 450);
      if (state.view === 'editor') {
        const first = nodes[0];
        $('#nodeCountChip').textContent = `${nodes.length} 个内容块`;
        if (first) { /* noop */ }
      }
    },
    onSelection: (selection, payload) => renderSelectionBar(selection, payload),
    onCursor: (cursor) => collab?.sendCursor(cursor),
    onView: (view) => {
      const project = store.getProject(state.projectId);
      if (project) { project.view = view; store.save(); }
    },
    onZoom: (zoom) => {
      const el = $('#zoomValue');
      if (el) el.textContent = `${Math.round(zoom * 100)}%`;
    },
    onMessage: (message, type) => {
      if (type === 'connect') toast(message, 'info');
    },
  });

  document.addEventListener('method:tool', (e) => {
    const { tool } = e.detail;
    $$('.tool').forEach((btn) => btn.classList.toggle('is-active', btn.dataset.tool === tool));
    const viewport = $('#canvasViewport');
    viewport.classList.toggle('tool-connect', tool === 'connect');
    viewport.classList.toggle('tool-place', ['note', 'text', 'shape'].includes(tool));
  });
}

function initCollab() {
  collab = new Collab({
    onState: (remote, clientId) => {
      if (!state.projectId) return;
      canvas.applyRemote(remote);
      const project = store.getProject(state.projectId);
      if (project) {
        project.nodes = remote.nodes;
        project.edges = remote.edges;
        project.updatedAt = Date.now();
        store.save();
        updateNodeCount(project.nodes.length);
        renderVersions();
        setSaveState('saved');
      }
      const peer = state.peers.find((p) => p.clientId === clientId);
      if (peer) toast(`${peer.name} 更新了画布`, 'collab');
    },
    onPeers: (peers) => {
      state.peers = peers;
      updateCollabUI();
    },
    onToast: (message) => toast(message, 'collab'),
  });
  collab.setUser(store.state.user);
}

/* =========================================================
   Selection bar
   ========================================================= */
function renderSelectionBar(selection, payload) {
  const bar = $('#selectionBar');
  if (!bar) return;
  if (!selection) { bar.hidden = true; return; }
  bar.hidden = false;
  const isNode = selection.type === 'node';
  $('#selLabel').textContent = isNode
    ? ({ note: '便签', text: '文本', shape: '形状' }[payload?.type] || '内容')
    : '连线';
  const colors = $('#selColors');
  colors.style.display = isNode ? '' : 'none';
  const connectBtn = $('#selConnect');
  connectBtn.style.display = isNode ? '' : 'none';
  const dup = $('#selDuplicate');
  dup.style.display = isNode ? '' : 'none';
  if (isNode && payload) {
    colors.innerHTML = NODE_COLORS.map((c) => `
      <button class="swatch swatch--${c} ${payload.color === c ? 'is-active' : ''}" data-color="${c}" aria-label="${c}"></button>
    `).join('');
  }
}

/* =========================================================
   Events
   ========================================================= */
function bind() {
  /* theme */
  $('#themeToggle').addEventListener('click', toggleTheme);
  $$('.theme-choice').forEach((btn) => {
    btn.addEventListener('click', () => applyTheme(btn.dataset.themeChoice));
  });

  /* sidebar nav */
  $$('.nav-item').forEach((item) => {
    item.addEventListener('click', () => {
      if (state.projectId) {
        canvas.finishEditing();
        collab.setProject(null);
        state.projectId = null;
        setHash(null);
      }
      showView(item.dataset.view);
    });
  });
  $('#mobileMenu').addEventListener('click', openSidebar);
  $('#sidebarClose').addEventListener('click', closeSidebar);
  $('#sidebarBackdrop').addEventListener('click', closeSidebar);
  $('#sidebarNewBtn').addEventListener('click', openNewProject);
  $('#newProjectBtn').addEventListener('click', openNewProject);
  $('#templateBtn').addEventListener('click', openNewProject);
  $('#emptyNewBtn').addEventListener('click', openNewProject);
  $('#templateGrid').addEventListener('click', (e) => {
    const card = e.target.closest('[data-template]');
    if (!card) return;
    state.template = card.dataset.template;
    $$('.template-card').forEach((item) => item.classList.toggle('is-active', item === card));
  });
  $('#createProjectBtn').addEventListener('click', createProject);
  $('#projectName').addEventListener('keydown', (e) => { if (e.key === 'Enter') createProject(); });

  /* user + settings */
  $('#userChip').addEventListener('click', () => showView('settings'));
  $('#topbarAvatar').addEventListener('click', () => showView('settings'));
  $('#saveProfileBtn').addEventListener('click', saveProfile);
  $('#exportBtn').addEventListener('click', () => {
    download(`method-backup-${new Date().toISOString().slice(0, 10)}.json`, store.exportJSON());
    toast('备份已导出', 'success');
  });
  $('#importBtn').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      store.importJSON(text);
      renderUser();
      renderDashboard();
      toast('工作区已恢复', 'success');
    } catch (err) {
      toast('导入失败：文件格式不正确', 'warn');
    }
    e.target.value = '';
  });
  $('#resetBtn').addEventListener('click', () => {
    openConfirm('清空所有数据？', '这会删除全部项目、版本与设置，无法恢复。建议先导出备份。', '清空并重启', () => {
      store.resetAll();
      location.reload();
    });
  });

  /* project grid actions */
  $('#projectGrid').addEventListener('click', (e) => {
    const menuTrigger = e.target.closest('[data-menu]');
    if (menuTrigger) {
      e.stopPropagation();
      const id = menuTrigger.dataset.menu;
      $$('.card-menu__list').forEach((list) => {
        if (list.dataset.menuList !== id) list.classList.remove('is-open');
      });
      $(`[data-menu-list="${CSS.escape(id)}"]`)?.classList.toggle('is-open');
      return;
    }
    const actBtn = e.target.closest('[data-act]');
    if (actBtn) {
      e.stopPropagation();
      const { act, id } = actBtn.dataset;
      $$('.card-menu__list').forEach((list) => list.classList.remove('is-open'));
      if (act === 'open') openProject(id);
      if (act === 'duplicate') {
        const copy = store.duplicateProject(id);
        renderDashboard();
        if (copy) toast('副本已创建', 'success');
      }
      if (act === 'publish') {
        openProject(id);
        setTimeout(openPublish, 120);
      }
      if (act === 'delete') {
        const project = store.getProject(id);
        openConfirm('删除这个项目？', `「${project?.title || '项目'}」及其全部版本将被删除。`, '删除', () => {
          store.deleteProject(id);
          renderDashboard();
          toast('项目已删除', 'info');
        });
      }
      return;
    }
    const card = e.target.closest('[data-open]');
    if (card) openProject(card.dataset.open);
  });
  $('#projectGrid').addEventListener('keydown', (e) => {
    const card = e.target.closest('[data-open]');
    if (card && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      openProject(card.dataset.open);
    }
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.card-menu')) {
      $$('.card-menu__list').forEach((list) => list.classList.remove('is-open'));
    }
  });

  /* project filters */
  $('#projectSearch').addEventListener('input', (e) => {
    state.query = e.target.value;
    renderDashboard();
  });
  $('#projectFilter').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-filter]');
    if (!btn) return;
    state.filter = btn.dataset.filter;
    $$('#projectFilter button').forEach((b) => b.classList.toggle('is-active', b === btn));
    renderDashboard();
  });

  /* recent / activity / dashboard open delegation */
  $('#recentProjects').addEventListener('click', (e) => {
    const item = e.target.closest('[data-open]');
    if (item) openProject(item.dataset.open);
  });
  $('#activityList').addEventListener('click', (e) => {
    const item = e.target.closest('[data-open]');
    if (item) openProject(item.dataset.open);
  });
  $('#joinCollabBtn').addEventListener('click', async () => {
    const url = `${location.origin}${location.pathname}#project=${state.projectId || store.lastProject?.id || ''}`;
    const ok = await copyText(url);
    toast(ok ? '链接已复制，在新标签页打开试试实时协作' : '请手动复制地址栏链接', ok ? 'success' : 'warn');
  });

  /* editor header */
  $('#backBtn').addEventListener('click', leaveEditor);
  $('#projectTitle').addEventListener('input', (e) => {
    const project = store.getProject(state.projectId);
    if (!project) return;
    project.title = e.target.value.slice(0, 60);
    project.updatedAt = Date.now();
    store.save();
    setSaveState('saving');
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(() => setSaveState('saved'), 400);
  });
  $('#projectTitle').addEventListener('blur', () => {
    const project = store.getProject(state.projectId);
    if (project && !project.title.trim()) {
      project.title = '未命名项目';
      $('#projectTitle').value = project.title;
    }
    if (project) store.save();
    renderDashboard();
    showView('editor');
  });
  $('#projectTitle').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
  });

  /* versions */
  $('#versionBtn').addEventListener('click', openVersions);
  $('#closeVersions').addEventListener('click', closeVersions);
  $('#drawerBackdrop').addEventListener('click', closeVersions);
  $('#saveVersionBtn').addEventListener('click', saveVersion);
  $('#versionList').addEventListener('click', (e) => {
    const restore = e.target.closest('[data-restore]');
    const del = e.target.closest('[data-delete-version]');
    if (restore) {
      const version = store.restoreVersion(state.projectId, restore.dataset.restore);
      if (version) {
        const project = store.getProject(state.projectId);
        canvas.setContent(version.nodes, version.edges);
        if (version.view) canvas.setView(version.view);
        renderVersions();
        toast(`已回滚到「${version.label}」，可 ⌘Z 撤销`, 'success');
      }
    }
    if (del) {
      store.deleteVersion(state.projectId, del.dataset.deleteVersion);
      renderVersions();
      toast('版本已删除', 'info');
    }
  });

  /* publish */
  $('#publishBtn').addEventListener('click', openPublish);
  $('#doPublishBtn').addEventListener('click', doPublish);
  $('#shareBtn').addEventListener('click', () => openOverlay('shareModal'));
  $('#copyLinkBtn').addEventListener('click', () => shareAction('link'));
  $('#copyMarkdownBtn').addEventListener('click', () => shareAction('markdown'));
  $('#copyJsonBtn').addEventListener('click', () => shareAction('json'));

  /* AI */
  $('#aiToggle').addEventListener('click', toggleAI);
  $('#aiClose').addEventListener('click', () => {
    const panel = $('#aiPanel');
    if (window.innerWidth <= 1180) panel.classList.remove('is-open');
    else panel.classList.add('is-hidden');
  });
  $('#aiForm').addEventListener('submit', (e) => {
    e.preventDefault();
    askAIPanel();
  });
  $('#aiInput').addEventListener('input', autoSizeAI);
  $('#aiInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      askAIPanel();
    }
  });
  $('#aiQuick').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-prompt]');
    if (chip) askAIPanel(chip.dataset.prompt);
  });

  /* selection bar */
  $('#selColors').addEventListener('click', (e) => {
    const swatch = e.target.closest('[data-color]');
    if (swatch) canvas.updateSelected({ color: swatch.dataset.color });
  });
  $('#selDelete').addEventListener('click', () => canvas.deleteSelection());
  $('#selDuplicate').addEventListener('click', () => canvas.duplicateSelected());
  $('#selConnect').addEventListener('click', () => {
    canvas.setTool('connect');
    toast('现在点击另一个节点完成连线', 'info');
  });

  /* toolrail */
  $('#toolrail').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tool]');
    if (btn) canvas.setTool(btn.dataset.tool);
  });

  /* zoom */
  $('#zoomIn').addEventListener('click', () => canvas.zoomBy(1.15));
  $('#zoomOut').addEventListener('click', () => canvas.zoomBy(0.87));
  $('#zoomValue').addEventListener('click', () => canvas.zoomTo(1));
  $('#fitBtn').addEventListener('click', () => canvas.fitContent());
  $('#undoBtn').addEventListener('click', () => canvas.undo());
  $('#redoBtn').addEventListener('click', () => canvas.redo());

  /* overlays generic close */
  document.addEventListener('click', (e) => {
    const close = e.target.closest('[data-close]');
    if (close) closeOverlay(close.dataset.close);
  });
  $('#confirmOk').addEventListener('click', () => {
    const fn = state.confirmAction;
    state.confirmAction = null;
    closeOverlay('confirmModal');
    if (fn) fn();
  });

  /* onboarding */
  $('#onboardingForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#onboardingName').value.trim() || '创造者';
    store.setUser(name, state.onboardingColor);
    renderUser();
    renderDashboard();
    closeOverlay('onboarding');
    toast(`欢迎，${name}`, 'success');
  });
  $('#onboardingSkip').addEventListener('click', () => {
    store.setUser('访客', state.onboardingColor);
    renderUser();
    renderDashboard();
    closeOverlay('onboarding');
  });

  /* palette */
  $('#searchBtn').addEventListener('click', openPalette);
  $('#paletteInput').addEventListener('input', (e) => renderPalette(e.target.value));
  $('#paletteList').addEventListener('click', (e) => {
    const item = e.target.closest('.palette__item');
    if (item) runPalette(Number(item.dataset.index));
  });
  $('#paletteInput').addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); movePalette(1); }
    if (e.key === 'ArrowUp') { e.preventDefault(); movePalette(-1); }
    if (e.key === 'Enter') { e.preventDefault(); runPalette(paletteIndex); }
  });

  /* keyboard shortcuts */
  document.addEventListener('keydown', (e) => {
    const typing = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)
      || document.activeElement?.isContentEditable;

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      $('#palette').classList.contains('is-open') ? closePalette() : openPalette();
      return;
    }
    if (e.key === 'Escape') {
      if ($('#palette').classList.contains('is-open')) closePalette();
      else if ($('#confirmModal').classList.contains('is-open')) closeOverlay('confirmModal');
      else if ($('#newProjectModal').classList.contains('is-open')) closeOverlay('newProjectModal');
      else if ($('#shareModal').classList.contains('is-open')) closeOverlay('shareModal');
      else if ($('#publishModal').classList.contains('is-open')) closeOverlay('publishModal');
      else if ($('#versionsDrawer').classList.contains('is-open')) closeVersions();
      else if (canvas?.selection) canvas.select(null);
      else closeSidebar();
      return;
    }
    if (typing) return;
    if (state.view !== 'editor') {
      if (e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); openNewProject(); }
      return;
    }

    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      e.shiftKey ? canvas.redo() : canvas.undo();
      return;
    }
    if (mod && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      canvas.duplicateSelected();
      return;
    }
    if (mod && e.key.toLowerCase() === 's') {
      e.preventDefault();
      saveVersion();
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (canvas.selection) { e.preventDefault(); canvas.deleteSelection(); }
      return;
    }
    if (e.key === 'Enter' && canvas.selection?.type === 'node') {
      e.preventDefault();
      canvas.focusNodeText();
      return;
    }
    const toolKeys = { v: 'select', n: 'note', t: 'text', r: 'shape', c: 'connect' };
    if (toolKeys[e.key.toLowerCase()]) {
      e.preventDefault();
      canvas.setTool(toolKeys[e.key.toLowerCase()]);
      return;
    }
    if (e.key === '=' || e.key === '+') { e.preventDefault(); canvas.zoomBy(1.12); }
    if (e.key === '-') { e.preventDefault(); canvas.zoomBy(0.9); }
    if (e.key.toLowerCase() === 'f') { e.preventDefault(); canvas.fitContent(); }
  });

  /* hash routing */
  window.addEventListener('hashchange', () => {
    const id = new URLSearchParams(location.hash.replace(/^#/, '')).get('project');
    if (id && id !== state.projectId) openProject(id, { push: false });
    if (!id && state.view === 'editor') leaveEditor();
  });

  window.addEventListener('beforeunload', () => store.flush());
  window.addEventListener('resize', () => {
    if (state.view === 'editor') canvas.applyView();
  });
}

/* =========================================================
   Boot
   ========================================================= */
function boot() {
  applyTheme(store.state.theme || 'dark', { persist: false });
  renderUser();
  renderTemplates();
  initCanvas();
  initCollab();
  bind();
  renderDashboard();

  if (!store.state.user) {
    setTimeout(() => openOverlay('onboarding'), 500);
  }

  const id = new URLSearchParams(location.hash.replace(/^#/, '')).get('project');
  if (id && store.getProject(id)) {
    openProject(id, { push: false });
  } else {
    showView('dashboard');
  }

  // 让“AI 面板”在窄屏默认收起
  if (window.innerWidth <= 1180) $('#aiPanel').classList.remove('is-open');
}

boot();
