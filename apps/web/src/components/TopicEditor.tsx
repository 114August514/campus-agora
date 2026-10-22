import {
  Banner,
  Button,
  Dialog,
  FormControl,
  Stack,
  Text,
  TextInput,
  Textarea,
} from "@primer/react";
import { useEffect, useState } from "react";
import type { ExplorationTopic } from "../lib/exploration-store";

type TopicPatch = Pick<ExplorationTopic, "name" | "question" | "preferences">;

export function TopicEditor({
  topic,
  onSave,
}: {
  topic: ExplorationTopic;
  onSave: (patch: TopicPatch) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<TopicPatch>(topic);
  const [confirmExit, setConfirmExit] = useState(false);
  const [error, setError] = useState("");
  const dirty =
    draft.name !== topic.name ||
    draft.question !== topic.question ||
    draft.preferences !== topic.preferences;

  useEffect(() => {
    if (!open || !dirty) return;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty, open]);

  function save() {
    try {
      if (!draft.name.trim()) throw new Error("请填写主题名称。");
      onSave({ ...draft, name: draft.name.trim() });
      setOpen(false);
      setConfirmExit(false);
      setError("");
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "未能保存，编辑内容已保留。",
      );
      setConfirmExit(false);
    }
  }

  return (
    <>
      <Button
        onClick={() => {
          setDraft({
            name: topic.name,
            question: topic.question,
            preferences: topic.preferences,
          });
          setConfirmExit(false);
          setError("");
          setOpen(true);
        }}
      >
        编辑主题条件
      </Button>
      {open && (
        <Dialog
          title={confirmExit ? "是否保存主题修改？" : "编辑主题条件"}
          width="large"
          onClose={() => (dirty ? setConfirmExit(true) : setOpen(false))}
        >
          <Stack gap="normal">
            {error && <Banner variant="critical" title={error} />}
            {confirmExit ? (
              <>
                <Text as="p">这些修改还未保存。候选、依据和私人理由不会因此改写。</Text>
                <Stack direction="horizontal" wrap="wrap">
                  <Button onClick={save}>保存修改</Button>
                  <Button onClick={() => setOpen(false)}>放弃修改</Button>
                  <Button onClick={() => setConfirmExit(false)}>继续编辑</Button>
                </Stack>
              </>
            ) : (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  save();
                }}
              >
                <Stack gap="normal">
                  <FormControl required>
                    <FormControl.Label>主题名称</FormControl.Label>
                    <TextInput
                      block
                      value={draft.name}
                      maxLength={100}
                      onChange={(event) =>
                        setDraft({ ...draft, name: event.target.value })
                      }
                    />
                  </FormControl>
                  <FormControl>
                    <FormControl.Label>当前想了解的问题（可不填）</FormControl.Label>
                    <Textarea
                      block
                      value={draft.question}
                      maxLength={2000}
                      onChange={(event) =>
                        setDraft({ ...draft, question: event.target.value })
                      }
                    />
                  </FormControl>
                  <FormControl>
                    <FormControl.Label>偏好与条件（可不填）</FormControl.Label>
                    <Textarea
                      block
                      value={draft.preferences}
                      maxLength={4000}
                      onChange={(event) =>
                        setDraft({ ...draft, preferences: event.target.value })
                      }
                    />
                    <FormControl.Caption>
                      只保存在当前主题；不会自动填入公开查询或发送给外部服务。
                    </FormControl.Caption>
                  </FormControl>
                  <Text as="p">保存后保留现有候选、依据、私人理由和待问项。</Text>
                  <Stack direction="horizontal" wrap="wrap">
                    <Button type="submit" disabled={!draft.name.trim()}>
                      保存主题条件
                    </Button>
                    <Button
                      type="button"
                      onClick={() => (dirty ? setConfirmExit(true) : setOpen(false))}
                    >
                      关闭编辑
                    </Button>
                    {dirty && <Text size="small">有未保存修改</Text>}
                  </Stack>
                </Stack>
              </form>
            )}
          </Stack>
        </Dialog>
      )}
    </>
  );
}
