import assert from "node:assert/strict";
import { test } from "node:test";
import {
  affiliationMatches,
  nameKey,
  normalizeUrl,
  quoteInText,
} from "../src/pipeline/normalize.ts";

test("normalizeUrl folds scheme, www, index page, fragment and utm params", () => {
  assert.equal(
    normalizeUrl("https://www.Example.edu/lab/index.html?utm_source=x#team"),
    normalizeUrl("http://example.edu/lab/"),
  );
  assert.notEqual(
    normalizeUrl("https://a.edu/p?id=1"),
    normalizeUrl("https://a.edu/p?id=2"),
  );
});

test("nameKey treats latin name order as the same person key", () => {
  assert.equal(nameKey("Xiang Wang"), nameKey("WANG Xiang"));
  assert.equal(nameKey("王 翔"), nameKey("王翔"));
  assert.notEqual(nameKey("王翔"), nameKey("王祥"));
});

test("quoteInText ignores whitespace but rejects paraphrase and tiny quotes", () => {
  const text = "本人长期欢迎对大模型知识编辑感兴趣的\n本科生参与科研。";
  assert.equal(quoteInText("欢迎对大模型知识编辑感兴趣的 本科生参与科研", text), true);
  assert.equal(quoteInText("欢迎本科生加入大模型研究", text), false);
  assert.equal(quoteInText("本人", text), false);
});

test("affiliationMatches accepts aliases and contained forms", () => {
  assert.equal(
    affiliationMatches("中国科学技术大学 人工智能与数据科学学院", ["中国科学技术大学"]),
    true,
  );
  assert.equal(
    affiliationMatches("HKUST", [
      "Hong Kong University of Science and Technology",
      "HKUST",
    ]),
    true,
  );
  assert.equal(affiliationMatches(null, ["USTC"]), false);
  assert.equal(affiliationMatches("清华大学", ["北京大学"]), false);
});
