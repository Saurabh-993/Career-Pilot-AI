// Small overlay card — opens when a stat tile (Projects / Experience /
// Education) is clicked, showing each item with its tech stack.
export default function DetailModal({ title, items, onClose }) {
  if (!items) return null;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bento max-h-[80vh] w-full max-w-lg overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()} // clicks inside don't close it
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold">{title}</h3>
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-full border border-line text-soft hover:text-strong">
            ✕
          </button>
        </div>
        <div className="space-y-4">
          {items.map((item, i) => (
            <div key={i} className="rounded-xl border border-line p-3.5">
              <p className="text-sm font-semibold">{item.title}</p>
              {item.subtitle && <p className="mt-0.5 text-xs text-soft">{item.subtitle}</p>}
              {item.body && <p className="mt-1.5 text-xs leading-relaxed text-soft">{item.body}</p>}
              {item.chips?.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {item.chips.map((c) => (
                    <span key={c} className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
          {items.length === 0 && <p className="text-sm text-soft">Nothing found in your resume for this section.</p>}
        </div>
      </div>
    </div>
  );
}
