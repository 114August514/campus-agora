import { ArrowLeftIcon, TrashIcon } from "@primer/octicons-react";
import {
  Button,
  ConfirmationDialog,
  FormControl,
  Heading,
  Link,
  Stack,
  Text,
  TextInput,
  Textarea,
} from "@primer/react";
import { Blankslate } from "@primer/react/experimental";
import { useState } from "react";
import { href, navigate } from "../../app/router";
import { suggestedQuestions } from "../../data/advisors";
import { describeItem } from "../../data/items";
import {
  type Topic,
  type TopicEntry,
  deleteTopic,
  removeEntry,
  updateEntry,
  updateTopic,
  useTopics,
} from "../../state/topics";

export function TopicPage({ id }: { id: string }) {
  const topic = useTopics().find((t) => t.id === id);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!topic) {
    return (
      <Blankslate>
        <Blankslate.Heading>这个主题不存在或已删除</Blankslate.Heading>
        <Blankslate.PrimaryAction href={href({ page: "topics" })}>
          返回我的探索
        </Blankslate.PrimaryAction>
      </Blankslate>
    );
  }

  return (
    <Stack gap="spacious">
      <Stack gap="normal" paddingBlock="normal">
        <Link href={href({ page: "topics" })}>
          <Stack as="span" direction="horizontal" gap="tight" align="center">
            <ArrowLeftIcon />
            我的探索
          </Stack>
        </Link>
        <Heading as="h1">{topic.title}</Heading>
        <TopicFields topic={topic} />
      </Stack>

      <Stack as="section" gap="spacious" aria-labelledby="topic-candidates">
        <Heading as="h2" variant="medium" id="topic-candidates">
          保存的内容与我的理由
        </Heading>
        {topic.entries.length === 0 ? (
          <Text size="medium">
            还没有内容。在导师、机会或资源上点“保存”，选择这个主题即可。
          </Text>
        ) : (
          topic.entries.map((entry) => (
            <EntryEditor
              key={`${entry.item.kind}-${entry.item.id}`}
              topicId={topic.id}
              entry={entry}
            />
          ))
        )}
      </Stack>

      <Stack direction="horizontal">
        <Button
          variant="danger"
          leadingVisual={TrashIcon}
          onClick={() => setConfirmDelete(true)}
        >
          删除主题
        </Button>
      </Stack>
      {confirmDelete && (
        <ConfirmationDialog
          title={`删除“${topic.title}”？`}
          confirmButtonContent="删除"
          confirmButtonType="danger"
          cancelButtonContent="取消"
          onClose={(gesture) => {
            setConfirmDelete(false);
            if (gesture === "confirm") {
              deleteTopic(topic.id);
              navigate({ page: "topics" });
            }
          }}
        >
          只删除本浏览器中这个主题的问题、候选和理由。其他主题和公共资料不受影响。
        </ConfirmationDialog>
      )}
    </Stack>
  );
}

function TopicFields({ topic }: { topic: Topic }) {
  return (
    <Stack gap="normal">
      <FormControl>
        <FormControl.Label>主题名称</FormControl.Label>
        <TextInput
          value={topic.title}
          onChange={(e) => updateTopic(topic.id, { title: e.target.value })}
          block
        />
      </FormControl>
      <FormControl>
        <FormControl.Label>我现在想弄清楚的问题（可选）</FormControl.Label>
        <Textarea
          value={topic.question}
          onChange={(e) => updateTopic(topic.id, { question: e.target.value })}
          rows={2}
          block
        />
        <FormControl.Caption>
          目的可以随时改变，修改不会影响其他主题。
        </FormControl.Caption>
      </FormControl>
    </Stack>
  );
}

function EntryEditor({ topicId, entry }: { topicId: string; entry: TopicEntry }) {
  const view = describeItem(entry.item);
  const [newQuestion, setNewQuestion] = useState("");
  const addQuestion = (q: string) => {
    const text = q.trim();
    if (!text || entry.questions.includes(text)) return;
    updateEntry(topicId, entry.item, { questions: [...entry.questions, text] });
    setNewQuestion("");
  };

  return (
    <Stack as="article" gap="condensed">
      <Heading as="h3" variant="small">
        {view ? (
          <Link
            href={view.link.href}
            {...(view.link.external ? { target: "_blank", rel: "noreferrer" } : {})}
          >
            {view.title}
          </Link>
        ) : (
          "这一项已不在公共资料中"
        )}
      </Heading>
      {!view && <Text size="small">你的理由和待问事项仍保留。</Text>}
      {view && (
        <Text size="small">
          {view.meta} · {view.summary}
        </Text>
      )}
      <FormControl>
        <FormControl.Label>我的理由</FormControl.Label>
        <Textarea
          value={entry.reason}
          onChange={(e) => updateEntry(topicId, entry.item, { reason: e.target.value })}
          rows={2}
          block
        />
        <FormControl.Caption>只属于这个主题。</FormControl.Caption>
      </FormControl>
      <Stack gap="tight">
        <Text weight="semibold" size="small">
          待问事项
        </Text>
        {entry.questions.map((q) => (
          <Stack key={q} direction="horizontal" gap="condensed" align="center">
            <Text size="small">{q}</Text>
            <Button
              size="small"
              variant="invisible"
              onClick={() =>
                updateEntry(topicId, entry.item, {
                  questions: entry.questions.filter((x) => x !== q),
                })
              }
            >
              移除
            </Button>
          </Stack>
        ))}
        <Stack
          direction={{ narrow: "vertical", regular: "horizontal" }}
          gap="condensed"
        >
          <TextInput
            aria-label="添加待问事项"
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addQuestion(newQuestion)}
            placeholder="添加一个想问的问题"
            size="small"
          />
          <Button
            size="small"
            onClick={() => addQuestion(newQuestion)}
            disabled={!newQuestion.trim()}
          >
            添加
          </Button>
        </Stack>
        {entry.questions.length === 0 && (
          <Stack direction="horizontal" gap="condensed" wrap="wrap" align="center">
            <Text size="small">可选参考：</Text>
            {suggestedQuestions.map((q) => (
              <Button
                key={q}
                size="small"
                variant="invisible"
                onClick={() => addQuestion(q)}
              >
                {q}
              </Button>
            ))}
          </Stack>
        )}
      </Stack>
      <Stack direction="horizontal">
        <Button size="small" onClick={() => removeEntry(topicId, entry.item)}>
          从这个主题移除
        </Button>
      </Stack>
    </Stack>
  );
}
