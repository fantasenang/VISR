interface OpeningSoundControlProps {
  enabled: boolean;
  onToggle: () => void;
}

export function OpeningSoundControl({ enabled, onToggle }: OpeningSoundControlProps) {
  return (
    <button
      type="button"
      className="opening-sound-control"
      aria-pressed={enabled}
      aria-label={enabled ? "Mute VISR sound" : "Enable VISR sound"}
      onClick={onToggle}
    >
      <span className="opening-sound-control__icon" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span>{enabled ? "Sound on" : "Sound off"}</span>
    </button>
  );
}
