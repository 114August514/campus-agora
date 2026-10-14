import { PlusIcon } from "@primer/octicons-react";
import {
  Button,
  FormControl,
  Heading,
  Link,
  Stack,
  Text,
  TextInput,
} from "@primer/react";
import { Blankslate } from "@primer/react/experimental";
import { useState } from "react";
import { href, navigate } from "../../app/router";
import { describeItem } from "../../data/items";
import { createTopic, isStorageAvailable, useTopics } from "../../state/topics";

export function TopicsPage() {
  const topics = useTopics();
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const create = () => {
    if (!title.trim()) return;
    const topic = createTopic(title);
    setTitle("");
    setCreating(false);
    navigate({ page: "topic", id: topic.id });
  };

  return (
    <Stack gap="spacious">
      <Stack gap="normal" paddingBlock="normal">
        <Heading as="h1">我的探索</Heading>
        <Text size="small">
          每个主题分别保存问题、候选和你自己的理由。只保存在本浏览器，不同步到其他设备，也不会发送给任何服务。
        </Text>
        {!isStorageAvailable() && (
          <Text size="small">当前浏览器无法保存，关闭页面后记录会丢失。</Text>
        )}
        {creating ? (
          <Stack
            direction={{ narrow: "vertical", regular: "horizontal" }}
            gap="condensed"
            align={{ narrow: "stretch", regular: "end" }}
          >
            <FormControl>
              <FormControl.Label>新主题名称</FormControl.Label>
              <TextInput
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && create()}
                placeholder="例如：AI 系统方向的研究生申请"
                autoFocus
              />
            </FormControl>
            <Stack direction="horizontal" gap="condensed">
              <Button variant="primary" onClick={create} disabled={!title.trim()}>
                创建
              </Button>
              <Button onClick={() => setCreating(false)}>取消</Button>
            </Stack>
          </Stack>
        ) : (
          <Stack direction="horizontal">
            <Button leadingVisual={PlusIcon} onClick={() => setCreating(true)}>
              新建主题
            </Button>
          </Stack>
        )}
      </Stack>

      {topics.length === 0 ? (
        <Blankslate>
          <Blankslate.Heading>还没有探索主题</Blankslate.Heading>
          <Blankslate.Description>
            浏览时点“保存”就可以创建，不需要先建主题。
          </Blankslate.Description>
          <Blankslate.PrimaryAction href={href({ page: "find" })}>
            去找导师
          </Blankslate.PrimaryAction>
        </Blankslate>
      ) : (
        <Stack as="section" gap="normal" aria-label="主题列表">
          {topics.map((t) => (
            <Stack key={t.id} gap="tight">
              <Heading as="h2" variant="small">
                <Link href={href({ page: "topic", id: t.id })}>{t.title}</Link>
              </Heading>
              {t.question && <Text size="medium">{t.question}</Text>}
              <Text size="small">
                {t.entries.length === 0
                  ? "还没有候选"
                  : `${t.entries.length} 项：${t.entries.map((e) => describeItem(e.item)?.title ?? "已不在资料中").join("、")}`}
              </Text>
            </Stack>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
