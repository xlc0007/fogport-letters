import { useState, type FormEvent } from "react";
import type { ActiveMode, RequestedMode } from "@fogport/shared";
import { displayError } from "../lib/api";
import { Icon } from "./Icons";
import { ModeBadge } from "./ModeBadge";

interface LandingProps {
  mode: ActiveMode;
  requestedMode: RequestedMode;
  qwenConfigured: boolean;
  onCreate: (playerName?: string) => Promise<void>;
  onBack: () => void;
}

export function Landing({
  mode,
  requestedMode,
  qwenConfigured,
  onCreate,
  onBack,
}: LandingProps) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const qwenBlocked = requestedMode === "qwen" && !qwenConfigured;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || qwenBlocked) return;

    const normalized = name.trim();
    if (normalized.length > 16) {
      setError("代号最多 16 个字符。");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await onCreate(normalized || undefined);
    } catch (caught) {
      setError(displayError(caught));
      setBusy(false);
    }
  }

  return (
    <div className="landing">
      <header className="landing-topbar">
        <div className="landing-topbar-left">
          <button type="button" className="landing-back" onClick={onBack} disabled={busy}>
            <Icon name="back" size={14} />
            主页
          </button>
          <div className="brand brand-small">
            <span className="seal seal-small" aria-hidden="true">
              雾
            </span>
            <div>
              <p className="brand-name">雾港来信</p>
              <p className="brand-sub">FOGPORT LETTERS · NIGHT POST</p>
            </div>
          </div>
        </div>
        <ModeBadge mode={mode} />
      </header>

      <main className="landing-main">
        <section className="landing-copy">
          <p className="eyebrow">FOGPORT · NIGHT SHIFT · 03:17</p>
          <h1 className="landing-title">
            雾港<span className="title-accent">来信</span>
          </h1>
          <p className="landing-english">LETTERS FROM THE FOG</p>

          <p className="landing-intro">
            今夜，你替整座城送最后一班信。
            <br />
            其中一封没有收件人，没有落款，却端端正正写着你的名字。
          </p>
          <p className="landing-intro landing-intro-soft">
            黎明 07:17，旧钟最后一响后，雾港会彻底忘记你。
            <br />
            这封无名信，是你唯一的线索。
          </p>

          <div className="landing-mainline" aria-label="主线任务">
            <p className="landing-mainline-label">MAIN THREAD · 主线</p>
            <p className="landing-mainline-title">黎明前阻止雾港忘记你</p>
            <div className="landing-mainline-row">
              <span>当前目标</span>
              <p>查明无名信的寄件人，找到阻止遗忘的方法</p>
            </div>
            <div className="landing-mainline-row">
              <span>进度</span>
              <p>关键线索 0 / 3</p>
            </div>
          </div>

          <ul className="landing-features" aria-label="游戏特色">
            <li>
              <span>01</span>
              <div>
                <strong>三条关键线索</strong>
                <p>钟楼的 03:17、白鹭号与林雾、灯塔日志里的旧钟回声。</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>黎明会真的到来</strong>
                <p>时间由服务端推进，每回合约 10–25 分钟，07:17 结束。</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>这一夜会如何结束</strong>
                <p>你找回的线索、愿意信任的人，以及最后的选择，会决定雾港留下什么。</p>
              </div>
            </li>
          </ul>
        </section>

        <section className="landing-entry" aria-label="开始游戏">
          <div className="letter-art" aria-hidden="true">
            <div className="letter-sheet">
              <div className="letter-stamp">
                <span>雾港</span>
                <span>03:17</span>
              </div>
              <p className="letter-to">致</p>
              <p className="letter-address">尚未抵达的你</p>
              <p className="letter-note">黎明以前，请务必拆阅。</p>
              <div className="letter-rule" />
              <p className="letter-postmark">NO ADDRESSEE · NO RETURN</p>
              <span className="wax-seal">雾</span>
            </div>
          </div>

          <form className="entry-card" onSubmit={handleSubmit}>
            <p className="eyebrow">BEGIN THE NIGHT</p>
            <h2>领取今晚的邮包</h2>
            <label className="field-label" htmlFor="player-name">
              值班邮差代号
              <span>可选</span>
            </label>
            <input
              id="player-name"
              className="text-input"
              value={name}
              maxLength={16}
              placeholder="林见雾"
              autoComplete="off"
              spellCheck={false}
              disabled={busy || qwenBlocked}
              onChange={(event) => setName(event.target.value)}
            />
            <p className="field-hint">最多 16 个字符；留空则使用「林见雾」。</p>

            {qwenBlocked ? (
              <div className="notice notice-danger" role="alert">
                <strong>Qwen 强制模式尚未配置。</strong>
                <p>
                  请在后端 <code>.env</code> 中设置 QWEN_API_KEY、QWEN_BASE_URL 与
                  QWEN_MODEL，然后重启服务；也可以把 GAME_MODE 改为 auto 使用本地演示。
                </p>
              </div>
            ) : (
              <div className="notice">
                <p>
                  {mode === "qwen"
                    ? "当前为 Qwen 叙事模式。剧情由模型实时生成，重要状态变化会由服务端确认。"
                    : "当前为本地演示模式：不调用外部 API，剧情由内置叙事规则生成，无 Key 也能完整游玩。"}
                </p>
              </div>
            )}

            {error && (
              <div className="notice notice-danger" role="alert">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="primary-button entry-submit"
              disabled={busy || qwenBlocked}
            >
              {busy ? (
                <>
                  <span className="spinner" aria-hidden="true" />
                  正在点亮值班灯
                </>
              ) : (
                <>
                  开始冒险
                  <Icon name="arrow" size={17} />
                </>
              )}
            </button>
            <p className="entry-footnote">建议在安静处阅读 · 一局约 10–20 分钟</p>
          </form>
        </section>
      </main>

      <footer className="landing-footer">
        <span>雾港中央邮局 · 夜班登记处</span>
        <span>虚构故事 · 你的选择会留下痕迹</span>
      </footer>
    </div>
  );
}
