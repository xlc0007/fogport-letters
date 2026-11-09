import type { EndingView, GameStateView } from "@fogport/shared";
import { NPC_PORTRAIT_IDS, PORTRAITS, type PortraitId } from "../portraits";

interface EndingPanelProps {
  state: GameStateView;
  ending: EndingView;
}

export function EndingPanel({ state, ending }: EndingPanelProps) {
  const trusted = state.relationships.filter((person) => person.value >= 65);
  const foundKeyClues = state.quest.keyClues.filter((clue) => clue.found).length;
  const rememberedPortraitId =
    ending.kind === "remembered" && ending.npcId
      ? NPC_PORTRAIT_IDS[ending.npcId]
      : undefined;

  const portraitRef: { id: PortraitId; caption: string } =
    ending.kind === "name_return"
      ? { id: "lin_wu", caption: "林雾 · 记忆中的母亲" }
      : rememberedPortraitId
        ? {
            id: rememberedPortraitId,
            caption: `${PORTRAITS[rememberedPortraitId].name} · 记得你的人`,
          }
        : { id: "lin_jianwu", caption: `${state.playerName} · 夜班邮差` };
  const portrait = PORTRAITS[portraitRef.id];

  return (
    <article
      className={`ending-panel ${ending.isTrueEnding ? "is-true-ending" : ""}`.trim()}
      aria-labelledby="ending-title"
    >
      <div className="ending-heading">
        <figure className="ending-portrait">
          <img src={portrait.src} alt={`${portraitRef.caption}立绘`} loading="eager" />
          <figcaption>{portraitRef.caption}</figcaption>
        </figure>
        <div className="ending-heading-copy">
          <p className="eyebrow">
            ENDING · {state.clock.label} · 第 {state.turnCount} 回合
          </p>
          {ending.isTrueEnding && (
            <span className="ending-true-badge">TRUE ENDING · 真结局</span>
          )}
          <h2 id="ending-title">{ending.title}</h2>
        </div>
      </div>
      <div className="ending-body">
        {ending.paragraphs.map((paragraph) => (
          <p key={paragraph.slice(0, 16)}>{paragraph}</p>
        ))}
      </div>
      <div className="ending-causes">
        <h3>导致这一结局的选择</h3>
        <ul>
          {ending.causedBy.map((cause) => (
            <li key={cause}>{cause}</li>
          ))}
        </ul>
      </div>
      <div className="ending-stats" aria-label="这一夜的记录">
        <span>
          关键线索 {foundKeyClues} / {state.quest.keyClues.length}
        </span>
        <span>{state.unresolvedClues.length} 条线索</span>
        <span>{trusted.length} 位信任你的人</span>
        <span>{state.turnCount} 个回合</span>
      </div>

    </article>
  );
}
