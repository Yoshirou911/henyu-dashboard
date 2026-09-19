import type {
  Category,
  EvaluationType,
  Subject,
  Topic,
  University,
  UniversityPriority,
  UniversityRequirement,
} from "@/lib/types";

/**
 * Seed templates. These only ever *add* rows; once written the user owns them
 * and can rename / reorder / archive freely. Ids are deterministic
 * (`subj_<slug>`, `cat_<slug>_<key>`, `topic_<slug>_<key>_<i>`) so seeding is
 * idempotent and dependencies can be resolved reliably.
 */

export interface RoadmapCategory {
  key: string;
  name: string;
  /** 0 = main progression line, 1 = parallel route */
  track: number;
  /** category keys (same subject) that come before this one */
  after: string[];
  topics: string[];
}

export interface SubjectTemplate {
  slug: string;
  name: string;
  evaluationType: EvaluationType;
  color: string;
  categories: RoadmapCategory[];
}

export const MATH_ROADMAP: RoadmapCategory[] = [
  {
    key: "hs-remedial",
    name: "高校数学補修",
    track: 0,
    after: [],
    topics: [
      "展開",
      "因数分解",
      "方程式",
      "不等式",
      "分数式",
      "平方根・指数の基本",
      "関数とは何か",
      "一次関数",
      "二次関数",
      "定義域・値域",
      "グラフ",
      "指数法則",
      "指数関数",
      "対数",
      "対数関数",
      "三角比",
      "弧度法",
      "三角関数",
      "三角関数の基本公式",
      "三角関数のグラフ",
    ],
  },
  {
    key: "limits",
    name: "極限",
    track: 0,
    after: ["hs-remedial"],
    topics: [
      "数列の極限",
      "関数の極限",
      "無限大",
      "不定形",
      "基本的な極限計算",
      "微分につながる極限",
    ],
  },
  {
    key: "diff-1v",
    name: "一変数微分",
    track: 0,
    after: ["limits"],
    topics: [
      "微分係数",
      "導関数",
      "基本的な微分",
      "積の微分",
      "商の微分",
      "合成関数の微分",
      "三角関数の微分",
      "指数関数の微分",
      "対数関数の微分",
      "高階導関数",
      "接線",
      "増減",
      "極値",
      "最大値・最小値",
    ],
  },
  {
    key: "int-1v",
    name: "一変数積分",
    track: 0,
    after: ["diff-1v"],
    topics: [
      "原始関数",
      "不定積分",
      "定積分",
      "微積分の基本定理",
      "置換積分",
      "部分積分",
      "有理関数の積分",
      "三角関数を含む積分",
      "面積",
      "体積",
      "広義積分",
    ],
  },
  {
    key: "multivar",
    name: "多変数微積分",
    track: 0,
    after: ["int-1v"],
    topics: [
      "多変数関数",
      "偏微分",
      "高階偏導関数",
      "全微分",
      "合成関数の偏微分",
      "接平面",
      "勾配",
      "多変数関数の極値",
      "条件付き極値",
      "ラグランジュ未定乗数法",
      "二重積分",
      "三重積分",
      "積分順序の変更",
      "変数変換",
    ],
  },
  {
    key: "ode",
    name: "微分方程式",
    track: 0,
    after: ["multivar"],
    topics: [
      "微分方程式とは何か",
      "変数分離形",
      "一階線形微分方程式",
      "同次形",
      "二階線形微分方程式",
      "定数係数微分方程式",
      "初期値問題",
    ],
  },
  {
    key: "linalg",
    name: "線形代数",
    track: 1,
    after: ["hs-remedial"],
    topics: [
      "ベクトル",
      "ベクトルの演算",
      "内積",
      "行列",
      "行列の演算",
      "連立一次方程式",
      "掃き出し法",
      "階数",
      "行列式",
      "逆行列",
      "線形独立・線形従属",
      "ベクトル空間",
      "部分空間",
      "基底",
      "次元",
      "線形写像",
      "表現行列",
      "固有値",
      "固有ベクトル",
      "固有空間",
      "対角化",
      "直交化",
    ],
  },
];

export const SUBJECT_TEMPLATES: SubjectTemplate[] = [
  {
    slug: "math",
    name: "数学",
    evaluationType: "problem",
    color: "chart-1",
    categories: MATH_ROADMAP,
  },
  {
    slug: "physics",
    name: "物理",
    evaluationType: "problem",
    color: "chart-2",
    categories: [
      {
        key: "phys-math",
        name: "物理数学・単位",
        track: 0,
        after: [],
        topics: ["単位と次元", "ベクトル基礎", "微分・積分の物理的意味", "三角関数と振動"],
      },
      {
        key: "mechanics",
        name: "力学",
        track: 0,
        after: ["phys-math"],
        topics: [
          "運動の記述",
          "運動方程式",
          "仕事とエネルギー",
          "運動量と力積",
          "円運動",
          "単振動",
          "万有引力",
          "剛体の回転",
        ],
      },
      {
        key: "em",
        name: "電磁気",
        track: 0,
        after: ["mechanics"],
        topics: [
          "電場とクーロンの法則",
          "ガウスの法則",
          "電位",
          "コンデンサー",
          "電流と抵抗",
          "磁場",
          "電磁誘導",
          "交流回路",
        ],
      },
      {
        key: "thermo",
        name: "熱力学",
        track: 1,
        after: ["mechanics"],
        topics: ["温度と熱", "気体分子運動論", "熱力学第一法則", "熱機関とエントロピー"],
      },
      {
        key: "waves",
        name: "波動",
        track: 1,
        after: ["mechanics"],
        topics: ["波の性質", "定常波", "ドップラー効果", "音波"],
      },
      {
        key: "optics",
        name: "光",
        track: 1,
        after: ["waves"],
        topics: ["反射と屈折", "干渉", "回折"],
      },
      {
        key: "modern",
        name: "現代物理",
        track: 1,
        after: ["em"],
        topics: ["光電効果", "原子モデル", "原子核"],
      },
    ],
  },
  {
    slug: "english",
    name: "英語",
    evaluationType: "language",
    color: "chart-3",
    categories: [
      {
        key: "vocab",
        name: "英単語",
        track: 0,
        after: [],
        topics: ["基本単語", "頻出単語", "理工系専門語彙"],
      },
      {
        key: "grammar",
        name: "文法",
        track: 0,
        after: [],
        topics: ["時制", "関係詞", "仮定法", "分詞・動名詞・不定詞"],
      },
      {
        key: "parsing",
        name: "英文解釈",
        track: 0,
        after: ["grammar"],
        topics: ["SVOC把握", "長い修飾の処理", "構文把握"],
      },
      {
        key: "reading",
        name: "長文読解",
        track: 0,
        after: ["parsing"],
        topics: ["論説文", "理工系長文", "要約"],
      },
      {
        key: "uec-english",
        name: "電通大英語対策",
        track: 0,
        after: ["reading"],
        topics: ["過去問演習", "和訳", "英作文"],
      },
    ],
  },
  {
    slug: "toeic",
    name: "TOEIC",
    evaluationType: "language",
    color: "chart-4",
    categories: [
      { key: "vocab", name: "語彙", track: 0, after: [], topics: ["Vocabulary"] },
      {
        key: "listening",
        name: "リスニング",
        track: 0,
        after: [],
        topics: ["Part 1", "Part 2", "Part 3", "Part 4"],
      },
      {
        key: "reading",
        name: "リーディング",
        track: 0,
        after: [],
        topics: ["Part 5", "Part 6", "Part 7"],
      },
      { key: "mock", name: "模試", track: 0, after: [], topics: ["模試"] },
    ],
  },
  {
    slug: "cpp",
    name: "C/C++",
    evaluationType: "problem",
    color: "chart-5",
    categories: [
      {
        key: "basics",
        name: "基礎文法",
        track: 0,
        after: [],
        topics: ["変数・型", "条件分岐", "ループ", "配列", "関数", "string", "二重ループ"],
      },
      {
        key: "pointers",
        name: "参照とポインタ",
        track: 0,
        after: ["basics"],
        topics: ["参照", "ポインタ", "メモリ"],
      },
      {
        key: "modern",
        name: "STLとクラス",
        track: 0,
        after: ["basics"],
        topics: ["vector", "構造体", "class", "再帰", "STL"],
      },
    ],
  },
  {
    slug: "algo",
    name: "アルゴリズム",
    evaluationType: "problem",
    color: "chart-2",
    categories: [
      {
        key: "basics",
        name: "基礎",
        track: 0,
        after: [],
        topics: ["計算量", "線形探索", "二分探索", "ソート", "再帰"],
      },
      {
        key: "ds",
        name: "データ構造",
        track: 0,
        after: ["basics"],
        topics: ["stack", "queue", "linked list", "tree", "BST", "heap", "hash"],
      },
      {
        key: "graph-dp",
        name: "グラフ・動的計画法",
        track: 0,
        after: ["ds"],
        topics: ["graph", "BFS", "DFS", "動的計画法"],
      },
    ],
  },
  {
    slug: "cs",
    name: "CS基礎",
    evaluationType: "problem",
    color: "chart-3",
    categories: [
      {
        key: "numbers",
        name: "数の表現",
        track: 0,
        after: [],
        topics: ["2進数", "16進数"],
      },
      {
        key: "logic",
        name: "論理回路",
        track: 0,
        after: ["numbers"],
        topics: [
          "論理演算",
          "真理値表",
          "ブール代数",
          "論理式",
          "カルノー図",
          "組合せ回路",
          "加算器",
          "フリップフロップ",
          "順序回路",
        ],
      },
      {
        key: "info",
        name: "情報理論",
        track: 1,
        after: ["numbers"],
        topics: [
          "情報量",
          "エントロピー",
          "条件付きエントロピー",
          "相互情報量",
          "ハフマン符号",
          "通信路",
          "誤り訂正",
        ],
      },
    ],
  },
  {
    slug: "interview",
    name: "面接",
    evaluationType: "interview",
    color: "chart-4",
    categories: [
      {
        key: "story",
        name: "志望動機・自己分析",
        track: 0,
        after: [],
        topics: ["志望理由", "編入理由", "現大学で学んだこと", "電通大で学びたいこと", "将来像"],
      },
      {
        key: "practice",
        name: "対策",
        track: 0,
        after: ["story"],
        topics: ["専門基礎", "想定質問", "模擬面接"],
      },
    ],
  },
];

export const EXAM_SUBJECT_SLUGS = SUBJECT_TEMPLATES.map((t) => t.slug);

/**
 * Prerequisite edges `[subject, topic] → [[subject, topic], …]` (spec §12).
 * Resolved by name at seed time; edges whose endpoints were renamed or deleted
 * are skipped silently.
 */
export const TOPIC_DEPENDENCIES: { topic: [string, string]; dependsOn: [string, string][] }[] = [
  // math — 高校補修 → 極限 → 微分 → 積分 → 多変数 → 微分方程式
  { topic: ["math", "関数の極限"], dependsOn: [["math", "関数とは何か"]] },
  {
    topic: ["math", "不定形"],
    dependsOn: [
      ["math", "分数式"],
      ["math", "因数分解"],
    ],
  },
  { topic: ["math", "微分係数"], dependsOn: [["math", "微分につながる極限"]] },
  { topic: ["math", "導関数"], dependsOn: [["math", "微分係数"]] },
  { topic: ["math", "三角関数の微分"], dependsOn: [["math", "三角関数の基本公式"]] },
  { topic: ["math", "指数関数の微分"], dependsOn: [["math", "指数関数"]] },
  { topic: ["math", "対数関数の微分"], dependsOn: [["math", "対数関数"]] },
  { topic: ["math", "原始関数"], dependsOn: [["math", "基本的な微分"]] },
  {
    topic: ["math", "置換積分"],
    dependsOn: [
      ["math", "合成関数の微分"],
      ["math", "不定積分"],
    ],
  },
  {
    topic: ["math", "部分積分"],
    dependsOn: [
      ["math", "積の微分"],
      ["math", "不定積分"],
    ],
  },
  {
    topic: ["math", "偏微分"],
    dependsOn: [
      ["math", "導関数"],
      ["math", "多変数関数"],
    ],
  },
  { topic: ["math", "二重積分"], dependsOn: [["math", "定積分"]] },
  { topic: ["math", "変数分離形"], dependsOn: [["math", "不定積分"]] },
  { topic: ["math", "行列式"], dependsOn: [["math", "行列の演算"]] },
  { topic: ["math", "逆行列"], dependsOn: [["math", "行列式"]] },
  { topic: ["math", "固有値"], dependsOn: [["math", "行列式"]] },
  { topic: ["math", "対角化"], dependsOn: [["math", "固有ベクトル"]] },
  // physics
  { topic: ["physics", "運動方程式"], dependsOn: [["math", "導関数"]] },
  { topic: ["physics", "単振動"], dependsOn: [["physics", "三角関数と振動"]] },
  { topic: ["physics", "電場とクーロンの法則"], dependsOn: [["physics", "ベクトル基礎"]] },
  { topic: ["physics", "ガウスの法則"], dependsOn: [["math", "二重積分"]] },
  { topic: ["physics", "電磁誘導"], dependsOn: [["physics", "磁場"]] },
  // programming / algorithms
  {
    topic: ["cpp", "ポインタ"],
    dependsOn: [
      ["cpp", "配列"],
      ["cpp", "参照"],
    ],
  },
  { topic: ["cpp", "再帰"], dependsOn: [["cpp", "関数"]] },
  { topic: ["algo", "二分探索"], dependsOn: [["algo", "計算量"]] },
  { topic: ["algo", "BST"], dependsOn: [["algo", "tree"]] },
  {
    topic: ["algo", "BFS"],
    dependsOn: [
      ["algo", "queue"],
      ["algo", "graph"],
    ],
  },
  {
    topic: ["algo", "DFS"],
    dependsOn: [
      ["algo", "stack"],
      ["algo", "graph"],
    ],
  },
  {
    topic: ["algo", "動的計画法"],
    dependsOn: [
      ["algo", "再帰"],
      ["algo", "計算量"],
    ],
  },
  // cs
  { topic: ["cs", "カルノー図"], dependsOn: [["cs", "ブール代数"]] },
  { topic: ["cs", "加算器"], dependsOn: [["cs", "組合せ回路"]] },
  { topic: ["cs", "順序回路"], dependsOn: [["cs", "フリップフロップ"]] },
  { topic: ["cs", "条件付きエントロピー"], dependsOn: [["cs", "エントロピー"]] },
  { topic: ["cs", "相互情報量"], dependsOn: [["cs", "条件付きエントロピー"]] },
];

/** Topic names offered as "already studied" on the setup screen. */
export const SUGGESTED_STUDIED_TOPICS = ["展開", "因数分解", "方程式", "分数式"];

export const MATH_SUBJECT_SLUG = "math";

/**
 * Long-term time allocation (spec §18) — subject slug → percent.
 * 数学60 / 英語15 (英語10+TOEIC5) / C++・アルゴ10 / 物理10 / その他5.
 */
export const DEFAULT_ALLOCATION_BY_SLUG: Record<string, number> = {
  math: 60,
  english: 10,
  toeic: 5,
  cpp: 5,
  algo: 5,
  physics: 10,
  cs: 3,
  interview: 2,
};

interface UniversityTemplate {
  key: string;
  name: string;
  faculty: string;
  departmentOrCourse: string;
  priority: UniversityPriority;
  notes: string;
  requirements: { slug: string; required: boolean; importance: number; weight: number }[];
}

/**
 * Initial universities (spec §3/§4). Requirement values follow the brief; the
 * rest are sensible placeholders flagged "要確認" — every value is editable.
 */
export const UNIVERSITY_TEMPLATES: UniversityTemplate[] = [
  {
    key: "uec",
    name: "電気通信大学",
    faculty: "情報理工学域",
    departmentOrCourse: "Ⅰ類（情報系）",
    priority: "first_choice",
    notes: "第一志望",
    requirements: [
      { slug: "math", required: true, importance: 5, weight: 40 },
      { slug: "physics", required: true, importance: 5, weight: 30 },
      { slug: "english", required: true, importance: 4, weight: 25 },
      { slug: "interview", required: true, importance: 3, weight: 5 },
    ],
  },
  {
    key: "tsukuba",
    name: "筑波大学",
    faculty: "情報学群",
    departmentOrCourse: "情報科学類",
    priority: "strong_candidate",
    notes: "募集要項で最新の科目を要確認",
    requirements: [
      { slug: "math", required: true, importance: 5, weight: 45 },
      { slug: "cpp", required: true, importance: 4, weight: 25 },
      { slug: "toeic", required: true, importance: 4, weight: 30 },
    ],
  },
  {
    key: "nagoya",
    name: "名古屋大学",
    faculty: "情報学部",
    departmentOrCourse: "コンピュータ科学科",
    priority: "strong_candidate",
    notes: "募集要項で最新の科目を要確認",
    requirements: [
      { slug: "math", required: true, importance: 5, weight: 30 },
      { slug: "cs", required: true, importance: 5, weight: 25 },
      { slug: "algo", required: true, importance: 5, weight: 20 },
      { slug: "toeic", required: true, importance: 4, weight: 15 },
      { slug: "interview", required: true, importance: 3, weight: 10 },
    ],
  },
  {
    key: "hiroshima",
    name: "広島大学",
    faculty: "情報科学部",
    departmentOrCourse: "情報科学科",
    priority: "candidate",
    notes: "C言語 または 確率統計 を選択（要確認）",
    requirements: [
      { slug: "math", required: true, importance: 5, weight: 45 },
      { slug: "cpp", required: false, importance: 4, weight: 20 },
      { slug: "toeic", required: true, importance: 4, weight: 25 },
      { slug: "interview", required: true, importance: 3, weight: 10 },
    ],
  },
  ...(
    [
      ["kyutech", "九州工業大学", "情報工学部", "情報工学科"],
      ["omu", "大阪公立大学", "工学部", "情報工学科"],
      ["shizuoka", "静岡大学", "情報学部", "情報科学科"],
    ] as const
  ).map(([key, name, faculty, dept]): UniversityTemplate => ({
    key,
    name,
    faculty,
    departmentOrCourse: dept,
    priority: "candidate",
    notes: "科目・配点は仮設定。募集要項で要確認",
    requirements: [
      { slug: "math", required: true, importance: 5, weight: 55 },
      { slug: "toeic", required: true, importance: 4, weight: 30 },
      { slug: "interview", required: true, importance: 3, weight: 15 },
    ],
  })),
  ...(
    [
      ["tus", "東京理科大学", "工学部", "情報工学科"],
      ["kansai", "関西大学", "システム理工学部", "電気電子情報工学科"],
      ["ritsumei", "立命館大学", "情報理工学部", "情報理工学科"],
    ] as const
  ).map(([key, name, faculty, dept]): UniversityTemplate => ({
    key,
    name,
    faculty,
    departmentOrCourse: dept,
    priority: "backup",
    notes: "科目・配点は仮設定。募集要項で要確認",
    requirements: [
      { slug: "math", required: true, importance: 5, weight: 55 },
      { slug: "english", required: true, importance: 4, weight: 30 },
      { slug: "interview", required: true, importance: 3, weight: 15 },
    ],
  })),
];

export interface SeedResult {
  subject: Subject;
  categories: Category[];
  topics: Topic[];
}

export const subjectIdForSlug = (slug: string) => `subj_${slug}`;

/** Build deterministic rows for one subject template. */
export function buildSubjectSeed(
  template: SubjectTemplate,
  order: number,
  now: number = Date.now(),
): SeedResult {
  const subjectId = subjectIdForSlug(template.slug);
  const subject: Subject = {
    id: subjectId,
    slug: template.slug,
    name: template.name,
    color: template.color,
    evaluationType: template.evaluationType,
    order,
    createdAt: now,
    updatedAt: now,
  };

  const keyToId = new Map<string, string>();
  template.categories.forEach((c) => keyToId.set(c.key, `cat_${template.slug}_${c.key}`));

  const categories: Category[] = template.categories.map((c, index) => ({
    id: keyToId.get(c.key) as string,
    subjectId,
    name: c.name,
    order: index,
    track: c.track,
    prerequisiteIds: c.after.map((k) => keyToId.get(k)).filter((v): v is string => Boolean(v)),
    createdAt: now,
    updatedAt: now,
  }));

  const topics: Topic[] = [];
  template.categories.forEach((c) => {
    const categoryId = keyToId.get(c.key) as string;
    c.topics.forEach((name, i) => {
      topics.push({
        id: `topic_${template.slug}_${c.key}_${i}`,
        categoryId,
        name,
        status: 0,
        weight: 1,
        order: i,
        createdAt: now,
        updatedAt: now,
      });
    });
  });

  return { subject, categories, topics };
}

/** Phase 1 entry point, kept for existing callers/tests. */
export function buildMathSeed(now: number = Date.now()): SeedResult {
  const math = SUBJECT_TEMPLATES.find((t) => t.slug === MATH_SUBJECT_SLUG) as SubjectTemplate;
  return buildSubjectSeed(math, 0, now);
}

export function buildUniversitySeed(
  subjectIdBySlug: Map<string, string>,
  examDateForFirstChoice: string | undefined,
  now: number = Date.now(),
): { universities: University[]; requirements: UniversityRequirement[] } {
  const universities: University[] = [];
  const requirements: UniversityRequirement[] = [];
  UNIVERSITY_TEMPLATES.forEach((t, order) => {
    const id = `univ_${t.key}`;
    universities.push({
      id,
      name: t.name,
      faculty: t.faculty,
      departmentOrCourse: t.departmentOrCourse,
      priority: t.priority,
      examDate: t.priority === "first_choice" ? examDateForFirstChoice : undefined,
      notes: t.notes,
      order,
      createdAt: now,
      updatedAt: now,
    });
    for (const r of t.requirements) {
      const subjectId = subjectIdBySlug.get(r.slug);
      if (!subjectId) continue;
      requirements.push({
        id: `req_${t.key}_${r.slug}`,
        universityId: id,
        subjectId,
        required: r.required,
        importance: r.importance,
        weight: r.weight,
      });
    }
  });
  return { universities, requirements };
}

/**
 * Resolve TOPIC_DEPENDENCIES against the actual topic rows.
 * Returns topicId → dependsOn ids (only for topics that have edges).
 */
export function resolveDependencies(
  topics: Pick<Topic, "id" | "name" | "categoryId">[],
  categorySubject: Map<string, string>,
  slugBySubjectId: Map<string, string>,
): Map<string, string[]> {
  const byKey = new Map<string, string>();
  for (const t of topics) {
    const subjectId = categorySubject.get(t.categoryId);
    const slug = subjectId ? slugBySubjectId.get(subjectId) : undefined;
    if (!slug) continue;
    const key = `${slug}::${t.name}`;
    if (!byKey.has(key)) byKey.set(key, t.id);
  }
  const out = new Map<string, string[]>();
  for (const edge of TOPIC_DEPENDENCIES) {
    const from = byKey.get(`${edge.topic[0]}::${edge.topic[1]}`);
    if (!from) continue;
    const deps = edge.dependsOn
      .map(([s, n]) => byKey.get(`${s}::${n}`))
      .filter((v): v is string => Boolean(v) && v !== from);
    if (deps.length > 0) out.set(from, deps);
  }
  return out;
}
