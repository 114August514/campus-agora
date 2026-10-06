import { describe, expect, test } from "bun:test";
import {
  type CandidateSnapshot,
  EXPLORATION_STORAGE_KEY,
  ExplorationStoreError,
  createExplorationStore,
} from "../src/lib/exploration-store";

class MemoryStorage {
  data = new Map<string, string>();
  failRead = false;
  failWrite = false;

  getItem(key: string) {
    if (this.failRead) throw new Error("storage disabled");
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    if (this.failWrite) throw new Error("quota exceeded");
    this.data.set(key, value);
  }
}

function candidate(): CandidateSnapshot {
  return {
    candidateId: "advisor-one",
    name: "Example Researcher",
    institution: "Example University",
    research: "Programming systems",
    sources: [
      {
        url: "https://example.org/research",
        title: "Research overview",
        content: "We study program analysis and developer tools.",
        collectedAt: "2026-09-29T10:00:00.000Z",
        kind: "snapshot",
        publishedAt: "2025-01-01",
      },
    ],
  };
}

describe("exploration store", () => {
  test("restores two topics with independent records for the same candidate", () => {
    const storage = new MemoryStorage();
    const store = createExplorationStore(storage);
    const summer = store.createTopic({
      name: "暑期研究",
      question: "想尝试软件研究",
      preferences: "短期参与",
    });
    const research = store.createTopic({ name: "长期探索", question: "是否适合读博" });
    const publicCandidate = candidate();
    store.saveCandidate(summer.id, publicCandidate, {
      reason: "先尝试程序分析",
      questions: ["是否接受短期本科生"],
    });
    store.saveCandidate(research.id, publicCandidate, {
      reason: "了解长期研究方向",
      questions: ["通常由谁指导"],
    });

    const reopened = createExplorationStore(storage);
    expect(reopened.listTopics()).toHaveLength(2);
    expect(reopened.getTopic(summer.id)).toMatchObject({
      question: "想尝试软件研究",
      preferences: "短期参与",
      candidates: [{ reason: "先尝试程序分析", questions: ["是否接受短期本科生"] }],
    });
    expect(reopened.getTopic(research.id)?.candidates[0]).toMatchObject({
      candidate: publicCandidate,
      reason: "了解长期研究方向",
      questions: ["通常由谁指导"],
    });
  });

  test("updates and removes one topic without altering another or the public input", () => {
    const storage = new MemoryStorage();
    const store = createExplorationStore(storage);
    const first = store.createTopic({ name: "主题一" });
    const second = store.createTopic({ name: "主题二" });
    const publicCandidate = candidate();
    store.saveCandidate(first.id, publicCandidate, { reason: "第一份理由" });
    store.saveCandidate(second.id, publicCandidate, { reason: "第二份理由" });

    store.updateCandidate(first.id, publicCandidate.candidateId, {
      reason: "重新考虑",
      questions: ["想继续确认"],
    });
    store.updateTopic(first.id, { question: "新的问题", preferences: "新条件" });
    expect(store.getTopic(first.id)?.candidates[0]?.reason).toBe("重新考虑");
    expect(store.getTopic(second.id)?.candidates[0]?.reason).toBe("第二份理由");

    store.removeCandidate(first.id, publicCandidate.candidateId);
    expect(store.getTopic(first.id)?.candidates).toHaveLength(0);
    expect(store.getTopic(second.id)?.candidates).toHaveLength(1);
    store.deleteTopic(first.id);
    expect(createExplorationStore(storage).listTopics()).toHaveLength(1);
    expect(publicCandidate).toEqual(candidate());
  });

  test("saving again adds evidence while preserving private reasons and old snapshots", () => {
    const storage = new MemoryStorage();
    const store = createExplorationStore(storage);
    const topic = store.createTopic({ name: "探索" });
    const initial = candidate();
    store.saveCandidate(topic.id, initial, {
      reason: "我的理由",
      questions: ["待问问题"],
    });
    const updated = candidate();
    updated.sources[0] = {
      ...updated.sources[0],
      content: "Newly collected information about current research.",
      collectedAt: "2026-10-04T11:00:00.000Z",
      kind: "live",
    };
    store.saveCandidate(topic.id, updated, { reason: "覆盖草稿", questions: [] });
    store.saveCandidate(topic.id, updated);

    const entries = store.getTopic(topic.id)?.candidates;
    expect(entries).toHaveLength(1);
    expect(entries?.[0]).toMatchObject({ reason: "我的理由", questions: ["待问问题"] });
    expect(entries?.[0]?.candidate.sources).toEqual([
      initial.sources[0],
      updated.sources[0],
    ]);
  });

  test("failed writes do not report success or lose the previously saved record", () => {
    const storage = new MemoryStorage();
    const store = createExplorationStore(storage);
    const topic = store.createTopic({ name: "探索" });
    store.saveCandidate(topic.id, candidate(), { reason: "已保存" });
    const persisted = storage.getItem(EXPLORATION_STORAGE_KEY);
    storage.failWrite = true;

    expect(() =>
      store.updateCandidate(topic.id, "advisor-one", { reason: "未保存" }),
    ).toThrow(ExplorationStoreError);
    expect(storage.getItem(EXPLORATION_STORAGE_KEY)).toBe(persisted);
    expect(store.getTopic(topic.id)?.candidates[0]?.reason).toBe("已保存");
    expect(() => store.deleteTopic(topic.id)).toThrow("保存未成功");
    storage.failWrite = false;
    store.updateCandidate(topic.id, "advisor-one", { reason: "重试成功" });
    expect(
      createExplorationStore(storage).getTopic(topic.id)?.candidates[0]?.reason,
    ).toBe("重试成功");
  });

  test("preserves an original publication date label when saving and reopening", () => {
    const storage = new MemoryStorage();
    const store = createExplorationStore(storage);
    const topic = store.createTopic({ name: "探索" });
    const original = candidate();
    original.sources[0].publishedAt = "Autumn 2025";
    store.saveCandidate(topic.id, original);

    const reopened = createExplorationStore(storage);
    expect(
      reopened.getTopic(topic.id)?.candidates[0]?.candidate.sources[0]?.publishedAt,
    ).toBe("Autumn 2025");
  });

  test("retains a lookup route and access note when saving the same legacy snapshot again", () => {
    const storage = new MemoryStorage();
    const store = createExplorationStore(storage);
    const topic = store.createTopic({ name: "探索" });
    const original = candidate();
    original.sources[0].lookupUrl = "https://example.org/search?keyword=research";
    original.sources[0].accessNote = "Find the original post in the site search.";
    store.saveCandidate(topic.id, original, { reason: "我的理由" });
    store.saveCandidate(topic.id, candidate());
    original.sources[0].lookupUrl = "https://example.org/unsaved-edit";
    original.sources[0].accessNote = "Unsaved edit";

    const saved = createExplorationStore(storage).getTopic(topic.id)?.candidates[0];
    expect(saved?.reason).toBe("我的理由");
    expect(saved?.candidate.sources).toHaveLength(1);
    expect(saved?.candidate.sources[0]).toMatchObject({
      url: "https://example.org/research",
      lookupUrl: "https://example.org/search?keyword=research",
      accessNote: "Find the original post in the site search.",
    });
  });

  test.each([
    "javascript:alert(1)",
    "https://user:password@example.org/search",
    "https://example.org/search?xsec_token=private",
    "https://example.org/search#session_id=private",
    "https://another.example/search",
  ])("rejects unsafe or off-site lookup URLs before saving: %s", (lookupUrl) => {
    const storage = new MemoryStorage();
    const store = createExplorationStore(storage);
    const topic = store.createTopic({ name: "探索" });
    const invalid = candidate();
    invalid.sources[0].lookupUrl = lookupUrl;
    expect(() => store.saveCandidate(topic.id, invalid)).toThrow("来源内容不完整");
    expect(store.getTopic(topic.id)?.candidates).toHaveLength(0);
  });

  test("restores the selected source's query, relevance and remaining unknowns", () => {
    const storage = new MemoryStorage();
    const store = createExplorationStore(storage);
    const topic = store.createTopic({ name: "探索", question: "最初的问题" });
    const original = candidate();
    original.sources[0] = {
      ...original.sources[0],
      query: "本科短期程序分析研究",
      relevanceEvidence: ["We study program analysis and developer tools."],
      unknowns: ["是否接受短期本科生尚未确认"],
    };
    store.saveCandidate(topic.id, original, { reason: "我的私人判断" });
    store.saveCandidate(topic.id, {
      ...original,
      sources: [{ ...original.sources[0], query: "同一来源的另一项查找" }],
    });
    original.sources[0].relevanceEvidence?.push("未保存的后续编辑");

    const reopened = createExplorationStore(storage);
    const saved = reopened.getTopic(topic.id);
    expect(saved?.question).toBe("最初的问题");
    expect(saved?.candidates[0]?.candidate.sources[0]).toMatchObject({
      query: "本科短期程序分析研究",
      relevanceEvidence: ["We study program analysis and developer tools."],
      unknowns: ["是否接受短期本科生尚未确认"],
    });
    expect(saved?.candidates[0]?.reason).toBe("我的私人判断");
    expect(saved?.candidates[0]?.candidate.sources).toHaveLength(2);
    expect(saved?.candidates[0]?.candidate.sources[1]?.query).toBe(
      "同一来源的另一项查找",
    );
  });

  test.each([
    ["invalid JSON", "corrupted_data"],
    [JSON.stringify({ version: 9, topics: [] }), "unsupported_version"],
    [JSON.stringify({ version: 1, topics: [{ id: "broken" }] }), "corrupted_data"],
  ])("preserves unreadable data instead of overwriting it: %s", (raw, code) => {
    const storage = new MemoryStorage();
    storage.setItem(EXPLORATION_STORAGE_KEY, raw);
    const store = createExplorationStore(storage);
    try {
      store.listTopics();
      throw new Error("expected storage validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ExplorationStoreError);
      expect((error as ExplorationStoreError).code).toBe(code);
    }
    expect(() => store.createTopic({ name: "不可覆盖" })).toThrow(
      ExplorationStoreError,
    );
    expect(storage.getItem(EXPLORATION_STORAGE_KEY)).toBe(raw);
  });

  test("rejects invalid source URLs and dates before saving", () => {
    const storage = new MemoryStorage();
    const store = createExplorationStore(storage);
    const topic = store.createTopic({ name: "探索" });
    const invalid = candidate();
    invalid.sources[0].url = "javascript:alert(1)";
    expect(() => store.saveCandidate(topic.id, invalid)).toThrow("来源内容不完整");
    invalid.sources[0].url = "https://example.org/research";
    invalid.sources[0].collectedAt = "not a date";
    expect(() => store.saveCandidate(topic.id, invalid)).toThrow("来源内容不完整");
    expect(store.getTopic(topic.id)?.candidates).toHaveLength(0);
  });

  test("read failures stay distinguishable from an empty store", () => {
    const storage = new MemoryStorage();
    storage.failRead = true;
    expect(() => createExplorationStore(storage).listTopics()).toThrow("无法读取");
  });
});
