import {
  BookmarkIcon,
  LinkIcon,
  MoonIcon,
  PeopleIcon,
  SunIcon,
  TableIcon,
  TelescopeIcon,
} from "@primer/octicons-react";
import {
  ActionList,
  ActionMenu,
  Button,
  CounterLabel,
  Details,
  Link,
  PageLayout,
  Stack,
  Text,
  UnderlineNav,
} from "@primer/react";
import { Hidden } from "@primer/react/experimental";
import { useEffect } from "react";
import brandMark from "../assets/campus-agora-mark.svg";
import { AdvisorPage } from "../features/advisor/AdvisorPage";
import { ComparePage } from "../features/compare/ComparePage";
import { FindPage } from "../features/find/FindPage";
import { HomePage } from "../features/home/HomePage";
import { OpportunitiesPage } from "../features/opportunities/OpportunitiesPage";
import { TopicPage } from "../features/topics/TopicPage";
import { TopicsPage } from "../features/topics/TopicsPage";
import { useCompare } from "../state/compare";
import { useTopics } from "../state/topics";
import { type Route, href, useRoute } from "./router";

type Section = "home" | "find" | "opportunities" | "compare" | "topics";

function sectionOf(route: Route): Section {
  if (route.page === "advisor") return "find";
  if (route.page === "topic") return "topics";
  return route.page;
}

function Page({ route }: { route: Route }) {
  switch (route.page) {
    case "find":
      return <FindPage />;
    case "advisor":
      return <AdvisorPage id={route.id} />;
    case "compare":
      return <ComparePage />;
    case "opportunities":
      return <OpportunitiesPage type={route.type} />;
    case "topics":
      return <TopicsPage />;
    case "topic":
      return <TopicPage id={route.id} />;
    default:
      return <HomePage />;
  }
}

export function App({
  colorMode,
  onToggleColorMode,
}: {
  colorMode: "day" | "night";
  onToggleColorMode: () => void;
}) {
  const route = useRoute();
  const section = sectionOf(route);
  const compareCount = useCompare().length;
  const topicCount = useTopics().length;

  const routeKey = href(route);
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll to top whenever the page changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [routeKey]);

  const items: {
    route: Route & { page: Section };
    label: string;
    icon: typeof PeopleIcon;
    counter?: number;
  }[] = [
    { route: { page: "home" }, label: "探索", icon: TelescopeIcon },
    { route: { page: "find" }, label: "找导师", icon: PeopleIcon },
    { route: { page: "opportunities" }, label: "机会与入口", icon: LinkIcon },
    {
      route: { page: "compare" },
      label: "比较",
      icon: TableIcon,
      counter: compareCount || undefined,
    },
    {
      route: { page: "topics" },
      label: "我的探索",
      icon: BookmarkIcon,
      counter: topicCount || undefined,
    },
  ];
  const currentItem = items.find((item) => item.route.page === section) ?? items[0];

  return (
    <PageLayout containerWidth="large" padding="normal" rowGap="normal">
      <PageLayout.Header>
        <Stack gap="normal">
          <Stack
            direction="horizontal"
            align="center"
            justify="space-between"
            gap="normal"
          >
            <Link href={href({ page: "home" })} muted aria-label="Campus Agora 首页">
              <Stack as="span" direction="horizontal" align="center" gap="condensed">
                <img src={brandMark} width={32} height={32} alt="" />
                <Text size="large" weight="semibold">
                  Campus Agora
                </Text>
              </Stack>
            </Link>
            <Button
              variant="invisible"
              size="small"
              leadingVisual={colorMode === "day" ? MoonIcon : SunIcon}
              onClick={onToggleColorMode}
              aria-label={`切换到${colorMode === "day" ? "深色" : "浅色"}模式`}
            >
              {colorMode === "day" ? "深色模式" : "浅色模式"}
            </Button>
          </Stack>
          <Hidden when="narrow">
            <UnderlineNav aria-label="主要导航" variant="flush">
              {items.map((item) => (
                <UnderlineNav.Item
                  key={item.route.page}
                  href={href(item.route)}
                  icon={item.icon}
                  counter={item.counter}
                  aria-current={section === item.route.page ? "page" : undefined}
                >
                  {item.label}
                </UnderlineNav.Item>
              ))}
            </UnderlineNav>
          </Hidden>
          <Hidden when={["regular", "wide"]}>
            <ActionMenu>
              <ActionMenu.Button aria-label={`页面导航：${currentItem.label}`}>
                {currentItem.label}{" "}
                {currentItem.counter && (
                  <CounterLabel>{currentItem.counter}</CounterLabel>
                )}
              </ActionMenu.Button>
              <ActionMenu.Overlay>
                <ActionList aria-label="主要导航">
                  {items.map((item) => (
                    <ActionList.LinkItem
                      key={item.route.page}
                      href={href(item.route)}
                      active={section === item.route.page}
                      aria-current={section === item.route.page ? "page" : undefined}
                    >
                      <ActionList.LeadingVisual>
                        <item.icon />
                      </ActionList.LeadingVisual>
                      {item.label}
                      {item.counter && (
                        <ActionList.TrailingVisual>
                          <CounterLabel>{item.counter}</CounterLabel>
                        </ActionList.TrailingVisual>
                      )}
                    </ActionList.LinkItem>
                  ))}
                </ActionList>
              </ActionMenu.Overlay>
            </ActionMenu>
          </Hidden>
        </Stack>
      </PageLayout.Header>
      <PageLayout.Content as="main" width="large" aria-label="主要内容">
        <Page route={route} />
      </PageLayout.Content>
      <PageLayout.Footer divider="line">
        <Stack gap="normal" paddingBlock="normal">
          <Text size="small">名额、截止日期与申请条件以原站为准。</Text>
          <Details>
            <Details.Summary>资料与保存说明</Details.Summary>
            <Stack gap="condensed" paddingBlock="normal">
              <Text size="small">
                资料来自公开页面，附来源与查看日期。已有样本按编辑顺序展示，不代表推荐或完整搜索结果；已结束的批次仅作历史参考。
              </Text>
              <Text size="small">
                探索主题与外观选择保存在本浏览器，不同步到其他设备。
              </Text>
            </Stack>
          </Details>
        </Stack>
      </PageLayout.Footer>
    </PageLayout>
  );
}
