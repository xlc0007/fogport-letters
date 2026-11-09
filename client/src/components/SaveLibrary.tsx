import type { SavedGame } from "../lib/saves";
import { formatSavedAt } from "../lib/saves";
import { Overlay } from "./Overlay";

interface SaveLibraryProps {
  saves: SavedGame[];
  currentId: string | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onLoad: (id: string) => void;
}

export function SaveLibrary({
  saves,
  currentId,
  busy,
  error,
  onClose,
  onLoad,
}: SaveLibraryProps) {
  return (
    <Overlay eyebrow="ARCHIVE · 存档" title="雾港的夜" onClose={onClose}>
      <p className="save-library-note">
        每一回合都会自动存档。这里保存的是这个浏览器打开过的夜。
      </p>
      {error && (
        <p className="save-library-error" role="alert">
          {error}
        </p>
      )}
      {saves.length === 0 ? (
        <div className="save-library-empty">
          <p>还没有存档。</p>
          <p>开始新的一夜后，每一回合都会自动留下记录。</p>
        </div>
      ) : (
        <div className="save-list">
          {saves.map((save) => {
            const current = save.id === currentId;
            return (
              <article className={`save-card ${current ? "is-current" : ""}`.trim()} key={save.id}>
                <div className="save-card-head">
                  <div>
                    <h3>{save.playerName}</h3>
                    <p>
                      {save.turnCount === 0 ? "序章" : `第 ${save.turnCount} 回合`} ·{" "}
                      {save.clockLabel} · {save.locationName}
                    </p>
                  </div>
                  <span className="save-card-status">
                    {save.status === "ended"
                      ? `已结束${save.endingTitle ? ` · ${save.endingTitle}` : ""}`
                      : "进行中"}
                  </span>
                </div>
                <div className="save-card-foot">
                  <span>{formatSavedAt(save.savedAt)} 存档</span>
                  <div>
                    {current && <em>当前</em>}
                    <button
                      type="button"
                      className="save-load-button"
                      onClick={() => onLoad(save.id)}
                      disabled={busy}
                    >
                      {busy ? "正在读取…" : "继续这一夜"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </Overlay>
  );
}
