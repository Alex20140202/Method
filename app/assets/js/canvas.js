/* =========================================================
   METHOD — infinite canvas engine
   ========================================================= */

import { uid } from './store.js';

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2.4;
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

const DEFAULTS = {
  note: { w: 240, h: 150, text: '双击输入内容', color: 'violet' },
  text: { w: 360, h: 90, text: '双击输入标题', color: 'slate', size: 'lg' },
  shape: { w: 190, h: 56, text: '按钮', color: 'violet', radius: 999 },
};

export class CanvasEditor {
  constructor(opts) {
    this.viewport = opts.viewport;
    this.world = opts.world;
    this.nodeLayer = opts.nodeLayer;
    this.edgeLayer = opts.edgeLayer;
    this.cursorLayer = opts.cursorLayer;

    this.onCommit = opts.onCommit || (() => {});
    this.onSelection = opts.onSelection || (() => {});
    this.onCursor = opts.onCursor || (() => {});
    this.onView = opts.onView || (() => {});
    this.onZoom = opts.onZoom || (() => {});
    this.onMessage = opts.onMessage || (() => {});

    this.nodes = [];
    this.edges = [];
    this.view = { x: 80, y: 60, zoom: 0.8 };
    this.tool = 'select';
    this.selection = null;
    this.editingId = null;
    this.pendingFrom = null;
    this.remoteCursors = new Map();

    this.history = [];
    this.future = [];

    this.gesture = null;
    this.pan = null;
    this._cursorAt = 0;

    this._bind();
  }

  /* ---------- lifecycle ---------- */
  load(project) {
    if (!project) return;
    this.projectId = project.id;
    this.nodes = structuredClone(project.nodes || []);
    this.edges = structuredClone(project.edges || []);
    this.view = project.view ? { ...project.view } : { x: 80, y: 60, zoom: 0.8 };
    this.history = [];
    this.future = [];
    this.selection = null;
    this.pendingFrom = null;
    this.editingId = null;
    this.setTool('select');
    this.render();
    this.applyView();
    this.onSelection(null);
    this.onZoom(this.view.zoom);
  }

  snapshot() {
    return JSON.stringify({ nodes: this.nodes, edges: this.edges });
  }

  pushHistory(snap = this.snapshot()) {
    this.history.push(snap);
    if (this.history.length > 60) this.history.shift();
    this.future = [];
  }

  undo() {
    if (!this.history.length) return false;
    this.future.push(this.snapshot());
    this._restore(this.history.pop(), false);
    this.onMessage('已撤销', 'undo');
    return true;
  }

  redo() {
    if (!this.future.length) return false;
    this.history.push(this.snapshot());
    this._restore(this.future.pop(), false);
    this.onMessage('已重做', 'redo');
    return true;
  }

  _restore(snap) {
    const { nodes, edges } = JSON.parse(snap);
    this.nodes = nodes;
    this.edges = edges;
    this.selection = null;
    this.pendingFrom = null;
    this.render();
    this.onSelection(null);
    this.commit();
  }

  commit() {
    this.onCommit({ nodes: this.nodes, edges: this.edges, view: this.view });
  }

  setTool(tool) {
    this.tool = tool;
    this.pendingFrom = null;
    this.viewport.dataset.tool = tool;
    this.nodeLayer.querySelectorAll('.node').forEach((el) => {
      el.classList.toggle('is-connect-armed', tool === 'connect');
      el.classList.remove('is-connect-source');
    });
    document.dispatchEvent(new CustomEvent('method:tool', { detail: { tool } }));
  }

  /* ---------- view ---------- */
  applyView() {
    const { x, y, zoom } = this.view;
    this.world.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${zoom})`;
    this.world.style.setProperty('--zoom', zoom);
    this.viewport.style.setProperty('--grid-size', `${24 * zoom}px`);
    this.viewport.style.setProperty('--grid-x', `${x}px`);
    this.viewport.style.setProperty('--grid-y', `${y}px`);
    this.onZoom(zoom);
    this.renderRemoteCursors();
  }

  setView(view, { silent = false } = {}) {
    this.view = { ...view };
    this.applyView();
    if (!silent) this.onView(this.view);
  }

  zoomAt(factor, clientX, clientY) {
    const rect = this.viewport.getBoundingClientRect();
    const mx = (clientX ?? rect.left + rect.width / 2) - rect.left;
    const my = (clientY ?? rect.top + rect.height / 2) - rect.top;
    const wx = (mx - this.view.x) / this.view.zoom;
    const wy = (my - this.view.y) / this.view.zoom;
    const next = clamp(this.view.zoom * factor, MIN_ZOOM, MAX_ZOOM);
    this.view = { zoom: next, x: mx - wx * next, y: my - wy * next };
    this.applyView();
    this.onView(this.view);
  }

  zoomBy(factor) {
    this.zoomAt(factor);
  }

  zoomTo(value) {
    const factor = value / this.view.zoom;
    this.zoomAt(factor);
  }

  fitContent() {
    if (!this.nodes.length) {
      this.setView({ x: this.viewport.clientWidth / 2 - 300, y: this.viewport.clientHeight / 2 - 200, zoom: 0.8 });
      return;
    }
    const minX = Math.min(...this.nodes.map((n) => n.x));
    const minY = Math.min(...this.nodes.map((n) => n.y));
    const maxX = Math.max(...this.nodes.map((n) => n.x + n.w));
    const maxY = Math.max(...this.nodes.map((n) => n.y + n.h));
    const pad = 80;
    const vw = this.viewport.clientWidth;
    const vh = this.viewport.clientHeight;
    const zoom = clamp(Math.min((vw - pad * 2) / (maxX - minX), (vh - pad * 2) / (maxY - minY)), MIN_ZOOM, 1.2);
    this.setView({
      zoom,
      x: (vw - (maxX - minX) * zoom) / 2 - minX * zoom,
      y: (vh - (maxY - minY) * zoom) / 2 - minY * zoom,
    });
  }

  focusNodes(list = []) {
    if (!list.length) return;
    const minX = Math.min(...list.map((n) => n.x));
    const minY = Math.min(...list.map((n) => n.y));
    const maxX = Math.max(...list.map((n) => n.x + n.w));
    const maxY = Math.max(...list.map((n) => n.y + n.h));
    const vw = this.viewport.clientWidth;
    const vh = this.viewport.clientHeight;
    const zoom = clamp(Math.min(1, (vw - 140) / (maxX - minX), (vh - 140) / (maxY - minY)), MIN_ZOOM, 1.1);
    this.setView({
      zoom,
      x: vw / 2 - ((minX + maxX) / 2) * zoom,
      y: vh / 2 - ((minY + maxY) / 2) * zoom,
    });
  }

  centerOnNode(id) {
    const node = this.nodes.find((n) => n.id === id);
    if (!node) return;
    const vw = this.viewport.clientWidth;
    const vh = this.viewport.clientHeight;
    const zoom = this.view.zoom;
    this.setView({
      zoom,
      x: vw / 2 - (node.x + node.w / 2) * zoom,
      y: vh / 2 - (node.y + node.h / 2) * zoom,
    });
  }

  hasVisibleContent() {
    if (!this.nodes.length) return true;
    const vw = this.viewport.clientWidth;
    const vh = this.viewport.clientHeight;
    const { x, y, zoom } = this.view;
    return this.nodes.some((n) => {
      const left = n.x * zoom + x;
      const top = n.y * zoom + y;
      return left < vw && left + n.w * zoom > 0 && top < vh && top + n.h * zoom > 0;
    });
  }

  screenToWorld(clientX, clientY) {
    const rect = this.viewport.getBoundingClientRect();
    return {
      x: (clientX - rect.left - this.view.x) / this.view.zoom,
      y: (clientY - rect.top - this.view.y) / this.view.zoom,
    };
  }

  /* ---------- rendering ---------- */
  render() {
    this.nodeLayer.innerHTML = '';
    this.nodes.forEach((node) => {
      this.nodeLayer.appendChild(this._createNodeEl(node));
    });
    this.renderEdges();
    this._applySelectionClasses();
  }

  _createNodeEl(node) {
    const el = document.createElement('div');
    el.className = `node node--${node.type} c-${node.color || 'violet'} size-${node.size || 'md'}`;
    el.dataset.id = node.id;
    el.style.left = `${node.x}px`;
    el.style.top = `${node.y}px`;
    el.style.width = `${node.w}px`;
    el.style.height = `${node.h}px`;
    if (node.radius != null) el.style.borderRadius = `${node.radius}px`;
    el.tabIndex = 0;
    el.setAttribute('role', 'group');
    el.setAttribute('aria-label', `画布内容：${(node.text || '').slice(0, 40)}`);

    const text = document.createElement('div');
    text.className = 'node__text';
    text.textContent = node.text || '';
    el.appendChild(text);

    if (node.type !== 'text') {
      const handle = document.createElement('span');
      handle.className = 'node__resize';
      handle.setAttribute('aria-hidden', 'true');
      el.appendChild(handle);
    }
    return el;
  }

  renderEdges() {
    const byId = new Map(this.nodes.map((n) => [n.id, n]));
    const parts = this.edges.map((edge) => {
      const a = byId.get(edge.from);
      const b = byId.get(edge.to);
      if (!a || !b) return '';
      const ax = a.x + a.w;
      const ay = a.y + a.h / 2;
      const bx = b.x;
      const by = b.y + b.h / 2;
      const dx = Math.max(50, Math.abs(bx - ax) * 0.45);
      const d = `M ${ax} ${ay} C ${ax + dx} ${ay}, ${bx - dx} ${by}, ${bx} ${by}`;
      const selected = this.selection?.type === 'edge' && this.selection.id === edge.id ? ' is-selected' : '';
      return `<g class="edge${selected}" data-id="${edge.id}">
        <path class="edge__hit" d="${d}"></path>
        <path class="edge__line" d="${d}" marker-end="url(#method-arrow)"></path>
      </g>`;
    });
    this.edgeLayer.innerHTML = `<defs>
      <marker id="method-arrow" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 0 L 8 4 L 0 8 z" fill="currentColor"></path>
      </marker>
    </defs>${parts.join('')}`;
  }

  _applySelectionClasses() {
    this.nodeLayer.querySelectorAll('.node').forEach((el) => {
      el.classList.toggle(
        'is-selected',
        this.selection?.type === 'node' && this.selection.id === el.dataset.id,
      );
      el.classList.toggle('is-connect-source', this.pendingFrom === el.dataset.id);
    });
    this.edgeLayer.querySelectorAll('.edge').forEach((el) => {
      el.classList.toggle(
        'is-selected',
        this.selection?.type === 'edge' && this.selection.id === el.dataset.id,
      );
    });
  }

  /* ---------- selection ---------- */
  select(selection) {
    this.selection = selection;
    if (this.editingId && (!selection || selection.id !== this.editingId)) this.finishEditing();
    this._applySelectionClasses();
    let payload = null;
    if (selection?.type === 'node') payload = this.nodes.find((n) => n.id === selection.id) || null;
    if (selection?.type === 'edge') payload = this.edges.find((e) => e.id === selection.id) || null;
    this.onSelection(selection, payload);
  }

  deleteSelection() {
    if (!this.selection) return false;
    const before = this.snapshot();
    if (this.selection.type === 'node') {
      const id = this.selection.id;
      this.nodes = this.nodes.filter((n) => n.id !== id);
      this.edges = this.edges.filter((e) => e.from !== id && e.to !== id);
    } else {
      this.edges = this.edges.filter((e) => e.id !== this.selection.id);
    }
    this.history.push(before);
    this.future = [];
    this.selection = null;
    this.render();
    this.onSelection(null);
    this.commit();
    return true;
  }

  updateSelected(patch) {
    if (this.selection?.type !== 'node') return;
    const node = this.nodes.find((n) => n.id === this.selection.id);
    if (!node) return;
    const before = this.snapshot();
    Object.assign(node, patch);
    this.history.push(before);
    this.future = [];
    this.render();
    this.onSelection(this.selection, node);
    this.commit();
  }

  duplicateSelected() {
    if (this.selection?.type !== 'node') return;
    const source = this.nodes.find((n) => n.id === this.selection.id);
    if (!source) return;
    const before = this.snapshot();
    const copy = { ...structuredClone(source), id: uid(), x: source.x + 28, y: source.y + 28 };
    this.nodes.push(copy);
    this.history.push(before);
    this.future = [];
    this.render();
    this.select({ type: 'node', id: copy.id });
    this.commit();
  }

  /* ---------- create / external ops ---------- */
  _normalizeNode(partial) {
    const type = partial.type || 'note';
    const base = DEFAULTS[type] || DEFAULTS.note;
    return {
      id: partial.id || uid(),
      type,
      x: partial.x ?? 0,
      y: partial.y ?? 0,
      w: partial.w ?? base.w,
      h: partial.h ?? base.h,
      text: partial.text ?? base.text,
      color: partial.color || base.color,
      size: partial.size || base.size || 'md',
      radius: partial.radius ?? base.radius ?? 18,
    };
  }

  addNodeAt(worldX, worldY, type = 'note') {
    const base = DEFAULTS[type] || DEFAULTS.note;
    const before = this.snapshot();
    const node = this._normalizeNode({
      type,
      x: worldX - base.w / 2,
      y: worldY - base.h / 2,
    });
    this.nodes.push(node);
    this.history.push(before);
    this.future = [];
    this.render();
    this.select({ type: 'node', id: node.id });
    this.commit();
    return node;
  }

  addNodes(list = [], { selectFirst = false } = {}) {
    if (!list.length) return [];
    const before = this.snapshot();
    const added = list.map((partial) => this._normalizeNode(partial));
    this.nodes.push(...added);
    this.history.push(before);
    this.future = [];
    this.render();
    if (selectFirst) this.select({ type: 'node', id: added[0].id });
    this.commit();
    return added;
  }

  setContent(nodes, edges, { undoable = true } = {}) {
    if (undoable) {
      this.history.push(this.snapshot());
      this.future = [];
    }
    this.nodes = structuredClone(nodes);
    this.edges = structuredClone(edges);
    this.selection = null;
    this.render();
    this.onSelection(null);
    this.commit();
  }

  arrange() {
    if (!this.nodes.length) return;
    const before = this.snapshot();
    const sorted = [...this.nodes].sort((a, b) => (a.y - b.y) || (a.x - b.x));
    const startX = Math.min(...this.nodes.map((n) => n.x));
    const startY = Math.min(...this.nodes.map((n) => n.y));
    const colW = 300;
    const rowH = 190;
    sorted.forEach((node, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      node.x = startX + col * colW;
      node.y = startY + row * rowH;
      if (node.w > 270) node.w = 270;
      if (node.h > 180) node.h = 180;
    });
    this.history.push(before);
    this.future = [];
    this.render();
    this.commit();
  }

  applyRemote(state) {
    if (!state) return;
    if (this.editingId) this.finishEditing();
    this.nodes = structuredClone(state.nodes || []);
    this.edges = structuredClone(state.edges || []);
    this.render();
  }

  /* ---------- cursors ---------- */
  renderRemoteCursors() {
    if (!this.cursorLayer) return;
    const inv = 1 / this.view.zoom;
    const seen = new Set();
    this.remoteCursors.forEach((peer, id) => {
      seen.add(id);
      let el = this.cursorLayer.querySelector(`[data-cursor="${CSS.escape(id)}"]`);
      if (!el) {
        el = document.createElement('div');
        el.className = 'remote-cursor';
        el.dataset.cursor = id;
        el.innerHTML = '<span class="remote-cursor__label"></span>';
        this.cursorLayer.appendChild(el);
      }
      el.style.transform = `translate(${peer.cursor.x}px, ${peer.cursor.y}px)`;
      el.style.setProperty('--cursor-color', peer.color || '#7c5cff');
      el.style.setProperty('--iz', inv);
      const label = el.querySelector('.remote-cursor__label');
      label.textContent = peer.name;
    });
    this.cursorLayer.querySelectorAll('.remote-cursor').forEach((el) => {
      if (!seen.has(el.dataset.cursor)) el.remove();
    });
  }

  setPeerCursor(id, peer) {
    if (!peer?.cursor) {
      this.remoteCursors.delete(id);
    } else {
      this.remoteCursors.set(id, peer);
    }
    this.renderRemoteCursors();
  }

  clearPeers() {
    this.remoteCursors.clear();
    this.renderRemoteCursors();
  }

  /* ---------- events ---------- */
  _bind() {
    this.viewport.addEventListener('pointerdown', (e) => this._onViewportDown(e));
    this.viewport.addEventListener('dblclick', (e) => {
      if (e.target.closest('.node')) return;
      if (this.tool !== 'select') return;
      const p = this.screenToWorld(e.clientX, e.clientY);
      this.addNodeAt(p.x, p.y, 'note');
    });
    this.viewport.addEventListener('wheel', (e) => this._onWheel(e), { passive: false });

    this.nodeLayer.addEventListener('pointerdown', (e) => this._onNodeDown(e));
    this.nodeLayer.addEventListener('dblclick', (e) => {
      const el = e.target.closest('.node');
      if (!el) return;
      e.stopPropagation();
      this.startEditing(el.dataset.id);
    });

    this.edgeLayer.addEventListener('pointerdown', (e) => {
      const g = e.target.closest('.edge');
      if (!g) return;
      e.stopPropagation();
      this.select({ type: 'edge', id: g.dataset.id });
    });

    window.addEventListener('pointermove', (e) => this._onPointerMove(e));
    window.addEventListener('pointerup', (e) => this._onPointerUp(e));
    this.viewport.addEventListener('pointermove', (e) => {
      if (this.viewport.dataset.tool !== 'select') return;
      const now = performance.now();
      if (now - this._cursorAt < 50) return;
      this._cursorAt = now;
      const p = this.screenToWorld(e.clientX, e.clientY);
      this.onCursor(p);
    }, { passive: true });
  }

  _onViewportDown(e) {
    if (e.target.closest('.node') || e.target.closest('.edge')) return;
    if (e.button !== 0) return;

    if (this.tool === 'note' || this.tool === 'text' || this.tool === 'shape') {
      const p = this.screenToWorld(e.clientX, e.clientY);
      this.addNodeAt(p.x, p.y, this.tool);
      this.setTool('select');
      return;
    }

    if (this.tool === 'connect') return;

    this.select(null);
    this.pan = {
      sx: e.clientX, sy: e.clientY,
      ox: this.view.x, oy: this.view.y,
      moved: false,
    };
    this.viewport.classList.add('is-panning');
    try { this.viewport.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
  }

  _onNodeDown(e) {
    const el = e.target.closest('.node');
    if (!el) return;
    if (e.button !== 0) return;
    const id = el.dataset.id;
    const node = this.nodes.find((n) => n.id === id);
    if (!node) return;

    if (this.tool === 'connect') {
      e.stopPropagation();
      e.preventDefault();
      if (!this.pendingFrom) {
        this.pendingFrom = id;
        this.select({ type: 'node', id });
        this._applySelectionClasses();
        this.onMessage('选择另一个节点完成连接', 'connect');
      } else if (this.pendingFrom !== id) {
        const before = this.snapshot();
        this.edges.push({ id: uid(), from: this.pendingFrom, to: id });
        this.history.push(before);
        this.future = [];
        this.pendingFrom = null;
        this.render();
        this.commit();
        this.onMessage('已连接两个节点', 'connect');
      } else {
        this.pendingFrom = null;
        this._applySelectionClasses();
      }
      return;
    }

    if (e.target.closest('.node__resize')) {
      e.stopPropagation();
      e.preventDefault();
      this.select({ type: 'node', id });
      this.gesture = {
        mode: 'resize', id,
        sx: e.clientX, sy: e.clientY,
        w: node.w, h: node.h,
        before: this.snapshot(), moved: false,
      };
      return;
    }

    if (e.target.closest('[contenteditable="true"]')) return;

    e.stopPropagation();
    this.select({ type: 'node', id });
    this.viewport.classList.remove('is-panning');
    this.gesture = {
      mode: 'drag', id,
      sx: e.clientX, sy: e.clientY,
      x: node.x, y: node.y,
      before: this.snapshot(), moved: false,
    };
  }

  _onPointerMove(e) {
    if (this.pan) {
      const dx = e.clientX - this.pan.sx;
      const dy = e.clientY - this.pan.sy;
      if (Math.abs(dx) + Math.abs(dy) > 2) this.pan.moved = true;
      this.view.x = this.pan.ox + dx;
      this.view.y = this.pan.oy + dy;
      this.applyView();
      return;
    }

    if (!this.gesture) return;
    const g = this.gesture;
    const node = this.nodes.find((n) => n.id === g.id);
    if (!node) return;

    const dx = (e.clientX - g.sx) / this.view.zoom;
    const dy = (e.clientY - g.sy) / this.view.zoom;
    if (Math.abs(dx) + Math.abs(dy) > 1) g.moved = true;
    if (!g.moved) return;

    if (g.mode === 'drag') {
      node.x = Math.round(g.x + dx);
      node.y = Math.round(g.y + dy);
    } else {
      node.w = Math.round(Math.max(90, g.w + dx));
      node.h = Math.round(Math.max(48, g.h + dy));
    }

    const el = this.nodeLayer.querySelector(`[data-id="${CSS.escape(node.id)}"]`);
    if (el) {
      el.style.left = `${node.x}px`;
      el.style.top = `${node.y}px`;
      el.style.width = `${node.w}px`;
      el.style.height = `${node.h}px`;
    }
    this.renderEdges();
  }

  _onPointerUp() {
    if (this.pan) {
      const moved = this.pan.moved;
      this.pan = null;
      this.viewport.classList.remove('is-panning');
      this.onView(this.view);
      if (!moved && this.tool === 'select') this.select(null);
      return;
    }

    if (!this.gesture) return;
    const g = this.gesture;
    this.gesture = null;
    if (g.moved) {
      this.history.push(g.before);
      this.future = [];
      this.renderEdges();
      this.commit();
    }
  }

  _onWheel(e) {
    if (e.target.closest('.ai-panel, .versions-drawer')) return;
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      this.zoomAt(e.deltaY > 0 ? 0.92 : 1.08, e.clientX, e.clientY);
    } else {
      this.view.x -= e.deltaX;
      this.view.y -= e.deltaY;
      this.applyView();
      this.onView(this.view);
    }
  }

  /* ---------- editing ---------- */
  startEditing(id) {
    if (this.editingId) this.finishEditing();
    const node = this.nodes.find((n) => n.id === id);
    const el = this.nodeLayer.querySelector(`[data-id="${CSS.escape(id)}"]`);
    if (!node || !el) return;
    const textEl = el.querySelector('.node__text');
    this._editBefore = this.snapshot();
    this._editOriginal = node.text;
    this.editingId = id;
    el.classList.add('is-editing');
    textEl.contentEditable = 'true';
    textEl.focus();
    const range = document.createRange();
    range.selectNodeContents(textEl);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    const finish = (e) => {
      if (e.type === 'keydown') {
        if (e.key === 'Escape' || ((e.metaKey || e.ctrlKey) && e.key === 'Enter')) {
          e.preventDefault();
          this.finishEditing();
        }
        return;
      }
      if (e.type === 'blur') this.finishEditing();
    };
    textEl.addEventListener('keydown', finish);
    textEl.addEventListener('blur', finish, { once: true });
  }

  finishEditing() {
    if (!this.editingId) return;
    const id = this.editingId;
    const el = this.nodeLayer.querySelector(`[data-id="${CSS.escape(id)}"]`);
    const node = this.nodes.find((n) => n.id === id);
    this.editingId = null;
    if (!el || !node) return;
    const textEl = el.querySelector('.node__text');
    textEl.contentEditable = 'false';
    el.classList.remove('is-editing');
    const text = textEl.innerText.replace(/\u00a0/g, ' ');
    node.text = text;
    textEl.textContent = text;
    if (text !== this._editOriginal) {
      this.history.push(this._editBefore);
      this.future = [];
      this.commit();
    }
  }

  focusNodeText() {
    if (this.selection?.type === 'node') this.startEditing(this.selection.id);
  }

  destroy() {
    this.clearPeers();
  }
}

export { MIN_ZOOM, MAX_ZOOM };
