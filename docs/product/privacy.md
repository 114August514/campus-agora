# Privacy And Data Boundaries

Last updated: 2026-10-03

当前个人使用工具采用下节边界，与[需求主稿](requirements-handoff.md)和[任务设计](advisor-task-design.md)共同维护；这些是待实现与验证的要求，不表示已接入AI服务。后面的社区数据设计为历史记录，不产生账号、校园身份、审核或匿名功能任务。适用的数据保护与工程要求仍需遵循。

## 当前个人使用工具的数据边界

### 公共资料与私人主题

公共资料组织人物／团队、研究工作、参与途径、资源和可追溯来源。探索主题中的问题、偏好、候选关联、私人理由、笔记和待问事项默认私有；公共候选可以复用，私人记录按主题分别保存。修改或删除主题A不改变主题B和公共资料，公共事实更正也不静默改写私人理由或原引用依据。

### 仅发送用户明确选择的个人内容

2026-10-03用户确认：仅向外部AI发送用户明确选择的个人内容。发送前能查看本次选中的内容／片段、接收服务和用途，并取消选择或不发送；发送操作可完成本次确认，不要求重复确认。明确标注为发送给外部AI的操作中，用户主动提交当前问题可以构成对该问题的选择，不延伸为整个主题或其他主题的许可。

请求只包含这次选择的个人内容及任务所需公共依据。保存、浏览、切换主题、选中某个公共导师或过去的一次发送，都不构成其他私人内容的发送许可。关键词展开、摘要、比较、重试及历史上下文均遵守同一选择边界；不能把未选择的私人理由改写为关键词或摘要后发送。由个人内容生成的AI解释／摘要同样按私人内容处理，不自动公开或用于别的主题。

用户取消选择后，后续请求不再附带该内容，也不自动沿用含该内容的外部会话上下文。请求构建不得自动读取其他主题的个人内容，错误日志不记录私人原文。未选择个人内容时，公共资料发现、浏览、比较、保存和官方入口仍可使用。

### 发送状态与取消

内容选择不等于实际发送。能够确认请求未发出时显示“尚未发送”，已发出时显示“已发送，等待结果”，收到响应后显示结果或服务返回错误。超时、断连或取消导致无法确认送达时，显示“发送状态未确认，可能已发送”；不会把未收到结果当作没有传输，也不宣称中止已撤回内容。

取消选择或中止任务阻止后续请求，按工具能力尝试取消在途请求；已经发出的内容可能仍由外部服务处理。主动重试前能查看当前选中的内容／片段、接收服务和前次状态，不自动增加个人内容，也不因超时无限重发。具体状态证据和服务取消能力在接入时核对，不把本产品停止等待等同于外部服务停止处理。

### 保存、删除与服务说明

demo声明支持的设备／浏览器与本地或服务端保存范围；多个主题须关闭页面重开后可恢复。删除主题或候选记录时说明影响范围，不把清理私人记录等同于删除公共来源或其他主题。

具体存储、AI服务、服务方保留与删除条件在相应实现前确定。本地删除、取消选择只描述本产品实际能够完成的行为，不宣称外部服务已删除先前收到的内容。无已核对服务方案时不承诺外部删除期限或不保留数据。

### 验证要求

使用合成的私人理由与笔记，检查实际发出的请求及后续请求：只选择A的一条理由时，不含A的其他笔记、B的内容或整份探索记录；取消后不再发送或续用该内容。检查AI输出保持在对应私人主题，主题A修改／删除及公共资料更新不改变B的私人记录。服务失败不丢失已有资料或已存私人记录。合成数据验证不能冒充真实学生使用或收益测量。

同时模拟未发送、等待、返回、超时／断连和中止，检查发送状态与可观察证据一致；送达不明时保留“可能已发送”，重试仍只发送当前明确选择内容。修正误合并的公共对象时，私人理由、待问项和原引用保留；原关联不明时交由用户确认，不复制到所有拆出的对象。

## 历史社区设计（不产生当前功能任务）

以下内容保留旧数据清单、角色与保留设想；涉及实际采用的能力时按当前个人使用要求重新评估，不默认采用其中的存储、管理角色或功能。

Campus Agora handles campus community content. Privacy rules must be explicit
before real identity integration, attachments, or AI assistance are added.

### Data Inventory

| Data | Purpose | Storage | Access |
| --- | --- | --- | --- |
| Account profile | Identify authenticated users and display ownership | PostgreSQL | User, moderators, admins |
| Campus identity reference | Link account to campus auth provider | PostgreSQL | Auth service, admins |
| Discussion content | Community discussion and later archive source | PostgreSQL | Readers based on visibility |
| Archive content | Durable knowledge entries | PostgreSQL | Readers based on visibility |
| Moderation state | Review status and safety decisions | PostgreSQL | Moderators, admins |
| Audit events | Accountability for high-risk actions | PostgreSQL | Admins, security reviewers |
| Request logs | Debugging and abuse response | Log backend | Operators |
| Attachments | Future file support | Object storage | Permission checked at download |
| AI outputs | Future draft assistance | PostgreSQL or object storage | Authors, reviewers, admins |

### Collection Principles

- Collect the minimum data needed for campus knowledge workflows.
- Do not store raw campus SSO assertions after login exchange.
- Do not put secrets, tokens, passwords, or raw identity payloads in logs.
- Do not store real student data in seed data, mock data, tests, or AI LOG.

### Retention

Default retention targets:

| Data Category | Product Retention Boundary |
| --- | --- |
| Business content | Retained while visible, drafted, recoverable, or needed for account-visible history. |
| Soft-deleted content | Retained until policy-driven purge is approved. |
| Audit logs | Retained longer than operational request logs because they explain risk actions. Exact production duration must be set before real auth, moderation, or admin actions launch. |
| Request logs | Short operational retention, enough for debugging and abuse response. |
| Backups | Retained by environment policy and purged on schedule. |
| Attachments | Retained no longer than the owning content unless legal, abuse-response, or safety review requires a hold. |
| AI outputs | Retained according to the source draft, archive entry, or review task they support. |

### Deletion And Export

Users should be able to request export or deletion of personal data when the
feature exists. Deletion behavior must distinguish:

- Content removal from public visibility.
- Soft deletion for recovery and moderation review.
- Hard deletion after retention and audit requirements are satisfied.
- Backup expiry, where deleted data may remain until backup rotation completes.

No user-generated content should be hard deleted without permission checks,
audit events, and recovery impact review.

### Anonymous Semantics

Future anonymous or pseudonymous posting must not mean unaccountable posting.
The UI may hide identity from normal readers, but the backend must retain enough
auditable linkage for moderation and abuse response, with access limited to
authorized reviewers.

### Third Parties

M0.2 assumes no third-party analytics, file scanning, AI provider, email
delivery, or object storage integration. Adding any third party requires a doc
update covering data sent, purpose, retention, user visibility, and failure
mode.
