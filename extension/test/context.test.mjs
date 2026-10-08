// Unit test for detectContext (src/context.js). Run: node extension/test/context.test.mjs
import "../src/context.js";
const { detectContext } = globalThis.TrailContext;

const cases = [
  {
    name: "canvas assignment with breadcrumb",
    args: ["https://x.instructure.com/courses/42/assignments/7", "Essay 2", [{ text: "Dashboard", href: "/" }, { text: "ENG 101", href: "/courses/42" }, { text: "Assignments", href: "/courses/42/assignments" }], "Essay 2: Cities and silence"],
    want: { editor: "canvas", kind: "assignment", course_key: "canvas:x.instructure.com:42", course_label: "ENG 101", item_key: "canvas:x.instructure.com:42:assignment:7", item_label: "Essay 2: Cities and silence", editor_doc: null },
  },
  {
    name: "canvas quiz, labels from title split",
    args: ["https://school.instructure.com/courses/9/quizzes/311?module_item_id=5", "HIST 200 - Week 3 quiz", null, ""],
    want: { kind: "quiz", course_key: "canvas:school.instructure.com:9", course_label: "HIST 200", item_key: "canvas:school.instructure.com:9:quiz:311", item_label: "Week 3 quiz" },
  },
  {
    name: "canvas discussion",
    args: ["https://x.instructure.com/courses/42/discussion_topics/88", "Discuss ch. 4", "Dashboard › ENG 101 › Discussions", "Discuss ch. 4"],
    want: { kind: "discussion", item_key: "canvas:x.instructure.com:42:discussion:88", course_label: "ENG 101" },
  },
  {
    name: "canvas page by slug and modules",
    args: ["https://x.instructure.com/courses/42/pages/syllabus-week-1", "Syllabus week 1", null, "Syllabus week 1"],
    want: { kind: "page", item_key: "canvas:x.instructure.com:42:page:syllabus-week-1", item_label: "Syllabus week 1" },
  },
  {
    name: "canvas modules list",
    args: ["https://x.instructure.com/courses/42/modules", "ENG 101", null, ""],
    want: { kind: "module", item_key: "canvas:x.instructure.com:42:module:modules", item_label: "Modules" },
  },
  {
    name: "canvas course home",
    args: ["https://x.instructure.com/courses/42", "ENG 101", null, ""],
    want: { kind: "course", course_key: "canvas:x.instructure.com:42", item_key: "canvas:x.instructure.com:42", item_label: "ENG 101" },
  },
  {
    name: "canvas dashboard is not homework",
    args: ["https://x.instructure.com/", "Dashboard", null, ""],
    want: null,
  },
  {
    name: "moodle course",
    args: ["https://learn.moodle.org/course/view.php?id=15", "Course: Biology 1", null, "Biology 1"],
    want: { editor: "moodle", kind: "course", course_key: "moodle:learn.moodle.org:15", item_key: "moodle:learn.moodle.org:15", course_label: "Biology 1" },
  },
  {
    name: "moodle assignment, course from breadcrumb href",
    args: ["https://learn.moodle.org/mod/assign/view.php?id=77", "Lab report", [{ text: "Home", href: "/" }, { text: "My courses", href: "/my/" }, { text: "Biology 1", href: "https://learn.moodle.org/course/view.php?id=15" }, { text: "Lab report", href: null }], "Lab report"],
    want: { kind: "assignment", course_key: "moodle:learn.moodle.org:15", course_label: "Biology 1", item_key: "moodle:learn.moodle.org:15:assign:77", item_label: "Lab report" },
  },
  {
    name: "blackboard ultra assessment",
    args: ["https://uni.blackboard.com/ultra/courses/_123_1/outline/assessment/_456_1/overview?courseId=_123_1", "Midterm essay", [{ text: "Courses", href: "/ultra/course" }, { text: "PHIL 110", href: "/ultra/courses/_123_1/outline" }], "Midterm essay"],
    want: { editor: "blackboard", kind: "assignment", course_key: "blackboard:uni.blackboard.com:_123_1", course_label: "PHIL 110", item_key: "blackboard:uni.blackboard.com:_123_1:assignment:_456_1" },
  },
  {
    name: "brightspace dropbox assignment",
    args: ["https://uni.brightspace.com/d2l/lms/dropbox/user/folder_submit_files.d2l?db=301&grpid=0&isprv=0&bp=0&ou=6650", "Assignment 1 - MATH 120", null, "Assignment 1"],
    want: { editor: "brightspace", kind: "assignment", course_key: "brightspace:uni.brightspace.com:6650", course_label: "MATH 120", item_key: "brightspace:uni.brightspace.com:6650:assignment:301", item_label: "Assignment 1" },
  },
  {
    name: "brightspace content topic",
    args: ["https://uni.brightspace.com/d2l/le/content/6650/viewContent/9001/View", "Topic 3 - MATH 120", null, ""],
    want: { kind: "page", item_key: "brightspace:uni.brightspace.com:6650:page:9001", course_label: "MATH 120", item_label: "Topic 3" },
  },
  {
    name: "google doc",
    args: ["https://docs.google.com/document/d/ABC123/edit", "Cities and silence - Google Docs", null, ""],
    want: { editor: "docs", kind: "writing", course_key: "writing", course_label: "Writing", item_key: "gdoc:ABC123", item_label: "Cities and silence", editor_doc: "gdoc:ABC123" },
  },
  {
    name: "notion page",
    args: ["https://www.notion.so/me/Essay-draft-0123456789abcdef0123456789abcdef", "Essay draft", null, ""],
    want: { editor: "notion", kind: "writing", editor_doc: "notion:0123456789abcdef0123456789abcdef", item_label: "Essay draft" },
  },
  {
    name: "unknown host",
    args: ["https://example.com/courses/1/assignments/2", "x", null, ""],
    want: null,
  },
];

let failed = 0;
for (const c of cases) {
  const got = detectContext(...c.args);
  const problems = [];
  if (c.want === null) { if (got !== null) problems.push(`expected null, got ${JSON.stringify(got)}`); }
  else if (!got) problems.push("expected a context, got null");
  else for (const [k, v] of Object.entries(c.want)) if (got[k] !== v) problems.push(`${k}: expected ${JSON.stringify(v)}, got ${JSON.stringify(got[k])}`);
  if (problems.length) { failed++; console.log(`FAIL ${c.name}\n  ${problems.join("\n  ")}`); }
  else console.log(`ok   ${c.name}`);
}
console.log(failed ? `${failed} of ${cases.length} failed` : `${cases.length} passed`);
process.exit(failed ? 1 : 0);
