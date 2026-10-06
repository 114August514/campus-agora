//! Bounded live discovery: a public search index followed by official HTML pages.
//! Source text is untrusted evidence, never executable instructions.
use std::collections::HashSet;
use std::net::{IpAddr, SocketAddr};
use std::time::Duration;

use chrono::{SecondsFormat, Utc};
use reqwest::{redirect::Policy, Url};
use scraper::{Html, Selector};
use tokio::net::lookup_host;
use tokio::task::JoinSet;
use tokio::time::timeout;

const MAX_PAGE_BYTES: usize = 1_000_000;
const MAX_SOURCES: usize = 5;
const SEARCH_HOST: &str = "html.duckduckgo.com";
const SUFFIXES: &[&str] = &[
    "edu.cn", "ac.cn", "cas.cn", "edu", "edu.hk", "ac.uk", "edu.sg",
];
const PERSONAL_HOSTS: &[&str] = &[
    "tqchen.com",
    "xiangwang1223.github.io",
    "xiongyingfei.github.io",
    "cse.ust.hk",
];
pub const DISCOVERY_SCOPE: &str = "DuckDuckGo公开索引中的高校与研究所网站（edu.cn、ac.cn、cas.cn、edu、edu.hk、ac.uk、edu.sg），及已核对的学术主页tqchen.com、xiangwang1223.github.io、xiongyingfei.github.io、cse.ust.hk；最多读取5个公开HTML页面，不覆盖全网、私域、PDF或需登录页面。";
pub const DIRECTORY_SCOPE: &str = "公开索引本次不可用，改为实时读取并匹配两个有限公开目录：Stanford AI Laboratory导师目录（ai.stanford.edu/faculty/）、CMU Machine Learning导师目录（ml.cmu.edu/people/core-faculty）。仅返回目录正文命中，不是全网搜索或个人推荐；不代表当前招生。";
const DIRECTORIES: &[(&str, &str)] = &[
    (
        "https://ai.stanford.edu/faculty/",
        "Stanford AI Laboratory导师目录",
    ),
    (
        "https://ml.cmu.edu/people/core-faculty",
        "CMU Machine Learning导师目录",
    ),
];

#[derive(Debug)]
pub struct DiscoveryResult {
    pub query: String,
    pub provider: &'static str,
    pub scope: &'static str,
    pub collected_at: String,
    pub status: &'static str,
    pub sources: Vec<DiscoveredSource>,
    pub warnings: Vec<DiscoveryWarning>,
}

#[derive(Debug)]
pub struct DiscoveredSource {
    pub url: String,
    pub title: String,
    pub institution: String,
    pub content: String,
    pub search_snippet: String,
    pub relevance_evidence: Vec<String>,
    pub collected_at: String,
    pub published_at: Option<String>,
    pub unknowns: Vec<String>,
}

#[derive(Debug)]
pub struct DiscoveryWarning {
    pub code: &'static str,
    pub message: String,
    pub url: Option<String>,
}

#[derive(Debug)]
struct SearchHit {
    url: Url,
    title: String,
    snippet: String,
}

pub fn validate_query(query: &str) -> Result<String, &'static str> {
    let query = query.trim();
    if query.is_empty() || query.chars().count() > 200 || query.chars().any(char::is_control) {
        return Err("请输入1至200字的公开兴趣或导师查询。请勿输入私人信息。");
    }
    Ok(query.to_owned())
}

pub async fn discover(query: String) -> DiscoveryResult {
    let collected_at = now();
    let mut result = DiscoveryResult {
        query: query.clone(),
        provider: "duckduckgo_html",
        scope: DISCOVERY_SCOPE,
        collected_at,
        status: "complete",
        sources: Vec::new(),
        warnings: Vec::new(),
    };
    let mut search_url = Url::parse("https://html.duckduckgo.com/html/").expect("fixed search URL");
    let filter = SUFFIXES
        .iter()
        .chain(PERSONAL_HOSTS)
        .map(|suffix| format!("site:{suffix}"))
        .collect::<Vec<_>>()
        .join(" OR ");
    search_url
        .query_pairs_mut()
        .append_pair("q", &format!("{query} ({filter})"));
    let search_html = match bounded_get(search_url, true).await {
        Ok((_, html)) => html,
        Err(code) => {
            result.warnings.push(DiscoveryWarning {
                code,
                message: "公开搜索服务暂时不可用；改用明确限定的官方公开目录实时匹配，没有用演示样本替代。".into(),
                url: None,
            });
            return discover_directories(result).await;
        }
    };
    let hits = match parse_search(&search_html) {
        Ok(hits) => hits,
        Err(code) => {
            result.warnings.push(DiscoveryWarning {
                code,
                message: "搜索服务返回验证页或无法识别的结果；改用明确限定的官方公开目录实时匹配。"
                    .into(),
                url: None,
            });
            return discover_directories(result).await;
        }
    };
    if hits.is_empty() {
        result.warnings.push(DiscoveryWarning {
            code: "no_results",
            message: "本次公开索引没有返回范围内结果；不代表不存在相关导师。可调整关键词后重试。"
                .into(),
            url: None,
        });
        return result;
    }
    let mut tasks = JoinSet::new();
    for (index, hit) in hits.into_iter().take(MAX_SOURCES).enumerate() {
        let query = query.clone();
        tasks.spawn(async move {
            let original_url = hit.url.to_string();
            let source = read_source(hit, &query).await;
            (index, original_url, source)
        });
    }
    let mut sources = Vec::new();
    while let Some(task) = tasks.join_next().await {
        match task {
            Ok((index, _, Ok(source))) => sources.push((index, source)),
            Ok((_, url, Err(code))) => result.warnings.push(DiscoveryWarning {
                code,
                message: "搜索找到该页面，但本次未取得可用HTML正文；未把搜索摘要当作已读正文。"
                    .into(),
                url: Some(url),
            }),
            Err(_) => result.warnings.push(DiscoveryWarning {
                code: "read_failed",
                message: "一个正文读取任务未完成。".into(),
                url: None,
            }),
        }
    }
    sources.sort_by_key(|(index, _)| *index);
    result.sources = sources.into_iter().map(|(_, source)| source).collect();
    if !result.warnings.is_empty() {
        result.status = if result.sources.is_empty() {
            "failed"
        } else {
            "partial"
        };
    }
    result
}

async fn discover_directories(mut result: DiscoveryResult) -> DiscoveryResult {
    result.provider = "official_directory";
    result.scope = DIRECTORY_SCOPE;
    let mut tasks = JoinSet::new();
    for (index, (url, title)) in DIRECTORIES.iter().enumerate() {
        let query = result.query.clone();
        let hit = SearchHit {
            url: Url::parse(url).expect("fixed directory URL"),
            title: (*title).into(),
            snippet: String::new(),
        };
        tasks.spawn(async move { (index, *url, read_source(hit, &query).await) });
    }
    let mut sources = Vec::new();
    let mut readable = 0;
    while let Some(task) = tasks.join_next().await {
        match task {
            Ok((index, _, Ok(source))) => {
                readable += 1;
                if !source.relevance_evidence.is_empty() {
                    sources.push((index, source));
                }
            }
            Ok((_, url, Err(code))) => result.warnings.push(DiscoveryWarning {
                code,
                message: "备用公开目录本次未取得可用正文。".into(),
                url: Some(url.into()),
            }),
            Err(_) => result.warnings.push(DiscoveryWarning {
                code: "read_failed",
                message: "备用目录读取任务未完成。".into(),
                url: None,
            }),
        }
    }
    sources.sort_by_key(|(index, _)| *index);
    result.sources = sources.into_iter().map(|(_, source)| source).collect();
    result.status = if readable == 0 { "failed" } else { "partial" };
    if result.sources.is_empty() && readable > 0 {
        result.warnings.push(DiscoveryWarning {
            code: "directory_no_matches",
            message: "已实时读取限定目录，但正文没有匹配当前关键词；不代表其他机构没有相关导师。"
                .into(),
            url: None,
        });
    }
    result
}

fn query_terms(query: &str) -> Vec<String> {
    let lower = query.to_lowercase();
    let mut terms = lower
        .split_whitespace()
        .filter(|term| {
            term.chars().count() >= 2
                && ![
                    "professor",
                    "faculty",
                    "research",
                    "导师",
                    "教授",
                    "研究",
                    "ai",
                    "ml",
                ]
                .contains(term)
        })
        .map(str::to_owned)
        .collect::<Vec<_>>();
    // Explicit vocabulary equivalence, not model translation or inferred preferences.
    for (original, english) in [
        ("人工智能", "artificial intelligence"),
        ("机器学习", "machine learning"),
        ("软件", "software"),
        ("系统", "systems"),
        ("强化学习", "reinforcement learning"),
        ("数据库", "database"),
        ("统计", "statistics"),
        ("计算机视觉", "computer vision"),
    ] {
        if lower.contains(original) {
            terms.push(english.into());
        }
    }
    if lower.split_whitespace().any(|term| term == "ai") {
        terms.push("artificial intelligence".into());
    }
    if lower.split_whitespace().any(|term| term == "ml") {
        terms.push("machine learning".into());
    }
    terms
}

async fn read_source(hit: SearchHit, query: &str) -> Result<DiscoveredSource, &'static str> {
    let (url, html) = bounded_get(hit.url, false).await?;
    let (content, published_at) = extract_page(&html);
    if content.chars().count() < 80 {
        return Err("body_unavailable");
    }
    let terms = query_terms(query);
    let relevance_evidence = content
        .split('\n')
        .filter(|line| {
            let lower = line.to_lowercase();
            terms.iter().any(|term| lower.contains(term))
        })
        .take(3)
        .map(|line| line.chars().take(500).collect())
        .collect();
    let mut unknowns = vec![
        "未核实当前招生、参与名额、资格与截止时间；请查看原站或进一步询问。".into(),
        "公开介绍不证明实际指导体验或个人适配性。".into(),
    ];
    if published_at.is_none() {
        unknowns.push("原页面未提供可识别的发布日期；采集时间不等于发布时间。".into());
    }
    Ok(DiscoveredSource {
        institution: url.host_str().unwrap_or_default().to_owned(),
        url: url.to_string(),
        title: hit.title,
        content,
        search_snippet: hit.snippet,
        relevance_evidence,
        collected_at: now(),
        published_at,
        unknowns,
    })
}

fn parse_search(html: &str) -> Result<Vec<SearchHit>, &'static str> {
    let document = Html::parse_document(html);
    let results = selector(".result");
    let links = selector(".result__a");
    let snippets = selector(".result__snippet");
    let mut seen = HashSet::new();
    let mut hits = Vec::new();
    for result in document.select(&results) {
        let Some(link) = result.select(&links).next() else {
            continue;
        };
        let Some(href) = link.value().attr("href") else {
            continue;
        };
        let Some(url) = search_target(href) else {
            continue;
        };
        if !allowed_url(&url, false) || !seen.insert(url.to_string()) {
            continue;
        }
        hits.push(SearchHit {
            url,
            title: normalize(&link.text().collect::<Vec<_>>().join(" ")),
            snippet: result
                .select(&snippets)
                .next()
                .map(|snippet| normalize(&snippet.text().collect::<Vec<_>>().join(" ")))
                .unwrap_or_default(),
        });
    }
    if hits.is_empty()
        && document.select(&links).next().is_none()
        && document
            .select(&selector(".no-results, .result--no-result"))
            .next()
            .is_none()
    {
        // An HTML 200 can be a CAPTCHA. It is not an empty successful search.
        return Err("search_blocked");
    }
    Ok(hits)
}

fn search_target(href: &str) -> Option<Url> {
    let href = if href.starts_with("//") {
        format!("https:{href}")
    } else {
        href.to_owned()
    };
    let url = Url::parse(&href).ok()?;
    if url.host_str() == Some("duckduckgo.com") {
        let target = url
            .query_pairs()
            .find(|(name, _)| name == "uddg")?
            .1
            .into_owned();
        Url::parse(&target).ok()
    } else {
        Some(url)
    }
}

fn extract_page(html: &str) -> (String, Option<String>) {
    let document = Html::parse_document(html);
    let main = document
        .select(&selector("main, article, [role=main]"))
        .next()
        .or_else(|| document.select(&selector("body")).next());
    let mut blocks = Vec::new();
    let mut seen = HashSet::new();
    if let Some(main) = main {
        for element in main.select(&selector("h1, h2, h3, p, li, td, pre")) {
            // Avoid executable and common navigation content, preserving source text.
            if element
                .ancestors()
                .filter_map(scraper::ElementRef::wrap)
                .any(|ancestor| {
                    matches!(
                        ancestor.value().name(),
                        "script" | "style" | "nav" | "header" | "footer" | "noscript"
                    )
                })
            {
                continue;
            }
            let text = normalize(&element.text().collect::<Vec<_>>().join(" "));
            if text.chars().count() >= 15 && seen.insert(text.clone()) {
                blocks.push(text);
            }
        }
        // Faculty directories often use div-based rows rather than paragraphs.
        if blocks.iter().map(String::len).sum::<usize>() < 500 {
            blocks.clear();
            for node in main.descendants() {
                if node
                    .ancestors()
                    .filter_map(scraper::ElementRef::wrap)
                    .any(|ancestor| {
                        matches!(
                            ancestor.value().name(),
                            "script" | "style" | "nav" | "header" | "footer" | "noscript"
                        )
                    })
                {
                    continue;
                }
                if let Some(text) = node.value().as_text() {
                    let text = normalize(text);
                    if text.chars().count() >= 2 {
                        blocks.push(text);
                    }
                }
            }
        }
    }
    let published_at = document
        .select(&selector(
            "meta[property='article:published_time'], meta[name='citation_publication_date']",
        ))
        .find_map(|element| element.value().attr("content"))
        .map(str::to_owned);
    (
        blocks.join("\n").chars().take(16_000).collect(),
        published_at,
    )
}

async fn bounded_get(url: Url, search: bool) -> Result<(Url, String), &'static str> {
    timeout(Duration::from_secs(14), safe_get(url, search))
        .await
        .map_err(|_| "fetch_timeout")?
}

async fn safe_get(mut url: Url, search: bool) -> Result<(Url, String), &'static str> {
    for _ in 0..4 {
        if !allowed_url(&url, search) {
            return Err("source_out_of_scope");
        }
        let host = url.host_str().ok_or("invalid_source")?;
        let port = url.port_or_known_default().ok_or("invalid_source")?;
        let addresses = public_addresses(host, port).await?;
        let client = reqwest::Client::builder()
            .redirect(Policy::none())
            .no_proxy()
            .connect_timeout(Duration::from_secs(5))
            .timeout(Duration::from_secs(10))
            .user_agent("CampusAgoraDemo/0.1 (public academic discovery)")
            .resolve_to_addrs(host, &addresses)
            .build()
            .map_err(|_| "client_failed")?;
        let mut response = client
            .get(url.clone())
            .send()
            .await
            .map_err(|_| "fetch_failed")?;
        if response.status().is_redirection() {
            let location = response
                .headers()
                .get(reqwest::header::LOCATION)
                .and_then(|value| value.to_str().ok())
                .ok_or("invalid_redirect")?;
            url = url.join(location).map_err(|_| "invalid_redirect")?;
            continue;
        }
        if !response.status().is_success() {
            return Err("upstream_http_error");
        }
        let content_type = response
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .unwrap_or_default();
        if !content_type.starts_with("text/html")
            && !content_type.starts_with("application/xhtml+xml")
        {
            return Err("unsupported_content");
        }
        if response
            .content_length()
            .is_some_and(|length| length > MAX_PAGE_BYTES as u64)
        {
            return Err("page_too_large");
        }
        let mut bytes = Vec::new();
        while let Some(chunk) = response.chunk().await.map_err(|_| "fetch_failed")? {
            if bytes.len() + chunk.len() > MAX_PAGE_BYTES {
                return Err("page_too_large");
            }
            bytes.extend_from_slice(&chunk);
        }
        // First slice supports UTF-8 pages. Legacy encodings are not silently decoded.
        let html = String::from_utf8(bytes).map_err(|_| "unsupported_encoding")?;
        return Ok((url, html));
    }
    Err("too_many_redirects")
}

async fn public_addresses(host: &str, port: u16) -> Result<Vec<SocketAddr>, &'static str> {
    let addresses: Vec<SocketAddr> = lookup_host((host, port))
        .await
        .map_err(|_| "dns_failed")?
        .collect();
    if !addresses.is_empty() && addresses.iter().all(|address| public_ip(address.ip())) {
        return Ok(addresses);
    }
    // Local transparent network tools may synthesize 198.18/15 addresses.
    // Resolve only already-allowed hostnames using one fixed public DoH endpoint,
    // then pin real public IPv4 addresses. Never connect page requests to fake/private IPs.
    if addresses.is_empty() || !addresses.iter().all(|address| matches!(address.ip(), IpAddr::V4(ip) if matches!(ip.octets(), [198, 18..=19, _, _]))) {
        return Err("source_address_blocked");
    }
    let client = reqwest::Client::builder()
        .redirect(Policy::none())
        .no_proxy()
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|_| "client_failed")?;
    let response = client
        .get("https://dns.google/resolve")
        .query(&[("name", host), ("type", "A")])
        .send()
        .await
        .map_err(|_| "dns_failed")?;
    if !response.status().is_success()
        || response.content_length().is_some_and(|size| size > 32_768)
    {
        return Err("dns_failed");
    }
    let bytes = response.bytes().await.map_err(|_| "dns_failed")?;
    if bytes.len() > 32_768 {
        return Err("dns_failed");
    }
    let value: serde_json::Value = serde_json::from_slice(&bytes).map_err(|_| "dns_failed")?;
    let addresses = value["Answer"]
        .as_array()
        .into_iter()
        .flatten()
        .filter(|record| record["type"] == 1)
        .filter_map(|record| record["data"].as_str()?.parse::<IpAddr>().ok())
        .map(|ip| SocketAddr::new(ip, port))
        .collect::<Vec<_>>();
    if addresses.is_empty() || addresses.iter().any(|address| !public_ip(address.ip())) {
        return Err("source_address_blocked");
    }
    Ok(addresses)
}

fn allowed_url(url: &Url, search: bool) -> bool {
    if !matches!(url.scheme(), "http" | "https")
        || !url.username().is_empty()
        || url.password().is_some()
        || !matches!(url.port_or_known_default(), Some(80 | 443))
    {
        return false;
    }
    let Some(host) = url.host_str() else {
        return false;
    };
    if search {
        return host == SEARCH_HOST && url.scheme() == "https";
    }
    PERSONAL_HOSTS.contains(&host)
        || SUFFIXES
            .iter()
            .any(|suffix| host == *suffix || host.ends_with(&format!(".{suffix}")))
}

fn public_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => {
            !ip.is_private()
                && !ip.is_loopback()
                && !ip.is_link_local()
                && !ip.is_broadcast()
                && !ip.is_documentation()
                && !ip.is_unspecified()
                && !ip.is_multicast()
                && !matches!(
                    ip.octets(),
                    [0, _, _, _]
                        | [100, 64..=127, _, _]
                        | [198, 18..=19, _, _]
                        | [240..=255, _, _, _]
                )
        }
        IpAddr::V6(ip) => {
            // Accept only global unicast; mapped IPv4 follows the IPv4 rule.
            if let Some(ip) = ip.to_ipv4_mapped() {
                return public_ip(IpAddr::V4(ip));
            }
            let segments = ip.segments();
            segments[0] & 0xe000 == 0x2000
                && !(segments[0] == 0x2001 && matches!(segments[1], 0 | 2 | 0xdb8))
        }
    }
}

fn now() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Secs, true)
}
fn selector(css: &str) -> Selector {
    Selector::parse(css).expect("fixed CSS selector")
}
fn normalize(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_institutional_public_targets_are_allowed() {
        for url in [
            "https://cs.ustc.edu.cn/people",
            "https://www.cs.columbia.edu/~blei/",
            "https://ict.ac.cn/",
        ] {
            assert!(allowed_url(&Url::parse(url).unwrap(), false));
        }
        for url in [
            "http://127.0.0.1/",
            "https://cs.ustc.edu.cn.evil.example/",
            "https://user:password@cs.ustc.edu.cn/",
            "https://cs.ustc.edu.cn:9000/",
        ] {
            assert!(!allowed_url(&Url::parse(url).unwrap(), false));
        }
        for ip in [
            "127.0.0.1",
            "10.0.0.1",
            "169.254.169.254",
            "100.64.0.1",
            "::1",
            "::ffff:192.168.1.1",
            "2001:db8::1",
        ] {
            assert!(!public_ip(ip.parse().unwrap()));
        }
        assert!(public_ip("8.8.8.8".parse().unwrap()));
    }

    #[test]
    fn search_extracts_real_targets_and_detects_challenge() {
        let html = r#"<div class="result"><a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fcs.ustc.edu.cn%2F">导师主页</a><a class="result__snippet">研究系统</a></div>"#;
        let hits = parse_search(html).unwrap();
        assert_eq!(hits[0].url.as_str(), "https://cs.ustc.edu.cn/");
        assert_eq!(hits[0].snippet, "研究系统");
        assert_eq!(
            parse_search("<form>captcha</form>").unwrap_err(),
            "search_blocked"
        );
        assert!(parse_search(r#"<div class="result"><a class="result__a" href="https://example.com">Outside allowed scope</a></div>"#).unwrap().is_empty());
    }

    #[test]
    fn directory_matches_source_body_with_explicit_vocabulary_without_role_only_matches() {
        let (body, published_at) = extract_page("<body><main><h1>Faculty</h1><div>Ada Researcher</div><div>Machine Learning and Software Systems</div><time datetime='2026-11-01'>Office hours</time></main></body>");
        assert!(body.contains("Ada Researcher"));
        assert!(body.contains("Machine Learning and Software Systems"));
        assert!(query_terms("机器学习")
            .iter()
            .any(|term| body.to_lowercase().contains(term)));
        assert!(query_terms("教授 导师 professor").is_empty());
        assert!(!query_terms("zzzz-unmatched-field")
            .iter()
            .any(|term| body.to_lowercase().contains(term)));
        assert!(
            published_at.is_none(),
            "event time must not become publication time"
        );
    }

    #[test]
    fn body_excludes_navigation_scripts_and_keeps_unknown_publication() {
        let html = "<html><body><nav><p>Unrelated navigation should not become evidence.</p></nav><main><p>My research is machine learning and software systems.</p><script>execute('should not be included')</script></main></body></html>";
        let (body, date) = extract_page(html);
        assert_eq!(
            body,
            "My research is machine learning and software systems."
        );
        assert!(date.is_none());
        assert!(validate_query(" ").is_err());
        assert!(validate_query(&"a".repeat(201)).is_err());
    }
}
