/* =========================================================
   METHOD — local AI engine
   无后端：根据意图在本地生成建议与画布操作
   ========================================================= */

const node = (type, x, y, w, h, text, extra = {}) => ({
  type, x, y, w, h, text,
  color: extra.color || 'violet',
  size: extra.size || 'md',
  radius: extra.radius ?? (type === 'shape' ? 16 : 18),
});

const centerOf = (context) => context?.center || { x: 400, y: 300 };

const has = (text, words) => words.some((w) => text.includes(w));

const clean = (text) => text.replace(/\s+/g, ' ').trim();

function summarize(nodes) {
  const filled = nodes.filter((n) => clean(n.text));
  if (!filled.length) {
    return '画布上还没有内容。先放几个便签，或者告诉我你想做什么，我可以帮你搭第一版结构。';
  }
  const lines = filled.slice(0, 7).map((n) => {
    const label = n.type === 'note' ? '便签' : n.type === 'shape' ? '按钮' : '文本';
    const text = clean(n.text).slice(0, 46);
    return `· ${label}｜${text}${n.text.length > 46 ? '…' : ''}`;
  });
  return `目前画布上有 ${filled.length} 个内容块，我读到的重点是：\n\n${lines.join('\n')}\n\n如果继续往下走，我建议先确认一句话主张，再决定哪些内容必须出现在首屏。`;
}

function structure(context) {
  const { x: cx, y: cy } = centerOf(context);
  const hero = node('text', cx - 430, cy - 250, 560, 130, '把想法，变成作品。', { size: 'xl', color: 'slate' });
  const sub = node('text', cx - 430, cy - 100, 440, 76, '一句话解释你为谁解决了什么问题，以及为什么是你。', { size: 'md', color: 'slate' });
  const cta = node('shape', cx - 430, cy - 6, 190, 56, '免费开始 →', { color: 'violet' });
  const a = node('note', cx + 200, cy - 250, 230, 140, '首屏\n主张 + 副主张 + 唯一 CTA', { color: 'violet' });
  const b = node('note', cx + 200, cy - 90, 230, 140, '证据\n客户 Logo、数据、评价', { color: 'cyan' });
  const c = node('note', cx + 465, cy - 250, 230, 140, '能力\n三个真正的差异点', { color: 'pink' });
  const d = node('note', cx + 465, cy - 90, 230, 140, '转化\n定价、FAQ、页脚', { color: 'amber' });
  return {
    text: '我按「首屏 → 证据 → 能力 → 转化」搭了一版产品官网骨架，已经在画布上放好了。\n\n下一步可以告诉我你的产品是什么，我会把占位文案换成具体的表达。',
    action: { type: 'addNodes', nodes: [hero, sub, cta, a, b, c, d] },
  };
}

function brainstorm(context) {
  const { x: cx, y: cy } = centerOf(context);
  const title = node('text', cx - 150, cy - 220, 340, 60, '先发散，再收敛', { size: 'lg', color: 'slate' });
  const a = node('note', cx - 470, cy - 130, 240, 150, '用户真正想要的是什么？\n写下三个答案', { color: 'pink' });
  const b = node('note', cx - 200, cy - 60, 240, 150, '如果只能保留一个功能，会是哪个？', { color: 'violet' });
  const c = node('note', cx + 70, cy - 60, 240, 150, '哪个假设最值得本周验证？', { color: 'cyan' });
  const d = node('note', cx + 340, cy - 130, 240, 150, '怎样让它变得有点惊喜？', { color: 'amber' });
  return {
    text: '给你四个角度，先不评判，把答案写满。\n\n等画布上有足够多的碎片，再让我帮你归类和排序。',
    action: { type: 'addNodes', nodes: [title, a, b, c, d] },
  };
}

function titles(prompt, context) {
  const subject = clean(prompt.replace(/.*(?:关于|为|给)\s*/, '').replace(/[?？。.]/g, '')) || context?.projectTitle || '你的产品';
  return {
    text: `围绕「${subject}」，给你三个方向：\n\n01  克制型：少一点，但每一处都刚好。\n02  行动型：今天，就开始做那件想做很久的事。\n03  画面型：把复杂的部分藏起来，把好用的部分露出来。\n\n如果要更贴切，可以告诉我它的语气：专业、温暖、锋利，还是 playful？`,
  };
}

function colors() {
  return {
    text: '这是一组偏冷静、但有记忆点的配色：\n\n· 紫罗兰 #7C5CFF —— 主行动色，负责被记住\n· 青绿 #00E5C8 —— 成功与灵感，少量点缀\n· 粉 #FF5FA2 —— 情绪高光，用在最想让人停下来的地方\n\n底色保持近黑，留白比装饰更重要。我已经把色板放到画布上了。',
    action: {
      type: 'addNodes',
      nodes: [
        node('shape', 0, 0, 130, 130, 'Violet\n#7C5CFF', { color: 'violet', radius: 26 }),
        node('shape', 160, 0, 130, 130, 'Cyan\n#00E5C8', { color: 'cyan', radius: 26 }),
        node('shape', 320, 0, 130, 130, 'Pink\n#FF5FA2', { color: 'pink', radius: 26 }),
        node('note', 0, 160, 450, 96, '把所有彩色压缩到 10% 的面积里，剩下交给留白。', { color: 'slate' }),
      ],
    },
  };
}

function plan(context) {
  const { x: cx, y: cy } = centerOf(context);
  return {
    text: '一个能真正执行的三阶段节奏：\n\n1. 本周：确认唯一目标，砍掉不影响它的事\n2. 下周：做出一个可以给人看的粗糙版本\n3. 月底：拿真实反馈迭代，而不是继续打磨\n\n我把这三个阶段放到了画布右侧。',
    action: {
      type: 'addNodes',
      nodes: [
        node('note', cx + 120, cy - 250, 250, 170, '本周\n\n· 确认唯一目标\n· 列出不做清单', { color: 'violet' }),
        node('note', cx + 120, cy - 56, 250, 170, '下周\n\n· 做出粗糙版本\n· 找 3 个人试用', { color: 'cyan' }),
        node('note', cx + 120, cy + 138, 250, 170, '月底\n\n· 收集真实反馈\n· 决定加码或转向', { color: 'amber' }),
      ],
    },
  };
}

export const QUICK_PROMPTS = [
  '帮我搭一个产品官网结构',
  '给我一些标题方向',
  '总结一下画布内容',
  '推荐一组配色',
];

export function askAI(prompt, context = {}) {
  const q = (prompt || '').trim();
  const lower = q.toLowerCase();
  const nodes = context.nodes || [];

  if (!q) {
    return { text: '我在。告诉我你想做什么，或者直接让我整理画布。' };
  }

  if (has(q, ['官网', '落地页', '首页', '结构', '大纲', '页面', '网站'])) {
    return structure(context);
  }
  if (has(q, ['便签', '头脑风暴', '灵感', '想法', '发散'])) {
    return brainstorm(context);
  }
  if (has(q, ['标题', '文案', 'slogan', 'slogan', '名字', '命名'])) {
    return titles(q, context);
  }
  if (has(q, ['配色', '颜色', '色板', '风格', '视觉'])) {
    const res = colors();
    const { x: cx, y: cy } = centerOf(context);
    res.action.nodes.forEach((n, i) => {
      if (n.type === 'shape') { n.x += cx - 220; n.y += cy - 100; }
      else { n.x += cx - 220; n.y += cy + 60; }
    });
    return res;
  }
  if (has(q, ['计划', '排期', '节奏', '规划', '执行'])) {
    return plan(context);
  }
  if (has(q, ['总结', '概括', '梳理', '整理画布', '看看画布'])) {
    return { text: summarize(nodes) };
  }
  if (has(q, ['重排', '对齐', '布局', '排一下'])) {
    return { text: '好，我把画布上的内容按阅读顺序重新排了一遍。', action: { type: 'arrange' } };
  }
  if (has(q, ['发布', '上线', '导出'])) {
    return {
      text: '发布前，我会检查三件事：\n\n1. 首屏能不能在 5 秒内说清楚你是谁\n2. 有没有一个且只有一个主要行动\n3. 手机上读起来是否仍然舒服\n\n确认后点右上角的「发布」，METHOD 会把画布导出成一个独立的网页。',
    };
  }
  if (has(q, ['你好', 'hi', 'hello', '在吗', '嗨']) || lower === 'hey') {
    return { text: '我在。这里是你的画布，也是你的第二大脑。\n\n你可以让我：搭结构、写文案、做总结、排布局，或者只是陪你头脑风暴。' };
  }
  if (has(q, ['谢谢', 'thanks', '感谢'])) {
    return { text: '随时。做东西的时候，记得先让第一版存在，再让它变好。' };
  }

  const count = nodes.filter((n) => clean(n.text)).length;
  return {
    text: `收到。「${q.slice(0, 60)}」这件事，我会这样拆：\n\n1. 先定义想要的最终画面\n2. 找出今天就能推进的一小步\n3. 把它变成一个可以给别人看的东西\n\n${count ? `画布上已有 ${count} 个内容块，我可以基于它们继续。` : '现在画布还是空的，要不要我先帮你搭一个结构？'}\n\n也可以直接说「帮我搭一个官网结构」或「总结一下画布内容」。`,
  };
}
