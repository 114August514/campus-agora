import recruitmentBatchOctober4 from "../data/xhs-recruitment-2026-10-04.json";
import recruitmentBatchOctober5 from "../data/xhs-recruitment-2026-10-05.json";
import { mergeCollectedAdvisors, parseCollectedBatch } from "./collected-batch";
import type { CandidateSnapshot } from "./exploration-store";

const reviewedAt = "2026-09-29T00:00:00.000Z";

export interface Advisor extends CandidateSnapshot {
  approach: string;
  participation: string;
  unknowns: string;
}

const sampleAdvisors: Advisor[] = [
  {
    candidateId: "wang-xiang",
    name: "王翔",
    institution: "中国科学技术大学",
    research: "修改大模型中的错误知识时，怎样尽量保留其他知识？",
    approach:
      "AlphaEdit约束参数更新的方向，以减少对原知识的干扰。王翔是共同作者；作品关联不能确定未来的实际指导人。",
    participation:
      "校内主页长期欢迎本科科研、毕业设计及硕博申请。具体课题、时间和目标年度需要分别确认。",
    unknowns: "当前名额、实际指导方式及独立参与体验尚未确认。",
    sources: [
      {
        url: "https://xiangwang1223.github.io/",
        title: "本人研究介绍",
        content: "既有样稿关联模型知识编辑研究；不是本次在线读取。",
        collectedAt: reviewedAt,
        kind: "snapshot",
      },
    ],
  },
  {
    candidateId: "xiong-yingfei",
    name: "熊英飞",
    institution: "北京大学",
    research: "一段代码是否真的满足用自然语言写出的要求？",
    approach:
      "HoarePrompt让模型逐步描述程序状态，再检查要求，借鉴程序验证思想。熊英飞是共同作者，不能据此指定实际指导人。",
    participation: "可先了解近期研究；既有机构与个人页资料尚未明确当期招生途径。",
    unknowns: "当期资格、接收途径、名额和实际指导体验尚未确认。",
    sources: [
      {
        url: "https://xiongyingfei.github.io/",
        title: "个人主页与近期工作",
        content: "既有样稿关联程序验证和HoarePrompt研究；不是本次在线读取。",
        collectedAt: reviewedAt,
        kind: "snapshot",
      },
    ],
  },
  {
    candidateId: "tianqi-chen",
    name: "Tianqi Chen",
    institution: "Carnegie Mellon University",
    research: "多张GPU一起推理时，怎样安排计算和通信，减少等待？",
    approach:
      "MPK以编译和运行时调度组织计算与通信，涉及性能测量、任务安排和GPU系统。这里只解释一项相关工作。",
    participation:
      "本人FAQ指向CMU SCS的MLD／CSD博士申请。其本科、硕士项目参与说明针对CMU学生，不直接作为外校暑研入口。",
    unknowns: "当前名额、外校短期科研接收和实际指导方式尚未确认。",
    sources: [
      {
        url: "https://catalyst.cs.cmu.edu/projects/mpk.html",
        title: "MPK项目说明",
        content: "既有样稿说明多GPU推理中的计算、通信与调度；不是本次在线读取。",
        collectedAt: reviewedAt,
        kind: "snapshot",
      },
      {
        url: "https://tqchen.com/faq",
        title: "本人FAQ",
        content: "既有样稿区分博士申请与面向CMU在校生的参与方式；当前名额未知。",
        collectedAt: reviewedAt,
        kind: "snapshot",
      },
    ],
  },
  {
    candidateId: "charles-zhang",
    name: "Charles Zhang",
    institution: "香港科技大学",
    research: "大型软件里，某个值怎样跨模块传递并导致缺陷？",
    approach:
      "Clearblue组织程序依赖分析。个人主页还介绍LLVM IR与LLM agents的结合，不能用旧模型文档代替全部研究。",
    participation:
      "可查院系研究生入口；主页的研究科学家岗位不是硕博招生。短期访问的校级制度也不证明本人接收。",
    unknowns: "个人名额、短期接收、日常指导与独立参与体验尚未确认。",
    sources: [
      {
        url: "https://www.cse.ust.hk/~charlesz/",
        title: "本人研究介绍",
        content: "既有样稿关联Clearblue、LLVM IR和LLM agents；不是本次在线读取。",
        collectedAt: reviewedAt,
        kind: "snapshot",
      },
    ],
  },
];

export const collectedBatches = [
  parseCollectedBatch(recruitmentBatchOctober4),
  parseCollectedBatch(recruitmentBatchOctober5),
];
export const advisors: Advisor[] = mergeCollectedAdvisors(
  sampleAdvisors,
  collectedBatches,
);

export function sourceDate(date: string): string {
  return new Date(date).toLocaleDateString("zh-CN");
}
