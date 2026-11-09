import { GAME_ICON_PATHS, type GameIconName } from "../gameIcons";

interface GameIconProps {
  name: GameIconName;
  size?: number;
  className?: string;
}

export function GameIcon({ name, size = 24, className = "" }: GameIconProps) {
  return (
    <svg
      className={`game-icon ${className}`.trim()}
      viewBox="0 0 512 512"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      {GAME_ICON_PATHS[name].map((path, index) => (
        <path key={index} d={path} fill="currentColor" />
      ))}
    </svg>
  );
}
