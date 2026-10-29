import { useState } from "react";
import { api, REPORTS_TO_SUSPEND } from "../backend/store";
import { attempt, useApp } from "../context";
import Sheet from "./Sheet";

const BLOCK_REASONS = ["Spam or annoying", "Rude or abusive", "Fake profile", "I don't know them", "Just need space"];
const REPORT_REASONS = ["Harassment or bullying", "Sexual or inappropriate content", "Hate speech", "Spam or scam", "Underage user", "Fake account"];

interface SafetySheetProps {
  targetId: string;
  mode: "block" | "report";
  onClose: () => void;
  onDone?: () => void;
}

export default function SafetySheet({ targetId, mode, onClose, onDone }: SafetySheetProps) {
  const { me, notify, nameOf } = useApp();
  const reasons = mode === "block" ? BLOCK_REASONS : REPORT_REASONS;
  const [reason, setReason] = useState(reasons[0]);
  const [details, setDetails] = useState("");
  const [alsoBlock, setAlsoBlock] = useState(true);
  const name = nameOf(targetId);

  const submit = () => {
    const ok = attempt(notify, () => {
      if (mode === "block") {
        api.block(me.id, targetId, details.trim() ? `${reason}: ${details.trim()}` : reason);
        notify(`${name} is blocked`);
      } else {
        api.report(me.id, targetId, reason, details.trim() || undefined);
        if (alsoBlock) api.block(me.id, targetId, `Reported: ${reason}`);
        notify(`Thanks, we got your report about ${name}`);
      }
    });
    if (ok) {
      onDone?.();
      onClose();
    }
  };

  return (
    <Sheet title={mode === "block" ? `Block ${name}?` : `Report ${name}`} onClose={onClose}>
      <p className="sheet-note">
        {mode === "block"
          ? "They won't be able to message you, send requests or find you in strangers. Pick a reason (only you see it)."
          : `Reports are private. An account is suspended automatically after ${REPORTS_TO_SUSPEND} different people report it.`}
      </p>
      <div className="reason-list" role="radiogroup">
        {reasons.map((item) => (
          <label key={item} className={`reason ${reason === item ? "is-picked" : ""}`}>
            <input type="radio" name="reason" checked={reason === item} onChange={() => setReason(item)} />
            {item}
          </label>
        ))}
      </div>
      <textarea
        className="text-field"
        placeholder={mode === "block" ? "Add a note (optional)" : "What happened? (optional)"}
        value={details}
        maxLength={300}
        onChange={(event) => setDetails(event.target.value)}
      />
      {mode === "report" && (
        <label className="check-row">
          <input type="checkbox" checked={alsoBlock} onChange={(event) => setAlsoBlock(event.target.checked)} />
          Also block {name}
        </label>
      )}
      <button type="button" className="primary-btn primary-btn--danger" onClick={submit}>
        {mode === "block" ? "Block" : "Send report"}
      </button>
    </Sheet>
  );
}
