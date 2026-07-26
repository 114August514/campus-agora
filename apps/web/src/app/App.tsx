import { Route, Routes } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { visibleNavigationItems } from "../features/auth/navigation";
import { AuthPanel } from "../features/auth/ui/AuthPanel";
import { useSession } from "../features/auth/useSession";
import { useCapabilities } from "../features/meta/useCapabilities";
import { ArchiveDetailPage } from "../pages/ArchiveDetailPage";
import { ArchiveEditorPage } from "../pages/ArchiveEditorPage";
import { ArchiveListPage } from "../pages/ArchiveListPage";
import { DesignSystemPage } from "../pages/DesignSystemPage";
import { DiscussionDetailPage } from "../pages/DiscussionDetailPage";
import { DiscussionEditorPage } from "../pages/DiscussionEditorPage";
import { DiscussionListPage } from "../pages/DiscussionListPage";
import { HomePage } from "../pages/HomePage";
import { ModerationQueuePage } from "../pages/ModerationQueuePage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { ROUTES } from "./routes";

export function App() {
  const session = useSession();
  const capabilities = useCapabilities();
  const currentUser =
    session.state.status === "authenticated" ? session.state.user : undefined;

  return (
    <AppShell
      title="Campus Agora"
      sidebarItems={visibleNavigationItems(currentUser, capabilities)}
      topbarContent={<AuthPanel session={session} />}
    >
      <Routes>
        <Route path={ROUTES.home} element={<HomePage session={session} />} />
        <Route
          path={ROUTES.archiveList}
          element={<ArchiveListPage session={session} />}
        />
        <Route path={ROUTES.archiveNew} element={<ArchiveEditorPage />} />
        <Route
          path={ROUTES.archiveDetail}
          element={<ArchiveDetailPage session={session} />}
        />
        <Route path={ROUTES.archiveEdit} element={<ArchiveEditorPage />} />
        <Route
          path={ROUTES.discussionList}
          element={<DiscussionListPage session={session} />}
        />
        <Route path={ROUTES.discussionNew} element={<DiscussionEditorPage />} />
        <Route
          path={ROUTES.discussionDetail}
          element={<DiscussionDetailPage session={session} />}
        />
        <Route
          path={ROUTES.moderationQueue}
          element={<ModerationQueuePage session={session} />}
        />
        <Route path={ROUTES.designSystem} element={<DesignSystemPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppShell>
  );
}
