import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { GameStateView, RelationshipView } from "@fogport/shared";
import { NPC_PORTRAIT_IDS, PORTRAITS } from "../portraits";
import { GameIcon } from "./GameIcon";
import waterTexture from "../assets/kenney-map/water.png";
import landTexture from "../assets/kenney-map/land.png";
import castleSprite from "../assets/kenney-map/castle.png";
import towerSprite from "../assets/kenney-map/tower.png";
import treeSprite from "../assets/kenney-map/tree.png";
import archSprite from "../assets/kenney-map/arch.png";

interface FogportMapProps {
  state: GameStateView;
}

interface MapLocation {
  id: string;
  name: string;
  x: number;
  y: number;
  sprite: string;
  clock?: boolean;
  lighthouse?: boolean;
  exploreFlag?: string;
  subName?: string;
}

const LOCATIONS: MapLocation[] = [
  {
    id: "post_office",
    name: "中央邮局",
    x: 120,
    y: 140,
    sprite: castleSprite,
  },
  {
    id: "clock_square",
    name: "钟楼广场",
    x: 305,
    y: 195,
    sprite: towerSprite,
    clock: true,
    exploreFlag: "clue_stopped_clock",
  },
  {
    id: "rose_alley",
    name: "蔷薇巷",
    x: 462,
    y: 130,
    sprite: treeSprite,
    exploreFlag: "clue_old_photo",
    subName: "雾灯书店",
  },
  {
    id: "dock",
    name: "旧码头",
    x: 218,
    y: 340,
    sprite: archSprite,
    exploreFlag: "clue_ship_plaque",
  },
  {
    id: "lighthouse",
    name: "北岸灯塔",
    x: 525,
    y: 315,
    sprite: towerSprite,
    lighthouse: true,
    exploreFlag: "clue_lighthouse_log",
  },
];

const LAND_PATH =
  "M55 150C70 80 160 55 245 75C310 92 365 62 430 82C495 102 545 145 535 195C525 235 550 270 515 300C480 330 420 320 375 345C325 375 250 390 195 365C135 337 80 360 55 300C30 245 35 195 55 150Z";

const LIGHTHOUSE_ISLAND_PATH =
  "M470 300C485 270 550 260 580 285C610 310 595 350 555 360C510 370 465 340 470 300Z";

function isExplored(state: GameStateView, location: MapLocation): boolean {
  if (location.id === state.location.id) return true;
  if (location.id === "post_office") return true;
  if (!location.exploreFlag) return false;
  return state.flags.some((flag) => flag.id === location.exploreFlag);
}

export function FogportMap({ state }: FogportMapProps) {
  const [activeNpcId, setActiveNpcId] = useState<string | null>(null);
  const [cardPosition, setCardPosition] = useState<{ left: number; top: number } | null>(
    null,
  );
  const [pinned, setPinned] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const activePerson =
    state.relationships.find((person) => person.id === activeNpcId) ?? null;

  function cancelScheduledClose() {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  function closeCard() {
    cancelScheduledClose();
    setActiveNpcId(null);
    setCardPosition(null);
    setPinned(false);
  }

  function openCard(person: RelationshipView, element: HTMLElement) {
    cancelScheduledClose();
    const rect = element.getBoundingClientRect();
    const width = Math.min(236, window.innerWidth - 20);
    const estimatedHeight = 220;
    const clamp = (value: number, min: number, max: number) =>
      Math.min(Math.max(value, min), max);

    if (window.innerWidth >= 900) {
      const rightLeft = rect.right + 14;
      const leftLeft = rect.left - width - 14;
      const left =
        rightLeft + width <= window.innerWidth - 12
          ? rightLeft
          : Math.max(leftLeft, 12);
      const top = clamp(
        rect.top + rect.height / 2 - estimatedHeight / 2,
        12,
        window.innerHeight - estimatedHeight - 12,
      );
      setActiveNpcId(person.id);
      setCardPosition({ left, top });
      return;
    }

    const belowTop = rect.bottom + 12;
    const aboveTop = rect.top - estimatedHeight - 12;
    const top =
      belowTop + estimatedHeight <= window.innerHeight - 12
        ? belowTop
        : Math.max(aboveTop, 12);
    const left = clamp(
      window.innerWidth / 2 - width / 2,
      74,
      window.innerWidth - width - 10,
    );
    setActiveNpcId(person.id);
    setCardPosition({ left, top });
  }

  function scheduleClose() {
    if (pinned) return;
    cancelScheduledClose();
    closeTimer.current = window.setTimeout(() => {
      setActiveNpcId(null);
      setCardPosition(null);
    }, 120);
  }

  useEffect(() => {
    if (!activeNpcId) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeCard();
    };
    const handleViewportChange = () => closeCard();
    window.addEventListener("keydown", handleEscape);
    window.addEventListener("scroll", handleViewportChange, true);
    window.addEventListener("resize", handleViewportChange);
    return () => {
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("scroll", handleViewportChange, true);
      window.removeEventListener("resize", handleViewportChange);
    };
  }, [activeNpcId]);

  useEffect(() => {
    if (!activeNpcId || !pinned) return;
    const handleOutsidePointer = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".map-npc") || target?.closest(".map-npc-card")) return;
      closeCard();
    };
    document.addEventListener("pointerdown", handleOutsidePointer);
    return () => document.removeEventListener("pointerdown", handleOutsidePointer);
  }, [activeNpcId, pinned]);

  const activePortraitId = activePerson ? NPC_PORTRAIT_IDS[activePerson.id] : undefined;
  const activePortrait = activePortraitId ? PORTRAITS[activePortraitId] : null;

  return (
    <>
      <section className="fogport-map" aria-labelledby="fogport-map-title">
      <div className="map-head">
        <div>
          <p className="map-eyebrow">FOGPORT · MAP</p>
          <h3 id="fogport-map-title">雾港街区</h3>
        </div>
        <span className="map-scale">手绘路线图</span>
      </div>

      <div className="map-canvas">
        <svg
          className="map-svg"
          viewBox="0 0 640 430"
          role="img"
          aria-label="雾港街区路线地图，金色路线连接中央邮局、钟楼广场、蔷薇巷、旧码头和北岸灯塔；蔷薇巷内有雾灯书店，四位人物以头像标出所在位置"
        >
          <defs>
            <pattern
              id="map-water"
              width="128"
              height="128"
              patternUnits="userSpaceOnUse"
            >
              <image
                href={waterTexture}
                width="128"
                height="128"
                opacity="0.3"
                preserveAspectRatio="xMidYMid slice"
              />
            </pattern>
            <pattern
              id="map-land"
              width="128"
              height="128"
              patternUnits="userSpaceOnUse"
            >
              <image
                href={landTexture}
                width="128"
                height="128"
                opacity="0.22"
                preserveAspectRatio="xMidYMid slice"
              />
            </pattern>
            <linearGradient id="map-sea-fade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0a2224" stopOpacity="0.35" />
              <stop offset="60%" stopColor="#071b1d" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#051416" stopOpacity="0.55" />
            </linearGradient>
            <radialGradient id="map-current-glow">
              <stop offset="0%" stopColor="#eac584" stopOpacity="0.36" />
              <stop offset="55%" stopColor="#d3a45d" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#d3a45d" stopOpacity="0" />
            </radialGradient>
            <clipPath id="map-main-land">
              <path d={LAND_PATH} />
            </clipPath>
            <clipPath id="map-lighthouse-land">
              <path d={LIGHTHOUSE_ISLAND_PATH} />
            </clipPath>
          </defs>

          <rect width="640" height="430" fill="#061719" />
          <rect width="640" height="430" fill="url(#map-water)" />
          <rect width="640" height="430" fill="url(#map-sea-fade)" />

          <path d={LAND_PATH} fill="#293a33" />
          <rect
            width="640"
            height="430"
            fill="url(#map-land)"
            clipPath="url(#map-main-land)"
          />
          <path
            d={LAND_PATH}
            fill="none"
            stroke="#b88b52"
            strokeWidth="2.4"
            opacity="0.55"
          />
          <path
            d={LAND_PATH}
            fill="none"
            stroke="#d9c79e"
            strokeWidth="1"
            opacity="0.22"
          />

          <path d={LIGHTHOUSE_ISLAND_PATH} fill="#293a33" />
          <rect
            width="640"
            height="430"
            fill="url(#map-land)"
            clipPath="url(#map-lighthouse-land)"
          />
          <path
            d={LIGHTHOUSE_ISLAND_PATH}
            fill="none"
            stroke="#b88b52"
            strokeWidth="2.2"
            opacity="0.55"
          />

          <g className="map-roads" aria-hidden="true">
            <path d="M120 140C180 155 245 170 305 195" />
            <path d="M305 195C350 170 405 145 462 130" />
            <path d="M305 195C285 245 250 295 218 340" />
          </g>
          <g className="map-sea-route" aria-hidden="true">
            <path d="M218 340C300 380 420 370 525 315" />
          </g>

          <g className="map-pier" aria-hidden="true">
            <path d="M205 345L165 365M215 353L179 371M226 360L195 377" />
          </g>

          <g className="map-boat" aria-hidden="true" transform="translate(363 367) rotate(-8)">
            <path d="M-18 0L18 0L11 9L-11 9Z" fill="#b8884e" stroke="#07181a" strokeWidth="1.5" />
            <path d="M0 0V-24" stroke="#d5b47c" strokeWidth="2" />
            <path d="M2-22L18-7L2-7Z" fill="#d9c9a3" opacity="0.84" />
          </g>

          <g className="map-swells" aria-hidden="true">
            <path d="M90 390C115 384 135 396 160 390" />
            <path d="M430 395C455 388 480 400 505 393" />
            <path d="M340 50C365 44 388 55 412 49" />
          </g>

          <path
            className="map-fog-bank"
            d="M30 255C115 230 185 270 260 250C335 230 410 270 500 245C555 230 600 246 630 260"
            aria-hidden="true"
          />

          <circle
            className="map-current-halo"
            cx={LOCATIONS.find((location) => location.id === state.location.id)?.x ?? 120}
            cy={LOCATIONS.find((location) => location.id === state.location.id)?.y ?? 140}
            r="52"
            fill="url(#map-current-glow)"
            aria-hidden="true"
          />
        </svg>

        <div className="map-nodes">
          {LOCATIONS.map((location) => {
            const current = location.id === state.location.id;
            const explored = isExplored(state, location);
            const person = state.relationships.find(
              (relationship) => relationship.locationId === location.id,
            );
            const portraitId = person ? NPC_PORTRAIT_IDS[person.id] : undefined;
            const portrait = portraitId ? PORTRAITS[portraitId] : null;
            return (
              <div
                key={location.id}
                className={`map-node ${current ? "is-current" : ""} ${
                  explored ? "is-explored" : "is-unvisited"
                }`.trim()}
                style={{
                  left: `${(location.x / 640) * 100}%`,
                  top: `${(location.y / 430) * 100}%`,
                }}
                title={`${location.name}${location.subName ? ` · ${location.subName}` : ""}${current ? " · 你在这里" : explored ? " · 已到访" : " · 未到访"}`}
                role="group"
                aria-label={`${location.name}${location.subName ? `，内有${location.subName}` : ""}${current ? "，当前位置" : explored ? "，已到访" : "，未到访"}${person ? `；${person.name}在这里` : ""}`}
              >
                <span className="map-icon-wrap">
                  {current && <span className="map-node-ring" aria-hidden="true" />}
                  {location.lighthouse && <span className="map-beam" aria-hidden="true" />}
                  <img
                    className="map-node-icon"
                    src={location.sprite}
                    alt=""
                    loading="eager"
                  />
                  {location.clock && <span className="map-clock-mark" aria-hidden="true" />}
                  {explored && !current && (
                    <span className="map-visited" aria-hidden="true">
                      ✓
                    </span>
                  )}
                  {person && portrait && (
                    <button
                      type="button"
                      className={`map-npc ${person.value >= 65 ? "is-trusted" : ""}`.trim()}
                      title={`${person.name} · ${person.role} · 悬浮查看身份卡`}
                      aria-label={`${person.name}在${location.name}，查看身份卡`}
                      aria-expanded={activeNpcId === person.id}
                      aria-controls={activeNpcId === person.id ? "map-npc-card" : undefined}
                      onMouseEnter={(event) => {
                        setPinned(false);
                        openCard(person, event.currentTarget);
                      }}
                      onMouseLeave={scheduleClose}
                      onFocus={(event) => {
                        setPinned(false);
                        openCard(person, event.currentTarget);
                      }}
                      onBlur={scheduleClose}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (activeNpcId === person.id && pinned) {
                          closeCard();
                          return;
                        }
                        setPinned(true);
                        openCard(person, event.currentTarget);
                      }}
                    >
                      <img src={portrait.src} alt="" loading="lazy" />
                    </button>
                  )}
                </span>
                <span className="map-node-label">
                  <strong>{location.name}</strong>
                  {location.subName && (
                    <span className="map-node-sub">
                      <GameIcon name="recap" size={11} />
                      {location.subName}
                    </span>
                  )}
                  {current && <em>你在这里</em>}
                </span>
              </div>
            );
          })}
        </div>

        <div className="map-compass" aria-hidden="true">
          <span>N</span>
          <i />
        </div>
        <p className="map-sea-label">雾 海</p>
      </div>

      <div className="map-legend" aria-label="地图图例">
        <span className="legend-current">当前位置</span>
        <span className="legend-explored">已到访</span>
        <span className="legend-unvisited">未到访</span>
        <span className="legend-sea">海路</span>
      </div>
      <div className="map-people" aria-label="人物所在位置">
        <span className="map-people-title">人物所在</span>
        {state.relationships.map((person) => {
          const portraitId = NPC_PORTRAIT_IDS[person.id];
          const portrait = portraitId ? PORTRAITS[portraitId] : null;
          if (!portrait) return null;
          return (
            <span className="map-person" key={person.id}>
              <img src={portrait.src} alt="" loading="lazy" />
              <span>
                {person.name} · {person.locationName}
              </span>
            </span>
          );
        })}
      </div>
      <p className="map-caption">沿金线可前往相邻地点；虚线为海路。</p>
      </section>
      {activePerson && activePortrait && cardPosition &&
        createPortal(
          <aside
            id="map-npc-card"
            className="map-npc-card"
            style={{ left: cardPosition.left, top: cardPosition.top }}
            role="dialog"
            aria-label={`${activePerson.name}的身份卡`}
            onMouseEnter={cancelScheduledClose}
            onMouseLeave={scheduleClose}
          >
            <button
              type="button"
              className="map-npc-card-close"
              onClick={closeCard}
              aria-label="关闭身份卡"
            >
              ×
            </button>
            <div className="map-npc-card-head">
              <img
                className="map-npc-card-portrait"
                src={activePortrait.src}
                alt=""
                loading="eager"
              />
              <div className="map-npc-card-copy">
                <p className="map-npc-card-eyebrow">IDENTITY · 身份卡</p>
                <h3>{activePerson.name}</h3>
                <p className="map-npc-card-role">{activePerson.role}</p>
                <p className="map-npc-card-location">所在 · {activePerson.locationName}</p>
              </div>
            </div>
            <div className="map-npc-card-relation">
              <div>
                <span>{activePerson.attitude}</span>
                <strong>{activePerson.value}</strong>
                {activePerson.value >= 65 && (
                  <em className="map-npc-card-trust">已信任</em>
                )}
              </div>
              <div
                className="meter map-npc-meter"
                role="progressbar"
                aria-label={`与${activePerson.name}的关系`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={activePerson.value}
              >
                <span
                  className="meter-fill"
                  style={{ width: `${activePerson.value}%` }}
                />
              </div>
            </div>
            <p className="map-npc-card-note">{activePerson.arcNote}</p>
            {activePerson.knownFacts.length > 0 && (
              <p className="map-npc-card-facts">
                已知 {activePerson.knownFacts.length} 件关于这个人的事
              </p>
            )}
          </aside>,
          document.body,
        )}
    </>
  );
}
