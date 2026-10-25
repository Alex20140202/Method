# METHOD

一个纯静态的「超级网站」——为创意工作台品牌 METHOD 打造的现代落地页。
不依赖任何框架与构建工具，打开即用。

## 本地运行

```bash
cd Method
python3 -m http.server 8123
```

然后访问 <http://localhost:8123>。

也可以直接双击 `index.html` 打开（字体与部分浏览器策略在 `file://` 下可能略有差异，推荐用本地服务器）。

## 目录结构

```
Method/
├── index.html
├── assets/
│   ├── css/style.css
│   └── js/main.js
├── README.md
└── favicon（内嵌于 HTML）
```

## 包含的交互

- **品牌视觉**：极光渐变背景 + 星空粒子网络（Canvas，随鼠标吸附/排斥）
- **开场动画**：Logo 预加载进度，平滑淡出
- **Hero**：渐变流动标题、打字机文案、3D 光球与视差悬浮卡片
- **滚动体验**：顶部阅读进度条、分区高亮导航、滚动渐显与错峰入场
- **数据动效**：进入视口自动数字滚动
- **Bento 能力卡**：鼠标聚光 + 3D 倾斜 + 微型动效演示
- **作品案例**：悬停缩放与光泽细节
- **流程 / 评价**：无缝滚动跑马灯，悬停暂停
- **定价**：月付 / 年付切换，价格数字平滑过渡
- **FAQ**：手风琴式展开，同时只保留一项
- **命令面板**：`⌘K` / `Ctrl+K` 或 `/` 呼出，可搜索并跳转、切换主题、播放演示
- **明暗主题**：默认深色，手动切换后记忆到 `localStorage`
- **完整响应式**：桌面 / 平板 / 手机三档布局
- **无障碍**：键盘焦点样式、`aria` 属性、`prefers-reduced-motion` 降级
- **回到顶部** + 演示视频弹窗（占位，可替换为真实视频）

## 自定义指南

| 想改什么 | 去哪里 |
| --- | --- |
| 品牌名、文案、分区 | `index.html` |
| 主色、圆角、间距、字体 | `assets/css/style.css` 顶部 `:root` 与 `[data-theme]` |
| 粒子数量、动画时长、打字内容 | `assets/js/main.js`（`buildDots`、`phrases`、各 `setTimeout`） |
| 定价数字 | HTML 中 `.amount` 的 `data-monthly` / `data-yearly` |
| 演示视频 | 把 `#videoModal` 内的舞台替换为 `<video>` 或 `<iframe>` |

### 换主题色

只需修改 `:root` 里的几个变量：

```css
--violet: #7c5cff;
--cyan: #00e5c8;
--pink: #ff5fa2;
--grad: linear-gradient(110deg, #7c5cff, #4f9dff, #00e5c8);
```

### 接入真实视频

```html
<!-- 替换 .modal__stage 内部 -->
<video src="assets/demo.mp4" controls autoplay style="width:100%;height:100%;object-fit:cover"></video>
```

## 性能说明

- 无第三方 JS 依赖；唯一外部资源是 Google Fonts，可按需移除以完全离线。
- Canvas 根据屏幕面积动态计算粒子数，并限制 DPR 为 2。
- 所有动画基于 `transform` / `opacity`，滚动监听使用 `requestAnimationFrame` 节流。
- 尊重 `prefers-reduced-motion`，自动关闭动态效果。

## 浏览器支持

Chrome / Edge / Safari / Firefox 近两年版本（使用了 `color-mix()`、`:has()` 之外的现代 CSS）。
