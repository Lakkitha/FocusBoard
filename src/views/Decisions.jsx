import { useMemo, useState } from "react";
import { Plus, Scale, Trash2 } from "lucide-react";
import { useStore } from "../store/useStore";
import Modal from "../components/Modal";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "decided", label: "Decided" },
];

export default function Decisions({ onNavigate }) {
  const decisions = useStore((s) => s.decisions);
  const addDecision = useStore((s) => s.addDecision);
  const deleteDecision = useStore((s) => s.deleteDecision);

  const [activeFilter, setActiveFilter] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const activeCount = decisions.filter((d) => d.status === "active").length;
  const decidedCount = decisions.filter((d) => d.status === "decided").length;

  const filteredDecisions = useMemo(() => {
    if (activeFilter === "active") {
      return decisions.filter((d) => d.status === "active");
    }
    if (activeFilter === "decided") {
      return decisions.filter((d) => d.status === "decided");
    }
    return decisions;
  }, [activeFilter, decisions]);

  const handleCreateDecision = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    const newDecision = addDecision({
      title: trimmedTitle,
      description: description.trim(),
    });

    setTitle("");
    setDescription("");
    setIsModalOpen(false);

    if (newDecision) {
      onNavigate(`decision-${newDecision.id}`);
    }
  };

  const handleDeleteDecision = (decisionId) => {
    if (!confirm("Delete this decision? This cannot be undone.")) return;
    deleteDecision(decisionId);
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Scale className="w-6 h-6 text-brand-purple" />
          <h1 className="text-2xl font-bold text-surface-50">Decisions</h1>
        </div>
        <button
          className="btn-primary flex items-center gap-2"
          onClick={() => setIsModalOpen(true)}
        >
          <Plus className="w-4 h-4" />
          New Decision
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="card">
          <p className="text-xs text-surface-400">Active</p>
          <p className="text-2xl font-semibold text-brand-purple">
            {activeCount}
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-surface-400">Decided</p>
          <p className="text-2xl font-semibold text-brand-green">
            {decidedCount}
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-surface-400">Total</p>
          <p className="text-2xl font-semibold text-surface-50">
            {decisions.length}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {FILTERS.map((filter) => {
          const isActive = activeFilter === filter.key;
          return (
            <button
              key={filter.key}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                isActive
                  ? "bg-brand-purple/20 text-brand-purple"
                  : "bg-surface-600 text-surface-300 hover:bg-surface-500"
              }`}
              onClick={() => setActiveFilter(filter.key)}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      {decisions.length === 0 ? (
        <div className="card py-12 text-center">
          <Scale className="w-10 h-10 text-surface-500 mx-auto mb-3" />
          <p className="text-surface-300 font-medium">No decisions yet</p>
          <p className="text-surface-400 text-sm mt-1">
            Create your first decision matrix to evaluate options objectively.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDecisions.map((decision) => {
            const optionCount = decision.options?.length || 0;
            const criteriaCount = decision.criteria?.length || 0;
            const createdAt = decision.createdAt
              ? new Date(decision.createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })
              : "";
            const winnerLabel = decision.options?.find(
              (option) => option.id === decision.winnerId,
            )?.label;

            return (
              <div
                key={decision.id}
                className="card space-y-3 hover:border-surface-400 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-surface-50">
                        {decision.title || "Untitled decision"}
                      </p>
                      <span
                        className={`badge ${
                          decision.status === "decided"
                            ? "bg-brand-green/20 text-brand-green"
                            : "bg-brand-blue/20 text-brand-blue"
                        }`}
                      >
                        {decision.status}
                      </span>
                    </div>
                  </div>
                  <button
                    className="btn-danger"
                    onClick={() => handleDeleteDecision(decision.id)}
                    aria-label="Delete decision"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {decision.description ? (
                  <p className="text-sm text-surface-400 line-clamp-2">
                    {decision.description}
                  </p>
                ) : null}

                <div className="text-xs text-surface-400 flex flex-wrap gap-4">
                  <span>{optionCount} options</span>
                  <span>{criteriaCount} criteria</span>
                  {createdAt && <span>Created {createdAt}</span>}
                  {decision.status === "decided" && winnerLabel ? (
                    <span className="text-brand-green">
                      <span aria-hidden="true">&#10003;</span> {winnerLabel}
                    </span>
                  ) : null}
                </div>

                <button
                  className="btn-secondary w-full"
                  onClick={() => onNavigate(`decision-${decision.id}`)}
                >
                  Open
                </button>
              </div>
            );
          })}
        </div>
      )}

      {isModalOpen ? (
        <Modal title="New Decision" onClose={() => setIsModalOpen(false)}>
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="decision-title">
                Title
              </label>
              <input
                id="decision-title"
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Decision name"
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="decision-description">
                Description
              </label>
              <textarea
                id="decision-description"
                className="input min-h-[80px] resize-none"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional context or goals"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="btn-secondary"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className={`btn-primary ${
                  title.trim() ? "" : "opacity-50 cursor-not-allowed"
                }`}
                disabled={!title.trim()}
                onClick={handleCreateDecision}
              >
                Create
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
