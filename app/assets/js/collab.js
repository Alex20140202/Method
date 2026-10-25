/* =========================================================
   METHOD — cross-tab realtime collaboration
   使用 BroadcastChannel 在同一浏览器的多个标签页间同步
   ========================================================= */

export const PEOPLE_COLORS = {
  violet: '#7c5cff',
  cyan: '#00e5c8',
  pink: '#ff5fa2',
  amber: '#ffb86b',
  green: '#34d399',
};

const CHANNEL = 'method-workspace-v2';

export class Collab {
  constructor({ onState, onPeers, onToast } = {}) {
    this.clientId = Math.random().toString(36).slice(2, 10);
    this.onState = onState || (() => {});
    this.onPeers = onPeers || (() => {});
    this.onToast = onToast || (() => {});

    this.projectId = null;
    this.user = { name: '创造者', color: 'violet' };
    this.peers = new Map();
    this.stateTimer = null;
    this.cursorAt = 0;

    this.channel = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL) : null;

    if (this.channel) {
      this.channel.onmessage = (event) => this._handle(event.data);
      this.channel.postMessage({ type: 'hello', clientId: this.clientId });
    }

    this.heartbeat = setInterval(() => {
      this._prune();
      if (this.projectId) this._presence();
    }, 2500);

    window.addEventListener('beforeunload', () => {
      if (this.channel) this.channel.postMessage({ type: 'leave', clientId: this.clientId });
    });
  }

  get available() {
    return Boolean(this.channel);
  }

  setUser(user) {
    if (!user) return;
    this.user = { name: user.name || '创造者', color: user.color || 'violet' };
    if (this.projectId) this._presence();
  }

  setProject(projectId) {
    this.projectId = projectId;
    this.peers.clear();
    this.onPeers([]);
    if (this.channel && projectId) {
      this.channel.postMessage({ type: 'hello', clientId: this.clientId });
      this._presence();
    }
  }

  sendState(state) {
    if (!this.channel || !this.projectId) return;
    clearTimeout(this.stateTimer);
    this.stateTimer = setTimeout(() => {
      this.channel.postMessage({
        type: 'state',
        clientId: this.clientId,
        projectId: this.projectId,
        state: { nodes: state.nodes, edges: state.edges },
      });
    }, 90);
  }

  sendCursor(cursor) {
    if (!this.channel || !this.projectId) return;
    const now = performance.now();
    if (now - this.cursorAt < 55) return;
    this.cursorAt = now;
    this.channel.postMessage({
      type: 'cursor',
      clientId: this.clientId,
      projectId: this.projectId,
      user: this.user,
      cursor,
    });
  }

  _presence() {
    if (!this.channel) return;
    this.channel.postMessage({
      type: 'presence',
      clientId: this.clientId,
      projectId: this.projectId,
      user: this.user,
      at: Date.now(),
    });
  }

  _handle(msg) {
    if (!msg || msg.clientId === this.clientId) return;

    if (msg.type === 'hello') {
      if (this.projectId) this._presence();
      return;
    }

    if (msg.type === 'state') {
      if (msg.projectId && msg.projectId === this.projectId) {
        this.onState(msg.state, msg.clientId);
      }
      return;
    }

    if (msg.type === 'leave') {
      if (this.peers.delete(msg.clientId)) this.onPeers([...this.peers.values()]);
      return;
    }

    if (msg.projectId && msg.projectId !== this.projectId) return;

    if (msg.type === 'presence') {
      const isNew = !this.peers.has(msg.clientId);
      this.peers.set(msg.clientId, {
        clientId: msg.clientId,
        name: msg.user?.name || '协作者',
        color: msg.user?.color || 'violet',
        cursor: this.peers.get(msg.clientId)?.cursor || null,
        lastSeen: Date.now(),
      });
      if (isNew) {
        this.onToast(`${msg.user?.name || '一位协作者'} 加入了协作`);
        this._presence();
      }
      this.onPeers([...this.peers.values()]);
      return;
    }

    if (msg.type === 'cursor') {
      const peer = this.peers.get(msg.clientId) || {
        clientId: msg.clientId,
        name: msg.user?.name || '协作者',
        color: msg.user?.color || 'violet',
        lastSeen: Date.now(),
      };
      peer.cursor = msg.cursor;
      peer.lastSeen = Date.now();
      this.peers.set(msg.clientId, peer);
      this.onPeers([...this.peers.values()]);
    }
  }

  _prune() {
    const cutoff = Date.now() - 6000;
    let changed = false;
    this.peers.forEach((peer, id) => {
      if (peer.lastSeen < cutoff) {
        this.peers.delete(id);
        changed = true;
      }
    });
    if (changed) this.onPeers([...this.peers.values()]);
  }

  destroy() {
    clearInterval(this.heartbeat);
    if (this.channel) {
      this.channel.postMessage({ type: 'leave', clientId: this.clientId });
      this.channel.close();
    }
  }
}
