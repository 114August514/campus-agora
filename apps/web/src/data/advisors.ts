// Fixed demo data from the 2026-09-29 bounded trial
// (tools/prototypes/opportunity-content.md, docs/constraints/mentor-source-reference.md).
// Editorial order only: not a ranking, recommendation or complete search result.
import type { Advisor } from "./types";

export const FIXED_DATA_AS_OF = "2026-09-29";

export const advisors: Advisor[] = [
  {
    id: "wang-xiang",
    name: "王翔",
    affiliation: "中国科学技术大学",
    region: "内地",
    question: "修改大模型中的错误知识时，怎样尽量保留其他知识？",
    work: {
      title: "AlphaEdit",
      explanation: "约束参数更新的方向，以减少对原有知识的干扰。",
      authorshipNote:
        "王翔是共同作者；一项合作不能代表全部研究，也不能确定日常指导人。",
      links: [
        {
          label: "论文摘要（ICLR 2025）",
          url: "https://proceedings.iclr.cc/paper_files/paper/2025/hash/29c8c615b3187ee995029284702d3f43-Abstract-Conference.html",
          checkedAt: "2026-09-29",
        },
        {
          label: "本人研究介绍",
          url: "https://xiangwang1223.github.io/",
          checkedAt: "2026-09-29",
        },
      ],
    },
    routes: [
      {
        id: "wang-xiang-undergrad",
        kind: "undergrad_research",
        title: "本科科研／毕业设计",
        status: "explicit",
        basis: "校内主页长期欢迎本科科研和毕业设计。",
        applicability: "长期说明，未写明年份",
        pending: "当前是否接收、具体课题与时间待核。",
        entry: {
          label: "校内主页",
          url: "https://faculty.ustc.edu.cn/xiangwang/zh_CN/index.htm",
          checkedAt: "2026-09-29",
        },
      },
      {
        id: "wang-xiang-graduate",
        kind: "graduate_application",
        title: "硕士／博士申请",
        status: "explicit",
        basis: "校内主页长期欢迎硕博申请。",
        applicability: "长期说明，未写明年份",
        pending: "目标年度的院系项目与名额待核。",
        entry: {
          label: "校内主页",
          url: "https://faculty.ustc.edu.cn/xiangwang/zh_CN/index.htm",
          checkedAt: "2026-09-29",
        },
      },
    ],
    experience: {
      known: "本轮没有收集到可回答反馈频率、工作安排的独立经历。",
      links: [],
    },
    unknowns: ["当前名额", "具体可参与课题", "实际指导方式"],
    sourceNotes: ["校内主页含较早的统计与院系表述，不能当作实时名额表。"],
    preparation:
      "想读懂问题，可以先读论文摘要和方法例子；想动手时再看代码对设备的要求。不需要先申请算力才能继续比较。",
    sources: [
      {
        label: "校内主页",
        url: "https://faculty.ustc.edu.cn/xiangwang/zh_CN/index.htm",
        checkedAt: "2026-09-29",
      },
      {
        label: "本人主页",
        url: "https://xiangwang1223.github.io/",
        checkedAt: "2026-09-29",
      },
    ],
  },
  {
    id: "xiong-yingfei",
    name: "熊英飞",
    affiliation: "北京大学",
    region: "内地",
    question: "一段代码是否真的满足用自然语言写出的要求？",
    work: {
      title: "HoarePrompt",
      explanation: "让模型逐步描述程序状态，再检查要求是否满足；借鉴程序验证的思想。",
      authorshipNote: "熊英飞是共同作者，不能据此指定实际指导人。",
      links: [
        {
          label: "论文摘要与引言",
          url: "https://arxiv.org/pdf/2503.19599",
          checkedAt: "2026-09-29",
        },
        {
          label: "近期工作",
          url: "https://xiongyingfei.github.io/",
          checkedAt: "2026-09-29",
        },
      ],
    },
    routes: [],
    routeGap:
      "本轮读取的机构页和个人页没有明确的当期招生途径。决定进一步了解时，再核对院系招生通知与本人公开联系入口。",
    experience: {
      known: "本轮没有收集到可回答反馈频率、工作安排的独立经历。",
      links: [],
    },
    unknowns: ["参与途径", "当前名额", "实际指导方式"],
    sourceNotes: [
      "不同页面的职称表述不一致；不据此排序。",
      "机构页原个人站链接返回 502，经一次检索找到新站。",
    ],
    preparation: "可以先读论文摘要与引言，看自己是否想继续追问“代码满足要求”怎样判断。",
    sources: [
      {
        label: "机构页",
        url: "https://cs.pku.edu.cn/info/1084/1716.htm",
        checkedAt: "2026-09-29",
      },
      {
        label: "本人英文页",
        url: "https://xiongyingfei.github.io/",
        checkedAt: "2026-09-29",
      },
      {
        label: "本人中文页",
        url: "https://xiongyingfei.github.io/index_cn.html",
        checkedAt: "2026-09-29",
      },
    ],
  },
  {
    id: "tianqi-chen",
    name: "Tianqi Chen",
    affiliation: "卡内基梅隆大学（CMU）",
    region: "美国",
    question: "多张 GPU 一起推理时，怎样安排计算和通信，减少等待？",
    work: {
      title: "MPK",
      explanation: "以编译和运行时调度组织 GPU 任务，涉及算子融合与调度。",
      authorshipNote:
        "会议论文列有多位作者；共同署名只能建立作品关联，不能确认未来由谁指导。",
      links: [
        {
          label: "MPK 项目说明",
          url: "https://catalyst.cs.cmu.edu/projects/mpk.html",
          checkedAt: "2026-09-26",
        },
        {
          label: "OSDI 论文页面",
          url: "https://www.usenix.org/conference/osdi26/presentation/cheng",
          checkedAt: "2026-09-26",
        },
      ],
    },
    routes: [
      {
        id: "tianqi-chen-phd",
        kind: "graduate_application",
        title: "博士：CMU MLD／CSD 项目",
        status: "explicit",
        basis: "本人 FAQ 说明博士通过 CMU SCS 的 MLD／CSD 项目申请，由委员会审阅。",
        pending: "本轮未核当前截止日期与名额。",
        entry: {
          label: "本人 FAQ",
          url: "https://tqchen.com/faq",
          checkedAt: "2026-09-29",
        },
      },
      {
        id: "tianqi-chen-cmu-students",
        kind: "undergrad_research",
        title: "本科／硕士项目参与",
        status: "explicit",
        basis: "FAQ 单列的本科／硕士项目机会。",
        applicability: "仅面向 CMU 在读学生，不能直接套给科大在读者",
        pending: "外校短期科研是否另有途径未知。",
        entry: {
          label: "本人 FAQ",
          url: "https://tqchen.com/faq",
          checkedAt: "2026-09-29",
        },
      },
    ],
    experience: {
      known: "本轮没有收集到可回答反馈频率、工作安排的独立经历。",
      links: [],
    },
    unknowns: ["目标年度名额", "外校短期接收", "实际指导方式"],
    sourceNotes: ["MPK 方法说明复用 9月26日已读资料，本轮未重读全文。"],
    preparation:
      "先读项目说明，看看自己是否想继续理解计算、通信与调度的关系；不要求先复现项目。",
    sources: [
      { label: "本人主页", url: "https://tqchen.com/", checkedAt: "2026-09-29" },
      { label: "本人 FAQ", url: "https://tqchen.com/faq", checkedAt: "2026-09-29" },
    ],
  },
  {
    id: "charles-zhang",
    name: "Charles Zhang",
    affiliation: "香港科技大学（HKUST）",
    region: "香港",
    question: "大型软件里，某个值怎样跨模块传递并导致缺陷？",
    work: {
      title: "Clearblue",
      explanation: "以图表示数据与控制依赖，组织程序依赖分析，帮助理解程序和检查缺陷。",
      authorshipNote:
        "本人主页明确关联 Clearblue，并介绍 LLVM IR 与 LLM agents 的结合；旧的编程模型文档不能证明该组所有研究都属于智能体方向。",
      links: [
        {
          label: "研究介绍",
          url: "https://www.cse.ust.hk/~charlesz/",
          checkedAt: "2026-09-29",
        },
        {
          label: "编程模型例子",
          url: "https://www.clearblueinnovations.org/docs/3-programming-model/",
          checkedAt: "2026-09-26",
        },
      ],
    },
    routes: [
      {
        id: "charles-zhang-graduate",
        kind: "graduate_application",
        title: "HKUST CSE 研究生（MPhil／PhD）",
        status: "institutional",
        basis: "教师隶属该院系，院系有研究生招生入口。",
        pending: "个人名额与接收方式须另核；主页的研究科学家岗位不是硕博招生。",
        entry: {
          label: "院系研究生入口",
          url: "https://cse.hkust.edu.hk/pg/admissions/",
          checkedAt: "2026-09-29",
        },
      },
      {
        id: "charles-zhang-ugvis",
        kind: "short_visit",
        title: "UGVIS 短期科研访问",
        status: "unconfirmed",
        basis: "校级制度要求申请前取得教师同意。",
        pending: "尚无其本人接收这一途径的证据，不能当作该导师开放短访。",
        entry: {
          label: "UGVIS 说明",
          url: "https://www.join.hkust.edu.hk/admissions/visiting",
          checkedAt: "2026-09-29",
        },
      },
    ],
    experience: {
      known:
        "本人主页与一位校友的本人页可以互相补充这位校友的指导关系和去向。这不能回答反馈频率、工作安排，也不代表指导质量。",
      links: [
        {
          label: "本人主页（校友列表）",
          url: "https://www.cse.ust.hk/~charlesz/",
          checkedAt: "2026-09-29",
        },
        {
          label: "校友本人页",
          url: "https://chengpeng-wang.github.io/",
          checkedAt: "2026-09-29",
        },
      ],
    },
    unknowns: ["目标年度个人名额", "短期访问接收", "日常指导方式"],
    sourceNotes: ["校友旧链接返回 404，经一次检索找到本人新页。"],
    preparation: "可以先看文档里的数据流小例子，看看自己是否想追问缺陷出现的条件。",
    sources: [
      {
        label: "本人主页",
        url: "https://www.cse.ust.hk/~charlesz/",
        checkedAt: "2026-09-29",
      },
      {
        label: "院系研究生入口",
        url: "https://cse.hkust.edu.hk/pg/admissions/",
        checkedAt: "2026-09-29",
      },
    ],
  },
];

export const suggestedQuestions = [
  "这项课题通常由谁直接指导？",
  "最近一次研究进展不顺时，团队如何帮助调整？",
  "本科／短期参与者能承担怎样的工作？",
];

export function findAdvisor(id: string): Advisor | undefined {
  return advisors.find((a) => a.id === id);
}
