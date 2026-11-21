import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, Calculator, ChevronDown, ChevronRight, Hammer, Package, RefreshCw, Sparkles, Target, X } from "lucide-react";
import { Modal, ShardChip, SummaryCard } from "../ui";
import { fusedCountToTierLevel } from "../../constants";
import { formatLargeNumber, formatQuantity, formatTime, getRarityColor, shardIconUrl } from "../../utilities";
import type { AbsorbStep, AttributeOptimization, CompletionStep } from "../../services";
import type { Data } from "../../types/types";

/** What the page hands back once the optimizer has run. */
export interface InventoryOptimizerOutcome {
  plan: AttributeOptimization;
  data: Data;
  ironManView: boolean;
}

interface InventoryOptimizerModalProps {
  open: boolean;
  onClose: () => void;
  /** Runs the optimizer with the calculator's current settings and inventory. */
  run: (signal: AbortSignal, onProgress: (fraction: number) => void) => Promise<InventoryOptimizerOutcome>;
  /** Opens the calculator on `shardId` for `quantity`. */
  onOpenInCalculator: (shardId: string, quantity: number) => void;
}

type State = { status: "running"; progress: number } | { status: "done"; outcome: InventoryOptimizerOutcome } | { status: "error"; message: string };

/**
 * "Optimize Inventory": which attributes the owned shards can max, in what order, and
 * what each still costs. Runs when opened; the plan itself comes from
 * services/attributeOptimizer.
 */
export const InventoryOptimizerModal = ({ open, onClose, run, onOpenInCalculator }: InventoryOptimizerModalProps) => {
  const [state, setState] = useState<State>({ status: "running", progress: 0 });
  const controllerRef = useRef<AbortController | null>(null);
  // Latest `run`, so `start` stays stable and a calculator input changing never restarts an open plan.
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  });

  const start = useCallback(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ status: "running", progress: 0 });

    runRef
      .current(controller.signal, (progress) => {
        if (!controller.signal.aborted) setState({ status: "running", progress });
      })
      .then((outcome) => {
        if (!controller.signal.aborted) setState({ status: "done", outcome });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        console.error("Inventory optimization failed:", err);
        setState({ status: "error", message: err instanceof Error ? err.message : "Optimization failed" });
      });
  }, []);

  // Plan afresh every time the modal opens; stop planning when it closes.
  useEffect(() => {
    if (!open) return;
    start();
    return () => controllerRef.current?.abort();
  }, [open, start]);

  if (!open) return null;

  const openInCalculator = (shardId: string, quantity: number) => {
    onOpenInCalculator(shardId, quantity);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="inventory-optimizer-title"
      panelClassName="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col"
    >
      <div className="p-4 border-b border-slate-700 bg-slate-800/50 flex-shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <h2 id="inventory-optimizer-title" className="text-lg font-semibold text-white">
              Optimize Inventory
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer" aria-label="Close">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Maxes as many attributes as your shards allow: owned shards go into their own attribute first, then the surplus completes attributes from uncommon up
          to legendary (commons last), cheapest first.
        </p>
      </div>

      <div className="p-4 overflow-y-auto flex-1 min-h-0 space-y-5">
        {state.status === "running" && <Progress progress={state.progress} />}
        {state.status === "error" && <div className="text-center py-10 text-red-300 text-sm">{state.message}</div>}
        {state.status === "done" && <Plan outcome={state.outcome} onOpenInCalculator={openInCalculator} />}
      </div>

      <div className="p-4 border-t border-slate-700 bg-slate-800/50 flex-shrink-0 flex items-center justify-between gap-3 text-sm text-slate-400">
        <span>Uses your current calculator settings and enabled inventory.</span>
        <div className="flex items-center gap-3">
          <button
            onClick={start}
            disabled={state.status === "running"}
            className="px-3 py-2 rounded-md bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className="w-4 h-4" />
            Recalculate
          </button>
          <button onClick={onClose} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-md cursor-pointer">
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};

const Progress = ({ progress }: { progress: number }) => (
  <div className="py-10 space-y-3 text-center">
    <div className="text-sm text-slate-300">Planning attributes… {Math.round(progress * 100)}%</div>
    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden max-w-sm mx-auto">
      <div className="h-full bg-purple-500 transition-all duration-200" style={{ width: `${Math.round(progress * 100)}%` }} />
    </div>
  </div>
);

const Plan = ({ outcome, onOpenInCalculator }: { outcome: InventoryOptimizerOutcome; onOpenInCalculator: (shardId: string, quantity: number) => void }) => {
  const { plan, data, ironManView } = outcome;
  const formatCost = (cost: number) => (ironManView ? formatTime(cost) : `${formatLargeNumber(cost)} coins`);
  const fromInventory = plan.completions.filter((step) => step.fromInventoryOnly);
  const withMaterials = plan.completions.filter((step) => !step.fromInventoryOnly);
  const leftover = [...plan.remainingInventory.values()].reduce((sum, quantity) => sum + quantity, 0);

  if (plan.absorbs.length === 0 && plan.completions.length === 0) {
    return (
      <div className="text-center py-10 text-slate-400">
        <div>Nothing to do: none of your shards can move an unfinished attribute forward.</div>
        <div className="text-sm mt-1">Import your profile in Manage Inventory so your shards and attribute levels are up to date.</div>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard icon={Target} iconColor="text-green-400" label="Attributes Maxed" value={String(plan.totals.attributesMaxed)} />
        <SummaryCard icon={Package} iconColor="text-purple-400" label="Shards Used" value={formatQuantity(plan.totals.inventoryUsed)} />
        <SummaryCard icon={Hammer} iconColor="text-orange-400" label="Fusions" value={`${plan.totals.craftsNeeded}x`} />
        <SummaryCard
          icon={Calculator}
          iconColor="text-yellow-400"
          label={ironManView ? "Extra Time" : "Extra Cost"}
          value={formatCost(plan.totals.extraCost)}
        />
      </div>

      {plan.absorbs.length > 0 && (
        <Section title="1. Fuse into their own attributes" hint="Free: these shards only move their own attribute forward.">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {plan.absorbs.map((step) => (
              <AbsorbRow key={step.shardId} step={step} data={data} />
            ))}
          </div>
        </Section>
      )}

      {fromInventory.length > 0 && (
        <Section title="2. Complete from your surplus" hint="Fused entirely from shards you have spare; nothing to farm or buy.">
          {fromInventory.map((step, index) => (
            <CompletionRow key={step.shardId} index={index + 1} step={step} data={data} formatCost={formatCost} onOpenInCalculator={onOpenInCalculator} />
          ))}
        </Section>
      )}

      {withMaterials.length > 0 && (
        <Section title={`3. Complete with a few ${ironManView ? "farmed" : "bought"} shards`} hint="Your surplus covers a good part; the rest is listed.">
          {withMaterials.map((step, index) => (
            <CompletionRow key={step.shardId} index={index + 1} step={step} data={data} formatCost={formatCost} onOpenInCalculator={onOpenInCalculator} />
          ))}
        </Section>
      )}

      <p className="text-xs text-slate-500">
        {formatQuantity(leftover)} shard{leftover !== 1 ? "s" : ""} left over afterwards. Steps assume the ones above them are done; the calculator itself
        always plans against your whole inventory.
      </p>
    </>
  );
};

const Section = ({ title, hint, children }: { title: string; hint: string; children: ReactNode }) => (
  <section className="space-y-2">
    <div>
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <p className="text-xs text-slate-400">{hint}</p>
    </div>
    <div className="space-y-2">{children}</div>
  </section>
);

const levelOf = (data: Data, shardId: string, fused: number) => fusedCountToTierLevel(fused, data.shards[shardId].rarity);

const AbsorbRow = ({ step, data }: { step: AbsorbStep; data: Data }) => (
  <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-slate-800/50 border border-slate-600/50 text-sm">
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-slate-300 text-xs flex-shrink-0">{step.quantity}x</span>
      <ShardChip shard={data.shards[step.shardId]} fallbackTitleToName />
    </div>
    <LevelChange from={levelOf(data, step.shardId, step.fusedBefore)} to={levelOf(data, step.shardId, step.fusedAfter)} />
  </div>
);

const LevelChange = ({ from, to }: { from: number; to: number }) => (
  <span className="flex items-center gap-1 text-xs flex-shrink-0">
    <span className="text-slate-400">Lv {from}</span>
    <ArrowRight className="w-3 h-3 text-slate-500" />
    <span className={to >= 10 ? "text-green-400 font-semibold" : "text-slate-200"}>{to >= 10 ? "Max" : `Lv ${to}`}</span>
  </span>
);

interface CompletionRowProps {
  index: number;
  step: CompletionStep;
  data: Data;
  formatCost: (cost: number) => string;
  onOpenInCalculator: (shardId: string, quantity: number) => void;
}

const CompletionRow = ({ index, step, data, formatCost, onOpenInCalculator }: CompletionRowProps) => {
  const [expanded, setExpanded] = useState(false);
  const saved = step.baselineCost - step.extraCost;

  return (
    <div className="rounded-md bg-slate-800/50 border border-slate-600/50 text-sm">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 min-w-0 cursor-pointer" aria-expanded={expanded}>
          {expanded ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />}
          <span className="text-slate-500 text-xs w-5 text-right flex-shrink-0">{index}.</span>
          <span className="text-slate-300 text-xs flex-shrink-0">{step.quantity}x</span>
          <ShardChip shard={data.shards[step.shardId]} fallbackTitleToName />
        </button>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="hidden sm:inline text-xs text-slate-400">{step.craftsNeeded} fusions</span>
          <span className="text-xs text-slate-200">{formatCost(step.extraCost)}</span>
          <LevelChange from={levelOf(data, step.shardId, step.fusedBefore)} to={10} />
          <button
            onClick={() => onOpenInCalculator(step.shardId, step.quantity)}
            className="p-1.5 rounded-md text-purple-300 bg-purple-500/10 hover:bg-purple-500/25 border border-purple-500/20 cursor-pointer"
            title="Open in calculator"
            aria-label={`Open ${data.shards[step.shardId].name} in the calculator`}
          >
            <Calculator className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-slate-700/60 space-y-2">
          <ShardList label="From your inventory" shards={step.inventoryUsed} data={data} />
          {step.materials.size > 0 && <ShardList label="To get" shards={step.materials} data={data} />}
          <div className="text-xs text-slate-400">
            {step.craftsNeeded} fusions ({formatCost(step.craftCost)})
            {!step.fromInventoryOnly && saved > 0 && (
              <>
                {" "}
                • saves {formatCost(saved)} over making it from scratch ({formatCost(step.baselineCost)})
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const ShardList = ({ label, shards, data }: { label: string; shards: Map<string, number>; data: Data }) => (
  <div>
    <div className="text-xs text-slate-500 mb-1">{label}</div>
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {[...shards]
        .sort((a, b) => b[1] - a[1])
        .map(([shardId, quantity]) => {
          const shard = data.shards[shardId];
          return (
            <span key={shardId} className="flex items-center gap-1 text-xs">
              <span className="text-slate-300">{formatQuantity(quantity)}x</span>
              <img src={shardIconUrl(shardId)} alt={shard?.name ?? shardId} className="w-4 h-4 object-contain" loading="lazy" />
              <span className={shard ? getRarityColor(shard.rarity) : "text-slate-300"}>{shard?.name ?? shardId}</span>
            </span>
          );
        })}
    </div>
  </div>
);
