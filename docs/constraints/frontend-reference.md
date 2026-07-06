# 前端参考

本文保存前端视觉系统、组件系统和代码约束。已经接受的正式规则位于 `docs/engineering/quality.md` 和 Web 源码结构。

前端风格维护覆盖完整的 **视觉系统、组件系统和代码约束**，不只是不只管图标。

约束顺序如下：

## 1. 先维护 Design Tokens

也就是把颜色、字号、间距、圆角、阴影这些基础变量统一起来，不要在页面里到处写散值。

例如：

```css
:root {
  --color-bg: #0f1115;
  --color-surface: #171a21;
  --color-border: #2a2f3a;
  --color-text: #f5f7fa;
  --color-text-muted: #9aa4b2;
  --color-primary: #6c8cff;

  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;

  --font-size-sm: 12px;
  --font-size-md: 14px;
  --font-size-lg: 16px;
}
```

然后页面里尽量写：

```css
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
}
```

不要到处写：

```css
padding: 17px;
border-radius: 13px;
color: #999;
```

这些就是后期风格混乱的源头。

---

## 2. 统一颜色体系

前端颜色不要只维护“主色”。至少要有这些：

```text
背景色：bg / surface / elevated
文字色：text / text-muted / text-disabled
边框色：border / border-strong
品牌色：primary / primary-hover / primary-active
状态色：success / warning / danger / info
交互色：hover / active / selected / focus
```

特别是桌面客户端或工具类产品，建议颜色克制一点：

```text
大面积：中性色
小面积：品牌色
危险操作：红色
成功状态：绿色
警告状态：黄色/橙色
```

不要每个功能都用一种新颜色，否则产品会变成“彩虹后台”。

---

## 3. 统一字体和字号层级

字号最好不要超过 5～6 档。

例如：

```text
12px：辅助信息、caption
14px：正文、表单、菜单
16px：重要正文、小标题
20px：页面标题
24px/28px：大标题
```

同时要统一字重：

```text
400：普通正文
500：按钮、菜单、强调文本
600：标题
700：少量强强调
```

常见错误是：这个页面 13px，那个页面 15px；这个标题 17px，那个标题 22px。肉眼看上去会很乱。

---

## 4. 统一间距系统

建议用 4px 或 8px 作为基础单位。

例如：

```text
4px
8px
12px
16px
24px
32px
48px
```

不要随手写 7px、13px、19px、27px。

布局可以大致这样：

```text
组件内部小间距：4 / 8 / 12
组件 padding：12 / 16 / 24
区块之间：24 / 32
页面大分区：40 / 48
```

风格高级感很大一部分来自间距稳定。

---

## 5. 统一圆角和阴影

圆角不要每个地方都不一样。

例如：

```text
输入框 / 按钮：8px
卡片：12px
弹窗：16px
大容器：20px
```

阴影也要克制。桌面客户端尤其不要满屏大阴影。

建议：

```text
默认组件：不用阴影，靠边框区分
浮层 / Dropdown / Modal：轻阴影
重要弹窗：中等阴影
```

---

## 6. 建立组件规范

不要每个页面自己写 Button、Input、Modal。

至少要封装这些基础组件：

```text
Button
Input
Textarea
Select
Checkbox
Switch
Modal
Drawer
Tooltip
Dropdown
Tabs
Card
Badge
Toast
Sidebar
Topbar
Empty State
Loading State
```

然后所有页面只用这些组件。

例如按钮要统一状态：

```text
default
hover
active
disabled
loading
focus
danger
primary
secondary
ghost
```

一个按钮系统做好，页面会立刻统一很多。

---

## 7. 统一页面布局模式

不只是组件，页面结构也要统一。

比如 Tauri/Web 桌面客户端可以用：

```text
App Shell
├── Sidebar
├── Topbar / Toolbar
├── Main Content
└── Status Bar / Toast Layer
```

常见页面模板可以固定：

```text
列表页：
标题 + 操作按钮 + 筛选区 + 表格/列表 + 分页

详情页：
返回按钮 + 标题区 + 信息区 + 操作区

设置页：
左侧设置导航 + 右侧表单项

空状态：
插图/icon + 标题 + 描述 + 主操作按钮
```

这样新增页面不会越写越像不同产品。

---

## 8. 统一交互状态

很多前端风格不统一，不是因为颜色难看，而是因为状态混乱。

每个可交互元素都要有：

```text
hover
active
focus
disabled
loading
selected
error
success
empty
```

例如输入框：

```text
默认：浅边框
hover：边框稍亮
focus：主色描边或 glow
error：红色边框 + 错误文案
disabled：降低透明度 + 禁止交互
```

不要有的输入框 focus 是蓝色，有的是灰色，有的是阴影。

---

## 9. 统一动效

动效不需要复杂，但要统一。

建议先定：

```text
普通 hover：150ms
弹窗/浮层：200ms
页面切换：200-300ms
缓动：ease-out 或 cubic-bezier
```

常见规则：

```text
hover：轻微颜色变化
button active：轻微下压或缩小
modal：opacity + scale
drawer：translate
toast：slide + fade
```

不要一个地方弹跳，一个地方旋转，一个地方飞入。工具类产品动效越克制越专业。

---

## 10. 统一文案语气

这点容易被忽略。UI 文案也是风格的一部分。

比如按钮文案要统一：

```text
保存
取消
删除
复制
导出
重试
了解更多
```

不要混用：

```text
Save
保存一下
确认保存
提交
OK
完成
```

错误提示也要统一：

```text
不推荐：
出错了！
Oops!
Failed.
请求失败，请稍后再试。
系统异常啦～

推荐：
保存失败，请检查网络后重试。
文件格式不支持。
该名称已存在，请换一个名称。
```

---

## 11. 用 Tailwind / CSS Modules / Theme config 管住样式

如果使用 Tailwind，可以把风格写进 `tailwind.config.ts`：

```ts
export default {
  theme: {
    extend: {
      colors: {
        bg: "var(--color-bg)",
        surface: "var(--color-surface)",
        border: "var(--color-border)",
        text: "var(--color-text)",
        muted: "var(--color-text-muted)",
        primary: "var(--color-primary)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
      },
      spacing: {
        1: "var(--space-1)",
        2: "var(--space-2)",
        3: "var(--space-3)",
        4: "var(--space-4)",
        6: "var(--space-6)",
      },
    },
  },
};
```

然后团队只用这些 class，别随便写任意值：

```tsx
// 推荐
<div className="rounded-md bg-surface p-4 text-text" />

// 少用
<div className="rounded-[13px] bg-[#181818] p-[17px]" />
```

---

## 12. 建一个简单 Style Guide 页面

项目里可以专门有一个页面，例如：

```text
/design-system
```

展示：

```text
颜色
字体
按钮
输入框
卡片
弹窗
表格
图标
空状态
加载状态
错误状态
```

这比写一大篇文档更实用。每次做新页面，直接对照这个页面。

---

## 13. 最推荐的维护结构

前端项目可以这样组织：

```text
src/
├── styles/
│   ├── tokens.css
│   ├── themes.css
│   └── globals.css
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Modal.tsx
│   │   └── Card.tsx
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Topbar.tsx
│   │   └── AppShell.tsx
│   └── icons/
├── pages/
├── hooks/
└── lib/
```

核心原则是：

```text
styles 管基础变量
components/ui 管基础组件
components/layout 管布局
pages 只组合组件，不乱写样式
```

---

## 推荐组合

对于 **Tauri + TypeScript + React/Vue/Svelte** 桌面客户端，建议：

```text
Icon：Lucide / Rounded Outline
颜色：中性色为主 + 一个品牌主色
圆角：8 / 12 / 16
间距：4px 系统
字体：12 / 14 / 16 / 20 / 24
组件：Button/Input/Modal/Card/Toast 先封装
主题：CSS variables 支持 dark/light
动效：150-200ms，克制
页面结构：固定 AppShell + Sidebar + Main
```

核心原则：

**不要靠“每次凭感觉调好看”维护风格，要靠 tokens、组件、布局模板和状态规范来维护风格。**
