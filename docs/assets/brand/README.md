# Campus Agora Logo 设计稿

Last updated: 2026-10-14

状态：按用户“整体看一下项目，然后设计一个简约 Logo”的要求形成的视觉提案。

## 设计依据

已阅读当前需求分析、产品概览、里程碑、任务设计、UI 规范与 Web 入口。品牌表达个人机会探索、理解比较与自主选择；导师指南是首个场景。

采用“开放罗盘”：C 形圆弧呼应 Campus，留出的开口表示开放的探索范围，独立指针表示由使用者判断方向。以两个主要几何形状保持辨识，省略文字、细小刻度和装饰。主色目标为现有 Primer 蓝 `#0969DA`；不将其称为学校官方色。若后续配字，保留 Campus Agora，使用系统无衬线字体和正常字距。

## 文件与检查

- [透明底 PNG](campus-agora-logo-v1.png)：1254 × 1254，内置 image_gen 生成，并针对透明区域杂点与填色进行一次清理。
- 原尺寸视觉检查：C 形轮廓与指针分离，留白充足；没有文字、刻度、阴影或新增装饰。
- 网页另有同构图的[轻量矢量版本](../../../apps/web/src/assets/campus-agora-mark.svg)，已用于页首与浏览器 favicon，避免加载大尺寸 PNG。原始图稿保留；品牌素材不替换任何 Octicons 功能图标。

## 生成提示词

模式：内置 image_gen，`transparent_background: true`；未使用 API／CLI 回退。以下为实际使用的完整提示词，便于后续修订。

### 初稿

```text
Use case: logo-brand
Asset type: a standalone minimalist brand symbol for Campus Agora, a personal university opportunity discovery and decision-support tool.
Primary request: Design one refined, original, extremely simple "open compass" logo. The product helps a person discover possibilities across institutions, understand differences, and choose their own direction. Advisor exploration is its first use case, but the symbol must suit broader opportunities and resources.
Subject and geometry: exactly two flat blue components. First, a confident thick circular arc, nearly three quarters of a circle, suggesting the letter C, with a generous opening toward the upper right. Second, one short solid geometric compass needle, shaped like a refined asymmetric kite or triangular wedge, aimed diagonally toward that opening. The pointer is clearly detached from the arc and optically balanced with it. Strong readable silhouette, broad negative space, consistent visual weight, very few contours. It should look carefully drawn by a professional identity designer, not an interface icon or clip art. Prioritize compact elegance and recognition at small sizes.
Style/medium: crisp flat vector-like graphic, perfectly smooth geometric edges, no physical textures.
Composition/framing: square canvas, one isolated centered logo, logo fills about 70 percent of canvas, generous even transparent margins.
Color palette: one uniform solid Primer blue #0969DA, genuine transparent background. No other ink colors.
Text: none; symbol only.
Constraints: only one logo, no presentation board, no variants, no wordmark, no slogan, no labels, no watermark. No shadows, gradients, glow, outlines around filled shapes, 3D, paper, mockups, decorative dots, tick marks, compass letters or fine details. No graduation cap, school crest, classical columns, chat bubble, people, trophy, AI sparkle, or growth chart. Do not imitate any existing company's logo.
```

### 清理修订

以上一张生成图为编辑对象，保留整体图形与构图。

```text
Use case: precise-object-edit
Edit target: the attached blue Campus Agora open-compass logo.
Change only rendering cleanliness, preserving the existing two-component logo silhouette, orientation, placement, proportions, and broad spacing.
Make both the C-shaped circular arc and the detached compass needle completely uniform flat solid blue #0969DA, without any texture, shading, dark outlines, mottling or highlights. Make boundaries perfectly smooth and crisp, like an exported vector identity mark. Remove every stray blue fleck, scratch, isolated pixel or fragment in all negative space and outside the two main shapes. Empty areas must be genuinely transparent and entirely clean. Keep the background transparent. Do not add text, extra shapes, effects, shadows or gradients.
Final deliverable: one immaculate transparent PNG logo, suitable for a professional minimalist brand.
```

