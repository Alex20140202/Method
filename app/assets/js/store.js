/* =========================================================
   METHOD — local-first workspace store
   ========================================================= */

const KEY = 'method.workspace.v2';

export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`);

export const now = () => Date.now();

export const COVERS = {
  aurora: 'linear-gradient(135deg, #7c5cff 0%, #4f9dff 48%, #00e5c8 100%)',
  sunset: 'linear-gradient(135deg, #ff5fa2 0%, #ff9f6b 55%, #ffd36b 100%)',
  ocean: 'linear-gradient(135deg, #0e7490 0%, #4f9dff 55%, #7c5cff 100%)',
  mint: 'linear-gradient(135deg, #059669 0%, #34d399 55%, #a7f3d0 100%)',
  mono: 'linear-gradient(135deg, #26293a 0%, #4b5068 55%, #8c92a6 100%)',
};

export const NODE_COLORS = ['violet', 'cyan', 'pink', 'amber', 'green', 'slate'];

const n = (type, x, y, w, h, text, extra = {}) => ({
  id: uid(), type, x, y, w, h, text,
  color: extra.color || 'violet',
  size: extra.size || 'md',
  radius: extra.radius ?? (type === 'shape' ? 16 : 18),
});

const e = (from, to) => ({ id: uid(), from, to });

/* ---------- Templates ---------- */
function tplLanding() {
  const hero = n('text', 80, 50, 640, 150, '让复杂的事\n变得简单。', { size: 'xl', color: 'slate' });
  const sub = n('text', 80, 230, 470, 80, '用一句话讲清你的产品价值，以及它为什么值得被记住。', { size: 'md', color: 'slate' });
  const cta = n('shape', 80, 340, 196, 60, '立即开始 →', { color: 'violet' });
  const n1 = n('note', 840, 30, 270, 160, '首屏\n标题 + 价值主张 + 主 CTA', { color: 'violet' });
  const n2 = n('note', 1150, 60, 250, 140, '社会证明\n客户 Logo / 用户评价', { color: 'cyan' });
  const n3 = n('note', 850, 240, 260, 150, '核心能力\n三栏卡片 + 微动效', { color: 'pink' });
  const n4 = n('note', 1150, 250, 250, 140, '转化\n定价 + FAQ + 页脚', { color: 'amber' });
  return { nodes: [hero, sub, cta, n1, n2, n3, n4], edges: [e(n1.id, n2.id), e(n1.id, n3.id), e(n3.id, n4.id)] };
}

function tplBrainstorm() {
  const center = n('text', 460, 240, 320, 90, '这次，我们想解决什么？', { size: 'lg', color: 'slate' });
  const a = n('note', 90, 70, 250, 150, '用户痛点\n他们在哪一步卡住了？', { color: 'pink' });
  const b = n('note', 90, 380, 250, 150, '灵感碎片\n先不评判，全部记下来', { color: 'violet' });
  const c = n('note', 900, 70, 250, 150, '机会点\n别人没做好的地方', { color: 'cyan' });
  const d = n('note', 900, 380, 250, 150, '下一步\n本周可以验证什么？', { color: 'amber' });
  return { nodes: [center, a, b, c, d], edges: [e(a.id, center.id), e(b.id, center.id), e(center.id, c.id), e(center.id, d.id)] };
}

function tplPlan() {
  const title = n('text', 80, 40, 600, 70, 'Q3 内容规划', { size: 'lg', color: 'slate' });
  const c1 = n('note', 80, 150, 300, 300, '7 月\n\n· 产品更新公告\n· 用户故事 01\n· 短视频 × 3', { color: 'violet' });
  const c2 = n('note', 420, 150, 300, 300, '8 月\n\n· 品牌联名\n· 深度教程\n· 直播一场', { color: 'cyan' });
  const c3 = n('note', 760, 150, 300, 300, '9 月\n\n· 年度大会预热\n· 白皮书发布\n· 社区挑战', { color: 'pink' });
  return { nodes: [title, c1, c2, c3], edges: [] };
}

function tplReview() {
  const title = n('text', 80, 40, 420, 70, '设计评审', { size: 'lg', color: 'slate' });
  const brief = n('text', 80, 130, 380, 90, '目标：让第一次访问的人在 5 秒内理解我们在做什么。', { size: 'sm', color: 'slate' });
  const list = n('note', 540, 130, 300, 300, '检查清单\n\n□ 首屏信息层级\n□ CTA 是否唯一\n□ 移动端断点\n□ 空 / 错 / 加载状态\n□ 动效是否抢戏', { color: 'green' });
  const question = n('note', 880, 130, 280, 200, '待讨论\n\n1. 标题是否太抽象？\n2. 配色对比度够吗？', { color: 'amber' });
  return { nodes: [title, brief, list, question], edges: [e(list.id, question.id)] };
}

function tplPersonal() {
  const name = n('text', 100, 80, 500, 100, '你好，我是你的名字。\n独立设计师 / 创造者', { size: 'xl', color: 'slate' });
  const about = n('text', 100, 220, 480, 120, '我关心人与界面之间的关系，喜欢把复杂的东西做得安静、清楚、有一点惊喜。', { size: 'md', color: 'slate' });
  const work = n('note', 720, 70, 300, 180, '精选作品\n\n01  Nebula OS\n02  Mono Journal\n03  Vertex Lab', { color: 'violet' });
  const contact = n('note', 720, 290, 300, 140, '联系我\n\nhello@yourname.site', { color: 'cyan' });
  return { nodes: [name, about, work, contact], edges: [e(about.id, work.id)] };
}

export const TEMPLATES = [
  { id: 'blank', name: '空白画布', desc: '从一张白纸开始，什么都可以。', icon: '◻', cover: 'mono', build: () => ({ nodes: [], edges: [] }) },
  { id: 'landing', name: '产品官网', desc: '首屏、能力、转化，一条完整的叙事线。', icon: '◈', cover: 'aurora', build: tplLanding },
  { id: 'brainstorm', name: '头脑风暴', desc: '把散落的想法摊开，再找到它们的关系。', icon: '✳', cover: 'sunset', build: tplBrainstorm },
  { id: 'plan', name: '内容规划', desc: '按月份铺开节奏，团队一眼看懂。', icon: '▤', cover: 'ocean', build: tplPlan },
  { id: 'review', name: '设计评审', desc: '目标、检查清单与待讨论问题。', icon: '◐', cover: 'mint', build: tplReview },
  { id: 'personal', name: '个人主页', desc: '介绍自己，展示作品与联系方式。', icon: '✦', cover: 'sunset', build: tplPersonal },
];

/* ---------- Seed ---------- */
function seed() {
  const landing = tplLanding();
  const p1 = {
    id: uid(),
    title: 'METHOD 官网改版',
    emoji: '✦',
    cover: 'aurora',
    template: 'landing',
    createdAt: now() - 1000 * 60 * 60 * 74,
    updatedAt: now() - 1000 * 60 * 26,
    publishedAt: now() - 1000 * 60 * 60 * 20,
    nodes: landing.nodes,
    edges: landing.edges,
    view: { x: 34, y: 46, zoom: 0.56 },
    versions: [
      {
        id: uid(), label: '初稿', at: now() - 1000 * 60 * 60 * 50,
        nodes: landing.nodes.slice(0, 4), edges: [],
        view: { x: 50, y: 40, zoom: 0.56 },
      },
      {
        id: uid(), label: '发布会前', at: now() - 1000 * 60 * 60 * 20,
        nodes: landing.nodes, edges: landing.edges,
        view: { x: 34, y: 46, zoom: 0.56 },
      },
    ],
  };

  const board = tplBrainstorm();
  const p2 = {
    id: uid(),
    title: '品牌灵感板',
    emoji: '◐',
    cover: 'sunset',
    template: 'brainstorm',
    createdAt: now() - 1000 * 60 * 60 * 120,
    updatedAt: now() - 1000 * 60 * 60 * 5,
    publishedAt: null,
    nodes: board.nodes,
    edges: board.edges,
    view: { x: 80, y: 100, zoom: 0.62 },
    versions: [],
  };

  const plan = tplPlan();
  const p3 = {
    id: uid(),
    title: 'Q3 内容规划',
    emoji: '▤',
    cover: 'ocean',
    template: 'plan',
    createdAt: now() - 1000 * 60 * 60 * 200,
    updatedAt: now() - 1000 * 60 * 60 * 30,
    publishedAt: null,
    nodes: plan.nodes,
    edges: plan.edges,
    view: { x: 70, y: 110, zoom: 0.6 },
    versions: [],
  };

  return {
    version: 2,
    user: null,
    theme: 'dark',
    projects: [p1, p2, p3],
    activity: [
      { id: uid(), type: 'publish', text: '发布了「METHOD 官网改版」', projectId: p1.id, at: now() - 1000 * 60 * 60 * 20 },
      { id: uid(), type: 'version', text: '保存了版本「发布会前」', projectId: p1.id, at: now() - 1000 * 60 * 60 * 20 },
      { id: uid(), type: 'create', text: '创建了「Q3 内容规划」', projectId: p3.id, at: now() - 1000 * 60 * 60 * 200 },
      { id: uid(), type: 'update', text: '更新了「品牌灵感板」', projectId: p2.id, at: now() - 1000 * 60 * 60 * 5 },
    ],
    lastProjectId: p1.id,
  };
}

/* ---------- Store ---------- */
class Store {
  constructor() {
    this.state = this.load();
    this.listeners = new Set();
    this.saveTimer = null;
  }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.projects)) return parsed;
      }
    } catch (err) {
      console.warn('[method] failed to load workspace', err);
    }
    return seed();
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(event = 'change', detail = {}) {
    this.listeners.forEach((fn) => {
      try { fn(event, detail); } catch (err) { console.error(err); }
    });
  }

  save() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(this.state));
      } catch (err) {
        console.warn('[method] save failed', err);
      }
    }, 180);
  }

  flush() {
    clearTimeout(this.saveTimer);
    try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch (err) { console.warn(err); }
  }

  /* user */
  setUser(name, color) {
    this.state.user = { name: name.trim().slice(0, 24) || '创造者', color: color || 'violet', at: now() };
    this.save();
    this.emit('user');
  }

  /* theme */
  setTheme(theme) {
    this.state.theme = theme;
    this.save();
    this.emit('theme', { theme });
  }

  /* projects */
  getProject(id) {
    return this.state.projects.find((p) => p.id === id) || null;
  }

  get lastProject() {
    return this.getProject(this.state.lastProjectId) || this.state.projects[0] || null;
  }

  createProject({ title, templateId = 'blank', cover }) {
    const tpl = TEMPLATES.find((t) => t.id === templateId) || TEMPLATES[0];
    const built = tpl.build();
    const project = {
      id: uid(),
      title: (title || '未命名项目').trim().slice(0, 60),
      emoji: tpl.icon,
      cover: cover || tpl.cover,
      template: tpl.id,
      createdAt: now(),
      updatedAt: now(),
      publishedAt: null,
      nodes: built.nodes,
      edges: built.edges,
      view: { x: 120, y: 90, zoom: 0.75 },
      versions: [],
    };
    this.state.projects.unshift(project);
    this.state.lastProjectId = project.id;
    this.log('create', `创建了「${project.title}」`, project.id);
    this.save();
    this.emit('projects', { type: 'create', id: project.id });
    return project;
  }

  updateProject(id, patch, { silent = false, log = false } = {}) {
    const project = this.getProject(id);
    if (!project) return null;
    Object.assign(project, patch, { updatedAt: now() });
    this.state.lastProjectId = id;
    if (log) this.log('update', `更新了「${project.title}」`, id);
    this.save();
    if (!silent) this.emit('project', { project });
    return project;
  }

  touchProject(id) {
    const project = this.getProject(id);
    if (!project) return;
    project.updatedAt = now();
    this.state.lastProjectId = id;
    this.save();
  }

  deleteProject(id) {
    const project = this.getProject(id);
    if (!project) return;
    this.state.projects = this.state.projects.filter((p) => p.id !== id);
    if (this.state.lastProjectId === id) this.state.lastProjectId = this.state.projects[0]?.id || null;
    this.log('delete', `删除了「${project.title}」`, null);
    this.save();
    this.emit('projects', { type: 'delete', id });
  }

  duplicateProject(id) {
    const source = this.getProject(id);
    if (!source) return null;
    const copy = {
      ...structuredClone(source),
      id: uid(),
      title: `${source.title} 副本`,
      createdAt: now(),
      updatedAt: now(),
      publishedAt: null,
      versions: [],
    };
    copy.nodes = copy.nodes.map((node) => ({ ...node, id: uid() }));
    const idMap = new Map(source.nodes.map((node, i) => [node.id, copy.nodes[i].id]));
    copy.edges = copy.edges.map((edge) => ({ id: uid(), from: idMap.get(edge.from), to: idMap.get(edge.to) }))
      .filter((edge) => edge.from && edge.to);
    this.state.projects.unshift(copy);
    this.log('create', `复制了「${source.title}」`, copy.id);
    this.save();
    this.emit('projects', { type: 'duplicate', id: copy.id });
    return copy;
  }

  /* versions */
  addVersion(projectId, label) {
    const project = this.getProject(projectId);
    if (!project) return null;
    const version = {
      id: uid(),
      label: (label || '版本').slice(0, 40),
      at: now(),
      nodes: structuredClone(project.nodes),
      edges: structuredClone(project.edges),
      view: { ...project.view },
    };
    project.versions.unshift(version);
    project.versions = project.versions.slice(0, 30);
    project.updatedAt = now();
    this.log('version', `保存了版本「${version.label}」`, projectId);
    this.save();
    this.emit('version', { projectId, version });
    return version;
  }

  restoreVersion(projectId, versionId) {
    const project = this.getProject(projectId);
    const version = project?.versions.find((v) => v.id === versionId);
    if (!project || !version) return null;
    project.nodes = structuredClone(version.nodes);
    project.edges = structuredClone(version.edges);
    if (version.view) project.view = { ...version.view };
    project.updatedAt = now();
    this.log('restore', `回滚到「${version.label}」`, projectId);
    this.save();
    this.emit('version', { projectId, restored: versionId });
    return version;
  }

  deleteVersion(projectId, versionId) {
    const project = this.getProject(projectId);
    if (!project) return;
    project.versions = project.versions.filter((v) => v.id !== versionId);
    this.save();
    this.emit('version', { projectId });
  }

  /* publish */
  markPublished(projectId) {
    const project = this.getProject(projectId);
    if (!project) return;
    project.publishedAt = now();
    project.updatedAt = now();
    this.log('publish', `发布了「${project.title}」`, projectId);
    this.save();
    this.emit('publish', { projectId });
  }

  /* activity */
  log(type, text, projectId = null) {
    this.state.activity.unshift({ id: uid(), type, text, projectId, at: now() });
    this.state.activity = this.state.activity.slice(0, 80);
  }

  stats() {
    const projects = this.state.projects;
    return {
      projects: projects.length,
      nodes: projects.reduce((sum, p) => sum + p.nodes.length, 0),
      versions: projects.reduce((sum, p) => sum + p.versions.length, 0),
      published: projects.filter((p) => p.publishedAt).length,
    };
  }

  exportJSON() {
    this.flush();
    return JSON.stringify(this.state, null, 2);
  }

  importJSON(text) {
    const parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.projects)) throw new Error('文件格式不正确');
    this.state = parsed;
    this.flush();
    this.emit('import');
  }

  resetAll() {
    localStorage.removeItem(KEY);
    this.state = seed();
    this.flush();
    this.emit('reset');
  }
}

export const store = new Store();

/* ---------- helpers ---------- */
export function relativeTime(ts) {
  if (!ts) return '从未';
  const diff = now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

export function formatTime(ts) {
  return new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export function escapeHtml(str = '') {
  return str.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 6) return '夜深了';
  if (h < 11) return '早上好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}
