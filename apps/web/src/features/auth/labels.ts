import type { MockPersona } from "@campus-agora/api-client";

export const PERSONA_OPTIONS: ReadonlyArray<{
  value: MockPersona;
  label: string;
}> = [
  { value: "student", label: "学生" },
  { value: "organization_member", label: "组织成员" },
  { value: "moderator", label: "审核员" },
  { value: "admin", label: "管理员" },
];

const ROLE_LABELS: Record<string, string> = {
  student: "学生",
  organization_member: "组织成员",
  moderator: "审核员",
  admin: "管理员",
};

export function roleLabel(systemRole: string): string {
  return ROLE_LABELS[systemRole] ?? systemRole;
}
