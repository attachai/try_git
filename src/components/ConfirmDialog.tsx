type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  tone?: "buy" | "evolve";
  imageUrl?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  tone = "buy",
  imageUrl,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <section
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {imageUrl && <img className="confirm-art" src={imageUrl} alt="" />}
        <p className="eyebrow">{tone === "evolve" ? "Evolution" : "Character Shop"}</p>
        <h2 id="confirm-title">{title}</h2>
        <p className="muted">{description}</p>
        <div className="dialog-actions">
          <button className="dialog-cancel" onClick={onCancel}>ยกเลิก</button>
          <button className={tone === "evolve" ? "dialog-confirm evolve" : "dialog-confirm"} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
