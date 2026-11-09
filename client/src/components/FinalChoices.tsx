import type { EndingChoiceView } from "@fogport/shared";
import { Icon } from "./Icons";

interface FinalChoicesProps {
  choices: EndingChoiceView[];
  remainingMinutes: number;
  busy: boolean;
  estimateMinutes: (action: string) => string;
  onChoose: (action: string) => void;
}

export function FinalChoices({
  choices,
  remainingMinutes,
  busy,
  estimateMinutes,
  onChoose,
}: FinalChoicesProps) {
  const available = choices.filter((choice) => choice.available);
  const urgent = remainingMinutes <= 60;
  if (available.length === 0 && !urgent) return null;

  return (
    <section
      className={`final-choices ${urgent ? "is-urgent" : ""}`.trim()}
      aria-label="最后的选择"
    >
      <div className="final-head">
        <div>
          <p className="final-eyebrow">FINAL CHOICE · 最后的选择</p>
          <h3>
            {available.length > 0
              ? "你已经可以决定这一夜的结局"
              : "天光正在接近"}
          </h3>
        </div>
        <span className="final-time">
          {remainingMinutes <= 0 ? "黎明已至" : `距黎明 ${remainingMinutes} 分钟`}
        </span>
      </div>

      {urgent && (
        <p className="final-warning">
          {available.length > 0
            ? "时间正在逼近 07:17。做出选择后，这一夜会立即收束。"
            : "还没有满足条件的最后行动。继续调查，或让时间走到尽头；提示不会消耗时间。"}
        </p>
      )}

      {available.length > 0 && (
        <ul className="final-list">
          {available.map((choice) => (
            <li className="final-choice is-available" key={choice.id}>
              <div className="final-choice-head">
                <strong>{choice.title}</strong>
                <span>可执行</span>
              </div>
              <p className="final-choice-desc">{choice.description}</p>
              <p className="final-choice-req">{choice.requirement}</p>
              <button
                type="button"
                className="final-choice-button"
                disabled={busy}
                onClick={() => onChoose(choice.action)}
              >
                <span>{choice.action}</span>
                <span className="final-cost">
                  {estimateMinutes(choice.action)}
                  <Icon name="arrow" size={13} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="final-foot">
        这一夜如何收束，只在你做出选择后揭晓。
      </p>
    </section>
  );
}
