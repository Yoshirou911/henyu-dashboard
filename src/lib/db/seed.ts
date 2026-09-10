import type { Category, Subject, Topic } from "@/lib/types";

/**
 * Initial 数学 roadmap (spec §7). This is *seed* data only — once written to
 * IndexedDB the user owns it and can add / rename / reorder / delete freely.
 */

interface RoadmapCategory {
  key: string;
  name: string;
  /** 0 = main progression line, 1 = parallel route */
  track: number;
  /** category keys that come before this one */
  after: string[];
  topics: string[];
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

/** Topic names offered as "already studied" on the setup screen (spec §17). */
export const SUGGESTED_STUDIED_TOPICS = ["展開", "因数分解", "方程式", "分数式"];

export const MATH_SUBJECT_SLUG = "math";

export interface SeedResult {
  subject: Subject;
  categories: Category[];
  topics: Topic[];
}

/** Build deterministic seed rows. Ids are stable so re-seeding is predictable. */
export function buildMathSeed(now: number = Date.now()): SeedResult {
  const subjectId = `subj_${MATH_SUBJECT_SLUG}`;
  const subject: Subject = {
    id: subjectId,
    slug: MATH_SUBJECT_SLUG,
    name: "数学",
    color: "chart-1",
    order: 0,
    createdAt: now,
    updatedAt: now,
  };

  const keyToId = new Map<string, string>();
  MATH_ROADMAP.forEach((c) => keyToId.set(c.key, `cat_${MATH_SUBJECT_SLUG}_${c.key}`));

  const categories: Category[] = MATH_ROADMAP.map((c, index) => ({
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
  MATH_ROADMAP.forEach((c) => {
    const categoryId = keyToId.get(c.key) as string;
    c.topics.forEach((name, i) => {
      topics.push({
        id: `topic_${MATH_SUBJECT_SLUG}_${c.key}_${i}`,
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
