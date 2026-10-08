// Which class and assignment is this page? Pure, table-driven detection from the URL plus
// whatever text the page offers (title, breadcrumbs, heading). Plain script, no imports:
// it is injected before presence.js (MV3 content scripts cannot import modules) and read by
// test/context.test.mjs through globalThis.TrailContext.
//
// detectContext(url, title, breadcrumbs, heading) -> context | null
//   url          string
//   title        document.title
//   breadcrumbs  array of {text, href} | array of strings | "A › B › C" string | null
//   heading      first h1/h2 text, optional
// context = { host, editor, kind, course_key, course_label, item_key, item_label, editor_doc }
//   editor_doc is set only for writing editors (same scheme as recorder.js docIdFromUrl):
//   the background maps it to the document's random id.
(function (root) {
  const clean = (s) => (s || "").replace(/\s+/g, " ").trim().slice(0, 200);
  const stripEditorSuffix = (t) => clean(t).replace(/ [-–|] (Google Docs|Notion|Word|Microsoft Word)$/i, "");

  function normalizeCrumbs(bc) {
    if (!bc) return [];
    if (typeof bc === "string") return bc.split(/\s*[›>»/|]\s*/).map((t) => ({ text: clean(t), href: null })).filter((c) => c.text);
    return bc.map((c) => (typeof c === "string" ? { text: clean(c), href: null } : { text: clean(c && c.text), href: (c && c.href) || null })).filter((c) => c.text);
  }
  function crumbWithHref(crumbs, re) {
    for (const c of crumbs) if (c.href && re.test(c.href)) return c;
    return null;
  }
  // "ENG 101 - Essay 2" -> ["ENG 101", "Essay 2"]; one part when there is no separator.
  function splitTitle(title) {
    const t = clean(title);
    const i = t.indexOf(" - ");
    return i > 0 ? [t.slice(0, i), t.slice(i + 3)] : [t];
  }
  // itemFirst: Brightspace and Blackboard title their pages "<item> - <course>"; Canvas the other way round.
  function fallbackCourseLabel(crumbs, title, courseHrefRe, itemFirst) {
    const byHref = crumbWithHref(crumbs, courseHrefRe);
    if (byHref) return byHref.text;
    if (crumbs.length >= 2) return crumbs[1].text;
    const parts = splitTitle(title);
    return parts.length === 2 ? parts[itemFirst ? 1 : 0] : null;
  }
  function fallbackItemLabel(heading, title, crumbs, itemFirst) {
    if (clean(heading)) return clean(heading);
    const parts = splitTitle(title);
    if (parts.length === 2 && parts[itemFirst ? 0 : 1]) return parts[itemFirst ? 0 : 1];
    if (crumbs.length >= 3) return crumbs[crumbs.length - 1].text;
    return clean(title) || null;
  }

  // ---- Canvas: /courses/<id>/<section>/<id|slug> ------------------------------------------
  const CANVAS_ITEMS = [
    [/^\/courses\/(\d+)\/assignments\/(\d+)/, "assignment"],
    [/^\/courses\/(\d+)\/quizzes\/(\d+)/, "quiz"],
    [/^\/courses\/(\d+)\/discussion_topics\/(\d+)/, "discussion"],
    [/^\/courses\/(\d+)\/pages\/([^/?#]+)/, "page"],
    [/^\/courses\/(\d+)\/modules/, "module"],
    [/^\/courses\/(\d+)/, "course"],
  ];
  function canvas(u, title, crumbs, heading) {
    for (const [re, kind] of CANVAS_ITEMS) {
      const m = u.pathname.match(re);
      if (!m) continue;
      const courseId = m[1];
      const course_key = `canvas:${u.host}:${courseId}`;
      const course_label = fallbackCourseLabel(crumbs, title, new RegExp(`/courses/${courseId}/?$`));
      if (kind === "course") return { kind, course_key, course_label, item_key: course_key, item_label: course_label || clean(title) || "Course" };
      const itemId = kind === "module" ? "modules" : decodeURIComponent(m[2]);
      return { kind, course_key, course_label, item_key: `${course_key}:${kind}:${itemId}`, item_label: kind === "module" ? "Modules" : fallbackItemLabel(heading, title, crumbs) };
    }
    return null;
  }

  // ---- Moodle: /course/view.php?id=<id>, /mod/<type>/view.php?id=<id> -----------------------
  function moodle(u, title, crumbs, heading) {
    const courseRe = /\/course\/view\.php\?(?:.*&)?id=(\d+)/;
    let m = u.pathname.match(/^\/course\/view\.php$/);
    if (m && u.searchParams.get("id")) {
      const course_key = `moodle:${u.host}:${u.searchParams.get("id")}`;
      const label = clean(heading) || fallbackCourseLabel(crumbs, title, courseRe) || clean(title) || "Course";
      return { kind: "course", course_key, course_label: label, item_key: course_key, item_label: label };
    }
    m = u.pathname.match(/^\/mod\/([a-z_]+)\/view\.php$/);
    if (m && u.searchParams.get("id")) {
      const type = m[1];
      const courseCrumb = crumbWithHref(crumbs, courseRe);
      const courseId = courseCrumb ? courseCrumb.href.match(courseRe)[1] : null;
      const course_key = courseId ? `moodle:${u.host}:${courseId}` : `moodle:${u.host}:unknown`;
      const course_label = courseCrumb ? courseCrumb.text : fallbackCourseLabel(crumbs, title, courseRe);
      const kind = type === "assign" ? "assignment" : type === "quiz" ? "quiz" : type === "forum" ? "discussion" : type === "page" || type === "book" || type === "resource" || type === "url" ? "page" : type;
      return { kind, course_key, course_label, item_key: `${course_key}:${type}:${u.searchParams.get("id")}`, item_label: fallbackItemLabel(heading, title, crumbs) };
    }
    return null;
  }

  // ---- Blackboard: Ultra /ultra/courses/<id>/..., classic /webapps/...?course_id=&content_id= ----
  function blackboard(u, title, crumbs, heading) {
    let m = u.pathname.match(/^\/ultra\/courses\/([^/]+)/);
    if (m) {
      const course_key = `blackboard:${u.host}:${m[1]}`;
      const course_label = fallbackCourseLabel(crumbs, title, new RegExp(`/ultra/courses/${m[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/?`), true);
      const item = u.pathname.match(/\/outline\/(?:[a-z]+\/)?(assessment|document|lti|file|link|folder|discussion|journal|courselink|edit\/document)\/([^/?#]+)/);
      if (!item) return { kind: "course", course_key, course_label, item_key: course_key, item_label: course_label || clean(title) || "Course" };
      const seg = item[1];
      const kind = seg === "assessment" ? "assignment" : seg === "discussion" || seg === "journal" ? "discussion" : seg === "document" || seg === "edit/document" ? "page" : "item";
      return { kind, course_key, course_label, item_key: `${course_key}:${kind}:${item[2]}`, item_label: fallbackItemLabel(heading, title, crumbs, true) };
    }
    const courseId = u.searchParams.get("course_id");
    if (u.pathname.startsWith("/webapps/") && courseId) {
      const course_key = `blackboard:${u.host}:${courseId}`;
      const course_label = fallbackCourseLabel(crumbs, title, new RegExp(`course_id=${courseId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(&|$)`), true);
      const contentId = u.searchParams.get("content_id");
      if (!contentId) return { kind: "course", course_key, course_label, item_key: course_key, item_label: course_label || clean(title) || "Course" };
      const kind = /\/webapps\/assignment\//.test(u.pathname) ? "assignment" : /\/webapps\/assessment\//.test(u.pathname) ? "quiz" : /\/webapps\/discussionboard\//.test(u.pathname) ? "discussion" : "page";
      return { kind, course_key, course_label, item_key: `${course_key}:${kind}:${contentId}`, item_label: fallbackItemLabel(heading, title, crumbs, true) };
    }
    return null;
  }

  // ---- Brightspace (D2L): org unit in the path or ?ou= ---------------------------------------
  const D2L_ITEMS = [
    [/^\/d2l\/le\/content\/(\d+)\/viewContent\/(\d+)/, "page"],
    [/^\/d2l\/le\/lessons\/(\d+)\/(?:units|lessons|topics)\/(\d+)/, "page"],
    [/^\/d2l\/le\/(\d+)\/discussions\/threads\/(\d+)/, "discussion"],
    [/^\/d2l\/le\/(\d+)\/discussions\/(?:topics|posts)\/(\d+)/, "discussion"],
    [/^\/d2l\/le\/content\/(\d+)/, "course"],
    [/^\/d2l\/home\/(\d+)/, "course"],
    [/^\/d2l\/le\/(\d+)\//, "course"],
  ];
  function brightspace(u, title, crumbs, heading) {
    const ou = u.searchParams.get("ou");
    const courseLabelOf = (unit) => fallbackCourseLabel(crumbs, title, new RegExp(`/d2l/(home|le/content)/${unit}(/|$)|[?&]ou=${unit}(&|$)`), true);
    if (/^\/d2l\/lms\/dropbox\//.test(u.pathname) && ou) {
      const course_key = `brightspace:${u.host}:${ou}`;
      const id = u.searchParams.get("db") || "folders";
      return { kind: "assignment", course_key, course_label: courseLabelOf(ou), item_key: `${course_key}:assignment:${id}`, item_label: fallbackItemLabel(heading, title, crumbs, true) };
    }
    if (/^\/d2l\/lms\/quizzing\//.test(u.pathname) && ou) {
      const course_key = `brightspace:${u.host}:${ou}`;
      const id = u.searchParams.get("qi") || "quizzes";
      return { kind: "quiz", course_key, course_label: courseLabelOf(ou), item_key: `${course_key}:quiz:${id}`, item_label: fallbackItemLabel(heading, title, crumbs, true) };
    }
    for (const [re, kind] of D2L_ITEMS) {
      const m = u.pathname.match(re);
      if (!m) continue;
      const course_key = `brightspace:${u.host}:${m[1]}`;
      const course_label = courseLabelOf(m[1]);
      if (kind === "course") return { kind, course_key, course_label, item_key: course_key, item_label: course_label || clean(title) || "Course" };
      return { kind, course_key, course_label, item_key: `${course_key}:${kind}:${m[2]}`, item_label: fallbackItemLabel(heading, title, crumbs, true) };
    }
    if (ou && /^\/d2l\//.test(u.pathname)) {
      const course_key = `brightspace:${u.host}:${ou}`;
      const course_label = courseLabelOf(ou);
      return { kind: "course", course_key, course_label, item_key: course_key, item_label: course_label || clean(title) || "Course" };
    }
    return null;
  }

  // ---- Writing editors: the same id scheme as recorder.js docIdFromUrl ---------------------
  function docIdFromUrl(u) {
    const host = u.host, p = u.pathname;
    if (host === "docs.google.com") { const m = p.match(/\/document\/d\/([^/]+)/); return m ? "gdoc:" + m[1] : null; }
    if (host.endsWith("notion.so") || host.endsWith("notion.site")) { const m = p.match(/([0-9a-f]{32})/); return m ? "notion:" + m[1] : null; }
    if (host.includes("officeapps.live.com") || host === "word.cloud.microsoft" || host.endsWith("sharepoint.com")) {
      const id = u.searchParams.get("sourcedoc") || u.searchParams.get("wdOrigin") || p; return "word:" + id;
    }
    return null;
  }
  function writing(u, title) {
    const editor_doc = docIdFromUrl(u);
    if (!editor_doc) return null;
    return { kind: "writing", course_key: "writing", course_label: "Writing", item_key: editor_doc, item_label: stripEditorSuffix(title) || "Untitled document", editor_doc };
  }

  // ---- site table ------------------------------------------------------------------------------
  const SITES = [
    { editor: "canvas", match: (h) => h.endsWith(".instructure.com"), detect: canvas },
    { editor: "moodle", match: (h) => h.endsWith(".moodle.org") || h === "moodle.org" || h.includes("moodle"), detect: moodle },
    { editor: "blackboard", match: (h) => h.endsWith(".blackboard.com"), detect: blackboard },
    { editor: "brightspace", match: (h) => h.endsWith(".brightspace.com") || h.includes("d2l"), detect: brightspace },
    { editor: "docs", match: (h) => h === "docs.google.com", detect: writing },
    { editor: "notion", match: (h) => h.endsWith("notion.so") || h.endsWith("notion.site"), detect: writing },
    { editor: "word", match: (h) => h === "word.cloud.microsoft" || h.endsWith(".officeapps.live.com") || h.endsWith(".sharepoint.com"), detect: writing },
  ];

  function detectContext(url, title, breadcrumbs, heading) {
    let u;
    try { u = new URL(url); } catch { return null; }
    const site = SITES.find((s) => s.match(u.host));
    if (!site) return null;
    const crumbs = normalizeCrumbs(breadcrumbs);
    const ctx = site.detect(u, title || "", crumbs, heading || "");
    if (!ctx) return null;
    return { host: u.host, editor: site.editor, kind: ctx.kind, course_key: ctx.course_key, course_label: ctx.course_label || null, item_key: ctx.item_key, item_label: ctx.item_label || null, editor_doc: ctx.editor_doc || null };
  }

  root.TrailContext = { detectContext, docIdFromUrl: (url) => { try { return docIdFromUrl(new URL(url)); } catch { return null; } } };
})(typeof globalThis !== "undefined" ? globalThis : this);
