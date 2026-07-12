export default function SuggestedButtons({ options, onSelect, disabled }) {
  if (!options || options.length === 0) return null;
  return (
    <div className="suggested">
      {options.map((opt) => (
        <button key={opt} className="suggested-btn" disabled={disabled} onClick={() => onSelect(opt)}>
          {opt}
        </button>
      ))}
    </div>
  );
}
