import type { Advisor } from "./advisors";
import type { SourceSnapshot } from "./exploration-store";

export type ComparisonPerspective = "research" | "graduate" | "short-term";
export type ResearchFocus = "open" | "software" | "ai-systems";

export type InternshipPerspective = "role" | "growth" | "practical";
export type InternshipFocus = "open" | "systems" | "evaluation";

export type AnyComparisonPerspective = ComparisonPerspective | InternshipPerspective;
export type AnyComparisonFocus = ResearchFocus | InternshipFocus;

export interface ComparisonCell {
  candidateId: string;
  text: string;
  sources: SourceSnapshot[];
}

export interface ComparisonRow {
  id: string;
  label: string;
  cells: ComparisonCell[];
}

export const comparisonSupportedCandidateIds = [
  "zuming-jiang",
  "zhuoran-song",
] as const;

export const internshipComparisonSupportedCandidateIds = [
  "sh-ai-lab-eval-intern",
  "msra-systems-intern",
] as const;

interface SourceBoundText {
  text: string;
  urls: string[];
}

interface ComparisonProfile {
  research: SourceBoundText;
  methods: SourceBoundText;
  routes: Record<Exclude<ComparisonPerspective, "research">, SourceBoundText>;
  unknowns: SourceBoundText;
  next: Record<ComparisonPerspective, SourceBoundText>;
  focus: Record<Exclude<ResearchFocus, "open">, SourceBoundText>;
}

const batchId = "xhs-recruitment-2026-10-05";
const collectedAt = "2026-10-05T12:24:39.000Z";
const jiang = {
  recruitment: "https://www.xiaohongshu.com/explore/6a6ec878000000003302c3c2",
  official: "https://www.cs.hku.hk/people/academic-staff/jzuming",
  home: "https://jzuming.github.io/",
  lab: "https://jzuming.github.io/lab.html",
};
const song = {
  recruitment: "https://www.xiaohongshu.com/explore/6aae08600000000026014ac1",
  official: "https://www.cs.sjtu.edu.cn/jiaoshiml/songzhuoran.html",
  home: "https://songzhuoran.github.io/",
};

// These are bounded interpretations of the collected batch, not live AI output.
// Require the same snapshots before reusing a claim with its specific evidence.
const profiles: Record<string, ComparisonProfile> = {
  "zuming-jiang": {
    research: {
      text: "数据库、操作系统、安全与软件工程；也研究 AI 与系统的结合。",
      urls: [jiang.official],
    },
    methods: {
      text: "通过测试、形式验证与程序分析，研究系统可靠性、安全与性能。",
      urls: [jiang.official],
    },
    routes: {
      graduate: {
        text: "招生帖提出 2027 级博士意向；主页列有资助的 PhD 机会，可从 CV 与研究兴趣／计划开始沟通。当前名额和申请资格仍待确认。",
        urls: [jiang.recruitment, jiang.home],
      },
      "short-term": {
        text: "主页列 RA 机会，成员页有 RA／visiting students。是否接收当前身份的本科生、访问期限和安排尚未知。",
        urls: [jiang.home, jiang.lab],
      },
    },
    unknowns: {
      text: "具体课题、当前名额和 RA 条件未知；招生帖第二张图片未读。成员列表与作者自述不能说明实际指导体验。",
      urls: [jiang.recruitment, jiang.home, jiang.lab],
    },
    next: {
      research: {
        text: "如果想继续了解，可沿数据库、系统安全或程序分析选一项具体工作，看看研究问题是否有趣。",
        urls: [jiang.official],
      },
      graduate: {
        text: "如果准备进一步了解，可先核对目标年份的博士资格与截止时间，再围绕一个具体研究问题整理兴趣。",
        urls: [jiang.recruitment, jiang.home],
      },
      "short-term": {
        text: "如果想先尝试，可先问 RA／短期科研是否接收当前身份、谁实际指导，以及可参与的课题与期限。",
        urls: [jiang.home, jiang.lab],
      },
    },
    focus: {
      software: {
        text: "如果你关心软件可靠性、安全或程序分析，江祖铭的测试与形式验证方向值得继续读；这说明研究问题相关，不代表个人适配已经确定。",
        urls: [jiang.official],
      },
      "ai-systems": {
        text: "如果你关心 AI 与系统结合，可继续查江祖铭的具体交叉课题；目前的方向说明不足以确定它与 GPU／模型加速的重合程度。",
        urls: [jiang.official],
      },
    },
  },
  "zhuoran-song": {
    research: {
      text: "面向大模型与具身智能的智能计算系统，涉及 GPU／体系结构及软硬件优化。",
      urls: [song.official, song.home],
    },
    methods: {
      text: "从 VLA／LLM 加速、三维重建、AI 加速器与 GPU 体系结构等工作，区分自己更关注模型应用还是系统优化。",
      urls: [song.recruitment, song.home],
    },
    routes: {
      graduate: {
        text: "招生图提出 2027 级工程博士／硕士的创芯学院联合培养意向。相关技术经验是示例；学位类别、资格和名额需再核对官方规则。",
        urls: [song.recruitment],
      },
      "short-term": {
        text: "已读招生图说明工程博士／硕士意向，未提供明确的本科科研、RA 或短访安排。这些途径仍未知，可以继续询问。",
        urls: [song.recruitment],
      },
    },
    unknowns: {
      text: "联合培养资格、具体安排和剩余名额待确认；教师页职称字段与正文冲突。当前资料没有独立指导体验依据。",
      urls: [song.recruitment, song.official],
    },
    next: {
      research: {
        text: "如果想继续了解，可挑一项 VLA／LLM 加速工作，看看更吸引你的是模型任务、GPU 优化还是体系结构。",
        urls: [song.home],
      },
      graduate: {
        text: "如果考虑这一途径，可先确认联合培养的招生单位、学位类别与资格，再按感兴趣方向说明相关学习／项目经历。",
        urls: [song.recruitment],
      },
      "short-term": {
        text: "如果想先尝试，可先问是否接收本科科研／短期参与，以及实际指导人、期限和可参与课题。",
        urls: [song.recruitment],
      },
    },
    focus: {
      software: {
        text: "如果你说的“软件”更偏系统优化，宋卓然的模型加速与 GPU 方向也可能相关；若更关心测试或程序分析，仍需查具体课题。",
        urls: [song.home],
      },
      "ai-systems": {
        text: "如果你关心模型推理、GPU 或 AI 系统优化，宋卓然的 VLA／LLM 加速工作值得继续读；有兴趣不等于具备招生资格。",
        urls: [song.home],
      },
    },
  },
};

function bindText(advisor: Advisor, claim?: SourceBoundText): ComparisonCell {
  if (!claim) {
    return {
      candidateId: advisor.candidateId,
      text: "尚未整理此项比较，仍可查看候选已有资料。",
      sources: [],
    };
  }
  const sources = claim.urls.map((url) =>
    advisor.sources.find(
      (source) =>
        source.url === url &&
        source.collectedAt === collectedAt &&
        source.collection?.batchId === batchId,
    ),
  );
  if (sources.some((source) => !source)) {
    return {
      candidateId: advisor.candidateId,
      text: "该项比较所需的采集依据不完整，暂不能确认；可回到详情检查已有来源。",
      sources: [],
    };
  }
  return {
    candidateId: advisor.candidateId,
    text: claim.text,
    sources: sources as SourceSnapshot[],
  };
}

export function buildComparisonRows(
  advisors: Advisor[],
  perspective: ComparisonPerspective,
): ComparisonRow[] {
  const rows: { id: string; label: string; field: keyof ComparisonProfile }[] = [
    { id: "research", label: "研究什么", field: "research" },
    { id: "methods", label: "怎样研究", field: "methods" },
  ];
  if (perspective !== "research") {
    rows.push({ id: "route", label: "参与途径", field: "routes" });
  }
  rows.push(
    { id: "unknowns", label: "还有哪些未知", field: "unknowns" },
    { id: "next", label: "可以继续了解什么", field: "next" },
  );
  return rows.map(({ id, label, field }) => ({
    id,
    label,
    cells: advisors.map((advisor) => {
      const profile = profiles[advisor.candidateId];
      let claim: SourceBoundText | undefined;
      if (field === "routes") {
        if (perspective !== "research") claim = profile?.routes[perspective];
      } else if (field === "next") {
        claim = profile?.next[perspective];
      } else if (field !== "focus") {
        claim = profile?.[field];
      }
      return bindText(advisor, claim);
    }),
  }));
}

export function buildResearchFocusHints(
  advisors: Advisor[],
  focus: ResearchFocus,
): ComparisonCell[] {
  if (focus === "open") return [];
  return advisors.map((advisor) =>
    bindText(advisor, profiles[advisor.candidateId]?.focus[focus]),
  );
}

const internshipBatchId = "internship-batch-2026-10-16";
const internshipCollectedAt = "2026-10-16T12:00:00.000Z";

const shLab = {
  careers: "https://www.shlab.org.cn/careers/intern",
  github: "https://github.com/open-compass/opencompass",
};
const msra = {
  careers:
    "https://www.microsoft.com/en-us/research/lab/microsoft-research-asia/careers/",
};

interface InternshipComparisonProfile {
  role: SourceBoundText;
  methods: SourceBoundText;
  routes: Record<Exclude<InternshipPerspective, "role">, SourceBoundText>;
  unknowns: SourceBoundText;
  next: Record<InternshipPerspective, SourceBoundText>;
  focus: Record<Exclude<InternshipFocus, "open">, SourceBoundText>;
}

const internshipProfiles: Record<string, InternshipComparisonProfile> = {
  "sh-ai-lab-eval-intern": {
    role: {
      text: "开源大模型全生命周期评测体系、红蓝对抗与安全对齐工具链开发；参与 OpenCompass 核心模块研发。",
      urls: [shLab.careers, shLab.github],
    },
    methods: {
      text: "基于 Python 与 PyTorch 进行大模型探针设计、越狱对抗防御与安全基准测试；结合算力集群开展实验。",
      urls: [shLab.careers, shLab.github],
    },
    routes: {
      growth: {
        text: "提供高算力集群支持与实验室资深研究员联合指导；支持开源社区贡献与高水平学术论文发表。校招转正需依当届统招政策与名额确定。",
        urls: [shLab.careers],
      },
      practical: {
        text: "要求每周现场出勤至少 4 天，连续实习不少于 4 个月。地点在上海徐汇。异地房补与餐补需与 HR 进一步沟通。",
        urls: [shLab.careers],
      },
    },
    unknowns: {
      text: "当期转正指标、异地住宿补贴标准与具体业务团队归属待 HR 进一步确认。",
      urls: [shLab.careers],
    },
    next: {
      role: {
        text: "可先查阅 OpenCompass 开源仓库的代码与评测基准，评估是否对评测套件与安全攻防感兴趣。",
        urls: [shLab.github],
      },
      growth: {
        text: "若看重学术产出，可先确认意向课题方向及发表署名规范；若看重就业转正，需提前询问往届转正比例。",
        urls: [shLab.careers],
      },
      practical: {
        text: "需核实本学期课业与学分安排是否支持全职出勤，并向学院/导师沟通校外实习报备。",
        urls: [shLab.careers],
      },
    },
    focus: {
      systems: {
        text: "如果你更关注超大规模分布式训练与底层系统，该岗位的评测与对齐工具链可能更偏应用与算法层。",
        urls: [shLab.github],
      },
      evaluation: {
        text: "如果你关注大模型能力评测、安全基准与对齐，上海AI实验室的 OpenCompass 项目是国内核心标杆之一。",
        urls: [shLab.careers, shLab.github],
      },
    },
  },
  "msra-systems-intern": {
    role: {
      text: "大规模异构 GPU/NPU 集群分布式训练系统、通信拓扑优化与显存调度算法研发。",
      urls: [msra.careers],
    },
    methods: {
      text: "结合 DeepSpeed/Megatron 等分布式框架，进行跨节点网络通信优化、长序列上下文加速与容错系统设计。",
      urls: [msra.careers],
    },
    routes: {
      growth: {
        text: "Tomorrow's Partner 高校联合培养模式，配备资深系统研究员一对一 Mentor，学术研究与工程系统实践并重。转正通道通常通过校招实习生绿色通道推荐。",
        urls: [msra.careers],
      },
      practical: {
        text: "要求每周现场至少 4 天，连续实习不少于 3 个月。地点在北京。全日制实习需提供导师书面同意书。",
        urls: [msra.careers],
      },
    },
    unknowns: {
      text: "具体入职月份要求、专属卡位与算力配额以具体课题组最终安排为准。",
      urls: [msra.careers],
    },
    next: {
      role: {
        text: "建议先阅读 MSRA 近年在 OSDI/SOSP/NSDI 上的分布式系统近期工作，评估技术契合度。",
        urls: [msra.careers],
      },
      growth: {
        text: "了解联合培养 Mentor 的学术发表方向与往届实习生毕业去向；明确研究论文与工程代码的产出预期。",
        urls: [msra.careers],
      },
      practical: {
        text: "提前取得所在高校导师签字的知情同意书，确认实习期间能够兼顾学业与考勤。",
        urls: [msra.careers],
      },
    },
    focus: {
      systems: {
        text: "如果你关注大规模异构硬件、分布式通信优化与算力集群调度，MSRA 系统组具有顶尖的学术积累与工程落地场景。",
        urls: [msra.careers],
      },
      evaluation: {
        text: "如果你更偏好大模型评测与具体应用对齐，该岗位的底层系统通信与显存调度相对偏底层硬核系统架构。",
        urls: [msra.careers],
      },
    },
  },
};

function bindInternshipText(advisor: Advisor, claim?: SourceBoundText): ComparisonCell {
  if (!claim) return { candidateId: advisor.candidateId, text: "待了解", sources: [] };
  const verifiedSources = claim.urls
    .map((url) =>
      advisor.sources.find(
        (source) =>
          source.url === url &&
          source.collection?.batchId === internshipBatchId &&
          source.collectedAt === internshipCollectedAt,
      ),
    )
    .filter((source): source is SourceSnapshot => Boolean(source));
  if (verifiedSources.length !== claim.urls.length) {
    return { candidateId: advisor.candidateId, text: "待了解", sources: [] };
  }
  return {
    candidateId: advisor.candidateId,
    text: claim.text,
    sources: verifiedSources,
  };
}

export function isInternshipComparison(candidates: Advisor[]): boolean {
  return (
    candidates.length > 0 &&
    candidates.every(
      (c) =>
        c.type === "internship" ||
        internshipComparisonSupportedCandidateIds.includes(
          c.candidateId as (typeof internshipComparisonSupportedCandidateIds)[number],
        ),
    )
  );
}

export function buildInternshipComparisonRows(
  advisors: Advisor[],
  perspective: InternshipPerspective,
): ComparisonRow[] {
  const rows: {
    id: string;
    label: string;
    field:
      | keyof Pick<InternshipComparisonProfile, "role" | "methods" | "unknowns">
      | "routes"
      | "next";
  }[] = [
    { id: "role", label: "职责与课题", field: "role" },
    { id: "methods", label: "技术要求与方法", field: "methods" },
  ];
  if (perspective !== "role") {
    rows.push({
      id: "route",
      label: perspective === "growth" ? "转正与成长途径" : "时间地点与要求",
      field: "routes",
    });
  }
  rows.push(
    { id: "unknowns", label: "还有哪些未知", field: "unknowns" },
    { id: "next", label: "可以继续了解什么", field: "next" },
  );
  return rows.map(({ id, label, field }) => ({
    id,
    label,
    cells: advisors.map((advisor) => {
      const profile = internshipProfiles[advisor.candidateId];
      let claim: SourceBoundText | undefined;
      if (field === "routes") {
        if (perspective !== "role") claim = profile?.routes[perspective];
      } else if (field === "next") {
        claim = profile?.next[perspective];
      } else {
        claim = profile?.[field];
      }
      return bindInternshipText(advisor, claim);
    }),
  }));
}

export function buildInternshipFocusHints(
  advisors: Advisor[],
  focus: InternshipFocus,
): ComparisonCell[] {
  if (focus === "open") return [];
  return advisors.map((advisor) =>
    bindInternshipText(advisor, internshipProfiles[advisor.candidateId]?.focus[focus]),
  );
}
