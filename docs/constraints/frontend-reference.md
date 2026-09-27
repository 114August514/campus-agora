# 前端约束参考

Last updated: 2026-09-24

现行规范为[UI 组件与视觉规范](../product/ui-system.md)，本页作为阅读入口。2026-09-24 用户要求取代了旧版自由 CSS／Tailwind／卡片与字体建议，不得从旧提交恢复那些规则。

- 唯一体系：Primer React Product UI、Primer Primitives、Octicons。
- 固定浅色中性画布、标准蓝色交互、系统无衬线字体和默认字距。
- 禁止 Emoji 图标、eyebrow、副标题、渐变、边框内容卡、展示性等宽字体和拉大字间距。
- 禁止 Tailwind、自写 CSS、CSS Modules、style、sx、CSS-in-JS；仅库样式、库组件公开布局属性与统一声明式主题配置。
- 先查官方示例和真实任务页面；参考网站不能覆盖上述规则。
- 旧 Web 和独立 HTML 原型尚待迁移，不能宣称当前代码已经符合新规则。

实现仍需遵守[质量门禁](../engineering/quality.md)。组件库不能替代交互、保存恢复、移动宽度、键盘与可读性检查。
