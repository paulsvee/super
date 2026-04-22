import { NextResponse } from "next/server";
import { getAllMemos } from "@/lib/memo-db";
import { getAllPanels, getTodoItems } from "@/lib/todo-db";

type TraitKey = "creative" | "analytical" | "spiritual" | "practical";

type PersonalityTrait = {
  label: string;
  emoji: string;
  desc: string;
  score: number;
};

const TRAIT_META: Record<TraitKey, Omit<PersonalityTrait, "score">> = {
  creative: {
    label: "창의형",
    emoji: "✍️",
    desc: "표현·기획·만들기에 강점",
  },
  analytical: {
    label: "분석형",
    emoji: "🔬",
    desc: "기술·구조·논리 정리에 강점",
  },
  spiritual: {
    label: "탐구형",
    emoji: "📘",
    desc: "성경·질문·의미 탐색에 강점",
  },
  practical: {
    label: "실용형",
    emoji: "🧰",
    desc: "실행·정리·생활 관리에 강점",
  },
};

const KEYWORDS: Record<TraitKey, RegExp[]> = {
  creative: [
    /글|문장|카피|브랜딩|디자인|콘텐츠|랜딩|표현|번역|이름|아이디어|기획|만들기|이미지|카드|레이아웃/i,
    /landing|brand|design|copy|content|memo|journal/i,
  ],
  analytical: [
    /개발|코드|버그|구현|기능|설계|구조|분석|api|db|sql|react|next|typescript|tsc|서버|로직|시스템/i,
    /debug|build|deploy|refactor|schema|database|query/i,
  ],
  spiritual: [
    /성경|말씀|묵상|기도|교회|신앙|복음|예배|주님|은혜|qt|성찰|질문|철학|의미|책|독서/i,
    /bible|faith|spiritual|devotion/i,
  ],
  practical: [
    /정리|체크|관리|준비|예약|제출|연락|비용|돈|가계부|정산|병원|일정|계획|업데이트|할 일|투두|여행|구매|초대/i,
    /todo|cash|budget|plan|check|task|schedule/i,
  ],
};

function scoreText(text: string, type: "memo" | "todo" | "title") {
  const scores: Record<TraitKey, number> = {
    creative: type === "memo" ? 1.1 : type === "title" ? 0.8 : 0.25,
    analytical: type === "todo" ? 0.45 : type === "title" ? 0.55 : 0.2,
    spiritual: type === "memo" ? 0.35 : 0.1,
    practical: type === "todo" ? 0.95 : type === "title" ? 0.45 : 0.15,
  };

  for (const trait of Object.keys(KEYWORDS) as TraitKey[]) {
    for (const pattern of KEYWORDS[trait]) {
      const matches = text.match(pattern);
      if (matches) scores[trait] += matches.length * (type === "title" ? 1.5 : 1.2);
    }
  }

  return scores;
}

function mergeScores(target: Record<TraitKey, number>, incoming: Record<TraitKey, number>) {
  for (const key of Object.keys(target) as TraitKey[]) {
    target[key] += incoming[key];
  }
}

function interpretPersonality(tag: string) {
  const interpretMap: Record<string, { mbti: string; summary: string }> = {
    "창의형+탐구형": {
      mbti: "INFJ형",
      summary: "메모 속 질문과 성찰을 오래 붙들고, 그것을 표현 가능한 문장으로 바꾸는 편입니다.",
    },
    "창의형+분석형": {
      mbti: "INTP형",
      summary: "아이디어를 구조화해서 결과물로 만드는 타입. 기획과 기술 사이를 자연스럽게 오갑니다.",
    },
    "창의형+실용형": {
      mbti: "ENFP형",
      summary: "생각을 빠르게 행동으로 옮기는 추진형. 메모와 할 일이 서로 잘 연결되는 편입니다.",
    },
    "탐구형+창의형": {
      mbti: "INFJ형",
      summary: "의미를 깊이 파고든 뒤 자기 언어로 다시 정리하는 타입. 기록의 밀도가 높은 편입니다.",
    },
    "탐구형+분석형": {
      mbti: "INTJ형",
      summary: "질문을 오래 붙들고 체계로 정리하는 편. 성경 공부나 개념 정리에 강한 흐름이 보입니다.",
    },
    "탐구형+실용형": {
      mbti: "INFP형",
      summary: "내면의 의미와 실제 적용을 함께 챙기는 편. 묵상과 삶을 연결하려는 성향이 강합니다.",
    },
    "분석형+창의형": {
      mbti: "ENTP형",
      summary: "구조를 만들면서도 새로운 시도를 즐기는 타입. 웹앱이나 시스템 구상을 자주 밀어붙입니다.",
    },
    "분석형+탐구형": {
      mbti: "INTJ형",
      summary: "논리와 깊이를 함께 챙기는 구조형. 문제를 해부하고 자기만의 프레임으로 재정리합니다.",
    },
    "분석형+실용형": {
      mbti: "ISTJ형",
      summary: "정확하게 정리하고 끝내는 실무형. 메모보다 실행 리스트에서 안정감이 드러나는 편입니다.",
    },
    "실용형+창의형": {
      mbti: "ESTJ형",
      summary: "좋은 아이디어를 실제 일정과 작업으로 연결하는 타입. 결과물 중심의 추진력이 강합니다.",
    },
    "실용형+탐구형": {
      mbti: "ISFJ형",
      summary: "의미를 놓치지 않으면서도 삶에 바로 적용하려는 편. 공부와 생활이 잘 이어집니다.",
    },
    "실용형+분석형": {
      mbti: "ISTJ형",
      summary: "해야 할 일을 빠르게 정리하고 구조화하는 타입. 반복 관리와 점검 루틴에 강합니다.",
    },
  };

  return (
    interpretMap[tag] ?? {
      mbti: "",
      summary: "한쪽으로 치우치기보다 여러 흐름을 고르게 쓰는 기록형입니다.",
    }
  );
}

export async function GET() {
  const memos = getAllMemos();
  const panels = getAllPanels();
  const todoItems = panels.flatMap((panel) =>
    getTodoItems(panel.id).map((item) => ({ ...item, panelTitle: panel.title }))
  );

  const totalEntries = memos.length + todoItems.length;
  const totals: Record<TraitKey, number> = {
    creative: 0,
    analytical: 0,
    spiritual: 0,
    practical: 0,
  };

  for (const memo of memos) {
    mergeScores(totals, scoreText(`${memo.text} ${memo.note ?? ""}`, "memo"));
  }

  for (const panel of panels) {
    mergeScores(totals, scoreText(panel.title, "title"));
  }

  for (const item of todoItems) {
    mergeScores(totals, scoreText(`${item.panelTitle} ${item.text}`, "todo"));
  }

  const traits = (Object.keys(TRAIT_META) as TraitKey[])
    .map((key) => ({
      ...TRAIT_META[key],
      score: Math.round(totals[key]),
    }))
    .filter((trait) => trait.score > 0)
    .sort((a, b) => b.score - a.score);

  const top2 = traits.slice(0, 2);
  const personalityTag =
    top2.length >= 2 ? `${top2[0].label} + ${top2[1].label}` : top2[0]?.label ?? "";
  const interpreted = interpretPersonality(top2.map((trait) => trait.label).join("+"));

  return NextResponse.json({
    personalityData: {
      traits,
      personalityTag,
      totalQ: totalEntries,
      mbti: interpreted.mbti,
      summary: interpreted.summary,
    },
  });
}
