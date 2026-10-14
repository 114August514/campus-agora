// Save one advisor or opportunity into one chosen topic. The reason is private to that
// topic record.
import {
  Dialog,
  FormControl,
  Radio,
  RadioGroup,
  Stack,
  Text,
  TextInput,
  Textarea,
} from "@primer/react";
import { useState } from "react";
import type { ItemRef } from "../data/types";
import { createTopic, findEntry, saveEntry, useTopics } from "../state/topics";

const NEW_TOPIC = "__new__";

export function SaveDialog({
  item,
  name,
  onClose,
}: { item: ItemRef; name: string; onClose: () => void }) {
  const topics = useTopics();
  const [target, setTarget] = useState<string>(topics[0]?.id ?? NEW_TOPIC);
  const [newTitle, setNewTitle] = useState("");
  const existing = findEntry(
    topics.find((t) => t.id === target),
    item,
  );
  const [reason, setReason] = useState(existing?.reason ?? "");
  const [error, setError] = useState<string | null>(null);

  const changeTarget = (value: string | null) => {
    const next = value ?? NEW_TOPIC;
    setTarget(next);
    const entry = findEntry(
      topics.find((t) => t.id === next),
      item,
    );
    setReason(entry?.reason ?? "");
    setError(null);
  };

  const save = () => {
    let topicId = target;
    if (target === NEW_TOPIC) {
      if (!newTitle.trim()) {
        setError("请填写主题名称");
        return;
      }
      topicId = createTopic(newTitle).id;
    }
    saveEntry(topicId, item, reason.trim());
    onClose();
  };

  return (
    <Dialog
      title={`保存 ${name}`}
      onClose={onClose}
      width="large"
      footerButtons={[
        { content: "取消", onClick: onClose },
        { content: existing ? "更新" : "保存", buttonType: "primary", onClick: save },
      ]}
    >
      <Stack gap="normal">
        <RadioGroup name="save-topic" onChange={changeTarget}>
          <RadioGroup.Label>保存到哪个探索主题</RadioGroup.Label>
          {topics.map((t) => (
            <FormControl key={t.id}>
              <Radio value={t.id} checked={target === t.id} />
              <FormControl.Label>{t.title}</FormControl.Label>
            </FormControl>
          ))}
          <FormControl>
            <Radio value={NEW_TOPIC} checked={target === NEW_TOPIC} />
            <FormControl.Label>新建主题</FormControl.Label>
          </FormControl>
        </RadioGroup>
        {target === NEW_TOPIC && (
          <FormControl required>
            <FormControl.Label>主题名称</FormControl.Label>
            <TextInput
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="例如：AI 方向的本科科研，或今年想参加的竞赛"
              block
            />
            {error && (
              <FormControl.Validation variant="error">{error}</FormControl.Validation>
            )}
          </FormControl>
        )}
        <FormControl>
          <FormControl.Label>我的理由（可选）</FormControl.Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            block
            rows={3}
          />
          <FormControl.Caption>
            只保存在这个主题里，不会出现在其他主题或公共资料中。
          </FormControl.Caption>
        </FormControl>
        <Text size="small">
          保存在本浏览器，不同步到其他设备；保存不代表要申请或联系。
        </Text>
      </Stack>
    </Dialog>
  );
}
