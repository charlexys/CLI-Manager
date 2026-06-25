import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  ActionIcon,
  Box,
  Button,
  Card,
  Group,
  Modal,
  NumberInput,
  Select,
  SegmentedControl,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import type { LucideIcon } from "lucide-react";
import {
  CircleAlert,
  CircleCheck,
  Coins,
  Pencil,
  Plus,
  RefreshCw,
  ScanLine,
  Sparkles,
  Trash2,
  X,
} from "@/components/icons";
import { useModelPricingStore, type ModelPriceSyncCandidate } from "@/stores/modelPricingStore";
import { VendorIcon, inferVendor } from "@/components/VendorIcon";
import { normalizeModelId, type ModelPrice } from "@/lib/modelPricing";
import { useI18n } from "@/lib/i18n";

interface Props {
  searchValue: string;
}

type FilterMode = "all" | "missing" | "saved" | "candidates";

type Tone = "primary" | "neutral" | "success" | "warning" | "danger";

const TONE_COLOR: Record<Tone, string> = {
  primary: "var(--primary)",
  neutral: "var(--on-surface-variant)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
};

type PriceDraft = {
  model: string;
  inputPer1m: number;
  outputPer1m: number;
  cacheReadPer1m: number;
  cacheCreationPer1m: number;
};

const EMPTY_DRAFT: PriceDraft = {
  model: "",
  inputPer1m: 0,
  outputPer1m: 0,
  cacheReadPer1m: 0,
  cacheCreationPer1m: 0,
};

// 模型价格页样式：表格走苹果风「无斑马纹 + hairline 分隔 + 柔和悬浮」，全部映射主题 token。
const modelPricingStyles = `
.mp-table { border-collapse: separate; border-spacing: 0; }
.mp-table thead th {
  background: var(--surface-container-lowest) !important;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 42%, transparent) !important;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding-top: 4px;
  padding-bottom: 10px;
}
.mp-table tbody td {
  border-bottom: 1px solid color-mix(in srgb, var(--border) 20%, transparent) !important;
  background: transparent !important;
}
.mp-table tbody tr { transition: background-color var(--animate-duration-fast); }
.mp-table tbody tr:hover td {
  background: color-mix(in srgb, var(--primary) 5%, transparent) !important;
}
.mp-num {
  font-family: var(--font-ui-mono);
  font-variant-numeric: tabular-nums;
  font-size: 13px;
}
`;

const SOURCE_DOT: Record<string, string> = {
  builtin: "var(--text-muted)",
  manual: "var(--primary)",
  litellm: "var(--success)",
  openrouter: "#8b5cf6",
};

function formatPrice(value: number): string {
  if (!Number.isFinite(value)) return "$0";
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 6 })}`;
}

function sourceLabel(source: string, t: ReturnType<typeof useI18n>["t"]): string {
  if (source === "builtin") return t("settings.modelPricing.source.builtin");
  if (source === "manual") return t("settings.modelPricing.source.manual");
  if (source === "litellm") return "LiteLLM";
  if (source === "openrouter") return "OpenRouter";
  return source;
}

function draftFromPrice(price: ModelPrice | null): PriceDraft {
  if (!price) return EMPTY_DRAFT;
  return {
    model: price.model,
    inputPer1m: price.inputPer1m,
    outputPer1m: price.outputPer1m,
    cacheReadPer1m: price.cacheReadPer1m,
    cacheCreationPer1m: price.cacheCreationPer1m,
  };
}

function hasPrice(prices: Record<string, ModelPrice>, model: string): boolean {
  const normalized = normalizeModelId(model);
  if (!normalized) return false;
  return Object.values(prices).some((price) => normalizeModelId(price.model) === normalized);
}

function candidateKey(candidate: ModelPriceSyncCandidate): string {
  return `${candidate.targetModel}::${candidate.remote.sourceModelId}`;
}

// 苹果设置页标志性的圆角图标砖（filled / soft 两种）
function IconTile({
  icon: Icon,
  tone = "primary",
  variant = "soft",
  size = 34,
}: {
  icon: LucideIcon;
  tone?: Tone;
  variant?: "soft" | "solid";
  size?: number;
}) {
  const color = TONE_COLOR[tone];
  const solid = variant === "solid";
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.3),
        backgroundColor: solid ? color : `color-mix(in srgb, ${color} 14%, transparent)`,
        color: solid ? (tone === "primary" ? "var(--on-primary)" : "#fff") : color,
        boxShadow: solid ? `0 6px 16px color-mix(in srgb, ${color} 30%, transparent)` : "none",
      }}
    >
      <Icon size={Math.round(size * 0.54)} strokeWidth={2.2} />
    </span>
  );
}

function CountChip({ tone, children }: { tone: Tone; children: ReactNode }) {
  const color = TONE_COLOR[tone];
  return (
    <span
      className="inline-flex items-center justify-center rounded-full px-2 text-xs font-bold"
      style={{
        minWidth: 22,
        height: 20,
        backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
        color,
      }}
    >
      {children}
    </span>
  );
}

function StatChip({ icon, tone, value, label }: { icon: LucideIcon; tone: Tone; value: number; label: string }) {
  const color = TONE_COLOR[tone];
  return (
    <div
      className="inline-flex items-center gap-2 rounded-full"
      style={{
        padding: "5px 12px 5px 6px",
        backgroundColor: `color-mix(in srgb, ${color} 9%, var(--surface-container-lowest))`,
        border: `1px solid color-mix(in srgb, ${color} 20%, transparent)`,
      }}
    >
      <IconTile icon={icon} tone={tone} size={22} />
      <span style={{ fontSize: 15, fontWeight: 800, color: "var(--on-surface)", lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>{label}</span>
    </div>
  );
}

function SectionTitle({
  icon,
  tone,
  title,
  count,
  action,
}: {
  icon: LucideIcon;
  tone: Tone;
  title: string;
  count?: number;
  action?: ReactNode;
}) {
  return (
    <Group justify="space-between" align="center" wrap="nowrap">
      <Group gap="sm" align="center" wrap="nowrap" className="min-w-0">
        <IconTile icon={icon} tone={tone} size={28} />
        <Text fz={15} fw={700} c="var(--on-surface)" style={{ letterSpacing: -0.2 }} className="truncate">
          {title}
        </Text>
        {count != null && <CountChip tone={tone}>{count}</CountChip>}
      </Group>
      {action}
    </Group>
  );
}

function SourceBadge({ source }: { source: string }) {
  const { t } = useI18n();
  const dot = SOURCE_DOT[source] ?? "var(--text-muted)";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1"
      style={{
        backgroundColor: "color-mix(in srgb, var(--on-surface) 5%, transparent)",
        border: "1px solid color-mix(in srgb, var(--border) 40%, transparent)",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: dot }} />
      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--on-surface-variant)" }}>{sourceLabel(source, t)}</span>
    </span>
  );
}

function PriceCell({ value }: { value: number }) {
  const zero = !value;
  return (
    <span className="mp-num" style={{ color: zero ? "var(--text-muted)" : "var(--on-surface)" }}>
      {formatPrice(value)}
    </span>
  );
}

export function ModelPricingSettingsPage({ searchValue }: Props) {
  const { t } = useI18n();
  const {
    modelPrices,
    discoveredModels,
    candidates,
    unmatchedModels,
    loaded,
    loading,
    syncing,
    discovering,
    error,
    lastSyncResult,
    load,
    upsert,
    delete: deletePrices,
    sync,
    applyCandidate,
    applyCandidates,
    discover,
    clearCandidates,
  } = useModelPricingStore();
  const [filter, setFilter] = useState<FilterMode>("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<string | null>(null);
  const [draft, setDraft] = useState<PriceDraft>(EMPTY_DRAFT);
  const [candidateSelections, setCandidateSelections] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [applyingAll, setApplyingAll] = useState(false);

  useEffect(() => {
    if (!loaded && !loading) {
      void load().catch((err) => toast.error(t("settings.modelPricing.loadFailed"), { description: String(err) }));
    }
  }, [loaded, loading, load, t]);

  const prices = useMemo(() => Object.values(modelPrices).sort((a, b) => a.model.localeCompare(b.model)), [modelPrices]);
  const missingModels = useMemo(
    () => discoveredModels.filter((model) => !hasPrice(modelPrices, model)),
    [discoveredModels, modelPrices]
  );
  const query = searchValue.trim().toLowerCase();
  const filteredPrices = useMemo(() => {
    const base = filter === "missing" || filter === "candidates" ? [] : prices;
    if (!query) return base;
    return base.filter((price) => price.model.toLowerCase().includes(query) || price.source.toLowerCase().includes(query));
  }, [filter, prices, query]);
  const visibleMissing = useMemo(() => {
    if (filter !== "all" && filter !== "missing") return [];
    return missingModels.filter((model) => !query || model.toLowerCase().includes(query));
  }, [filter, missingModels, query]);
  const groupedCandidates = useMemo(() => {
    const groups = new Map<string, ModelPriceSyncCandidate[]>();
    for (const candidate of candidates) {
      if (query && !candidate.targetModel.toLowerCase().includes(query) && !candidate.remote.model.toLowerCase().includes(query)) continue;
      const items = groups.get(candidate.targetModel) ?? [];
      items.push(candidate);
      groups.set(candidate.targetModel, items);
    }
    return Array.from(groups.entries()).map(([targetModel, items]) => ({ targetModel, items }));
  }, [candidates, query]);
  // 只把「确实没有价格」的模型当作未匹配提示，避免已有内置价的带日期模型反复出现。
  const pendingUnmatched = useMemo(
    () => unmatchedModels.filter((model) => !hasPrice(modelPrices, model)),
    [unmatchedModels, modelPrices]
  );

  const openAddEditor = (model = "") => {
    setEditingModel(null);
    setDraft({ ...EMPTY_DRAFT, model });
    setEditorOpen(true);
  };

  const openEditEditor = (price: ModelPrice) => {
    setEditingModel(price.model);
    setDraft(draftFromPrice(price));
    setEditorOpen(true);
  };

  const saveDraft = async () => {
    const model = draft.model.trim();
    if (!model) {
      toast.error(t("settings.modelPricing.modelRequired"));
      return;
    }
    const existing = editingModel ? modelPrices[editingModel] : modelPrices[model];
    const now = Date.now();
    const price: ModelPrice = {
      model,
      inputPer1m: draft.inputPer1m,
      outputPer1m: draft.outputPer1m,
      cacheReadPer1m: draft.cacheReadPer1m,
      cacheCreationPer1m: draft.cacheCreationPer1m,
      source: existing?.source === "builtin" ? "manual" : existing?.source ?? "manual",
      sourceModelId: existing?.sourceModelId ?? null,
      rawJson: existing?.rawJson ?? null,
      updatedAtMs: now,
      syncedAtMs: existing?.syncedAtMs ?? null,
    };
    try {
      if (editingModel && editingModel !== model) {
        await deletePrices([editingModel]);
      }
      await upsert([price]);
      setEditorOpen(false);
      toast.success(t("settings.modelPricing.saved"));
    } catch (err) {
      toast.error(t("settings.modelPricing.saveFailed"), { description: String(err) });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deletePrices([deleteTarget]);
      toast.success(t("settings.modelPricing.deleted"));
      setDeleteTarget(null);
    } catch (err) {
      toast.error(t("settings.modelPricing.deleteFailed"), { description: String(err) });
    } finally {
      setDeleting(false);
    }
  };

  const handleDiscover = async () => {
    const models = await discover();
    toast.success(t("settings.modelPricing.discoverSuccess"), {
      description: t("settings.modelPricing.discoverDescription", {
        count: models.length,
        missing: models.filter((model) => !hasPrice(modelPrices, model)).length,
      }),
    });
    setFilter("missing");
  };

  const handleSync = async () => {
    try {
      const targets = Array.from(new Set([...prices.map((price) => price.model), ...discoveredModels]));
      const result = await sync(targets);
      toast.success(t("settings.modelPricing.syncSuccess"), {
        description: t("settings.modelPricing.syncDescription", {
          fetched: result.fetchedCount,
          matched: result.matched.length,
          candidates: result.candidates.length,
        }),
      });
      if (result.candidates.length > 0) setFilter("candidates");
    } catch (err) {
      toast.error(t("settings.modelPricing.syncFailed"), { description: String(err) });
    }
  };

  const selectedCandidateFor = (targetModel: string, items: ModelPriceSyncCandidate[]): ModelPriceSyncCandidate => {
    const selectedKey = candidateSelections[targetModel] ?? candidateKey(items[0]);
    return items.find((item) => candidateKey(item) === selectedKey) ?? items[0];
  };

  const handleApplyCandidate = async (targetModel: string, items: ModelPriceSyncCandidate[]) => {
    const selected = selectedCandidateFor(targetModel, items);
    try {
      await applyCandidate(selected);
      toast.success(t("settings.modelPricing.candidateApplied"), { description: `${targetModel} ← ${selected.remote.model}` });
    } catch (err) {
      toast.error(t("settings.modelPricing.applyCandidateFailed"), { description: String(err) });
    }
  };

  const handleApplyAllCandidates = async () => {
    if (groupedCandidates.length === 0) return;
    setApplyingAll(true);
    try {
      const selected = groupedCandidates.map(({ targetModel, items }) => selectedCandidateFor(targetModel, items));
      await applyCandidates(selected);
      toast.success(t("settings.modelPricing.applyAllSuccess"), { description: t("settings.modelPricing.applyAllDescription", { count: selected.length }) });
    } catch (err) {
      toast.error(t("settings.modelPricing.applyAllFailed"), { description: String(err) });
    } finally {
      setApplyingAll(false);
    }
  };

  const totalCount = prices.length;
  const candidateTargetCount = groupedCandidates.length;
  const showTable = filter === "all" || filter === "saved";

  return (
    <Stack gap="lg" h="100%" style={{ minHeight: 0 }}>
      <style>{modelPricingStyles}</style>

      <section className="ui-surface-card rounded-2xl border border-border p-4">
        <Group justify="space-between" align="flex-start" gap="md" wrap="nowrap">
          <Stack gap="sm" className="min-w-0">
            <Group gap="sm" align="center" wrap="nowrap">
              <IconTile icon={Coins} tone="primary" variant="solid" size={38} />
              <Box>
                <Text fz={18} fw={800} c="var(--on-surface)" style={{ letterSpacing: -0.3, lineHeight: 1.15 }}>
                  {t("settings.modelPricing.title")}
                </Text>
                <Text size="xs" c="var(--text-muted)">
                  {t("settings.modelPricing.subtitle")}
                </Text>
              </Box>
            </Group>
            <Group gap="xs">
              <StatChip icon={CircleCheck} tone="success" value={totalCount} label={t("settings.modelPricing.savedCount")} />
              <StatChip icon={CircleAlert} tone="warning" value={missingModels.length} label={t("settings.modelPricing.missingCount")} />
              <StatChip icon={Sparkles} tone="primary" value={candidateTargetCount} label={t("settings.modelPricing.candidateCount")} />
            </Group>
            <Text size="sm" c="var(--text-muted)" style={{ maxWidth: 560 }}>
              {t("settings.modelPricing.description")}
            </Text>
            {lastSyncResult && (
              <Text size="xs" c="var(--text-muted)">
                {t("settings.modelPricing.lastSync", {
                  fetched: lastSyncResult.fetchedCount,
                  matched: lastSyncResult.matched.length,
                  candidates: candidateTargetCount,
                  unmatched: pendingUnmatched.length,
                })}
              </Text>
            )}
            {error && <Text size="xs" c="var(--danger)">{t("settings.modelPricing.lastError", { error })}</Text>}
          </Stack>
          <Group gap="xs" className="shrink-0">
            <Button variant="light" leftSection={<ScanLine size={15} />} loading={discovering} onClick={() => void handleDiscover()}>
              {t("settings.modelPricing.discoverLocal")}
            </Button>
            <Button variant="light" leftSection={<RefreshCw size={15} />} loading={syncing} onClick={() => void handleSync()}>
              {t("settings.modelPricing.syncRemote")}
            </Button>
            <Button leftSection={<Plus size={15} />} onClick={() => openAddEditor()}>
              {t("settings.modelPricing.addManual")}
            </Button>
          </Group>
        </Group>
      </section>

      <section className="ui-surface-card rounded-2xl border border-border p-4" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <Group justify="space-between" align="center" mb="md">
          <SegmentedControl<FilterMode>
            value={filter}
            onChange={setFilter}
            color="cliPrimary"
            radius="md"
            data={[
              { value: "all", label: t("settings.modelPricing.filter.all") },
              { value: "saved", label: t("settings.modelPricing.filter.saved") },
              { value: "missing", label: t("settings.modelPricing.filter.missing", { count: missingModels.length }) },
              { value: "candidates", label: t("settings.modelPricing.filter.candidates", { count: candidateTargetCount }) },
            ]}
          />
          <Group gap="xs">
            {candidateTargetCount > 0 && (
              <Button size="compact-sm" leftSection={<CircleCheck size={14} />} loading={applyingAll} onClick={() => void handleApplyAllCandidates()}>
                {t("settings.modelPricing.applyAllCandidates", { count: candidateTargetCount })}
              </Button>
            )}
            {candidates.length > 0 && (
              <Button size="compact-sm" variant="subtle" leftSection={<X size={14} />} onClick={clearCandidates}>
                {t("settings.modelPricing.clearCandidates")}
              </Button>
            )}
          </Group>
        </Group>

        <Box style={{ flex: 1, minHeight: 0, overflowY: "auto" }} className="ui-thin-scroll">
        {showTable && (
          <Table className="mp-table" verticalSpacing="sm" stickyHeader>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t("settings.modelPricing.table.model")}</Table.Th>
                <Table.Th>{t("settings.modelPricing.table.source")}</Table.Th>
                <Table.Th ta="right">{t("settings.modelPricing.table.input")}</Table.Th>
                <Table.Th ta="right">{t("settings.modelPricing.table.output")}</Table.Th>
                <Table.Th ta="right">{t("settings.modelPricing.table.cacheRead")}</Table.Th>
                <Table.Th ta="right">{t("settings.modelPricing.table.cacheWrite")}</Table.Th>
                <Table.Th ta="right">{t("settings.modelPricing.table.actions")}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredPrices.map((price) => (
                <Table.Tr key={price.model}>
                  <Table.Td>
                    <Group gap="sm" wrap="nowrap" align="center">
                      <span
                        className="inline-flex shrink-0 items-center justify-center"
                        style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: "var(--surface-container-high)", color: "var(--on-surface)" }}
                      >
                        <VendorIcon vendor={inferVendor(price.model)} size={18} fallback={Coins} />
                      </span>
                      <Box className="min-w-0">
                        <Text fw={600} size="sm" c="var(--on-surface)" className="break-all">{price.model}</Text>
                        {price.sourceModelId && price.sourceModelId !== price.model && (
                          <Text size="xs" c="var(--text-muted)" className="break-all">{t("settings.modelPricing.sourceId", { id: price.sourceModelId })}</Text>
                        )}
                      </Box>
                    </Group>
                  </Table.Td>
                  <Table.Td><SourceBadge source={price.source} /></Table.Td>
                  <Table.Td ta="right"><PriceCell value={price.inputPer1m} /></Table.Td>
                  <Table.Td ta="right"><PriceCell value={price.outputPer1m} /></Table.Td>
                  <Table.Td ta="right"><PriceCell value={price.cacheReadPer1m} /></Table.Td>
                  <Table.Td ta="right"><PriceCell value={price.cacheCreationPer1m} /></Table.Td>
                  <Table.Td>
                    <Group justify="flex-end" gap={4} wrap="nowrap">
                      <Tooltip label={t("settings.modelPricing.edit")} withArrow>
                        <ActionIcon variant="subtle" color="gray" onClick={() => openEditEditor(price)} aria-label={t("settings.modelPricing.edit")}>
                          <Pencil size={15} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label={t("settings.modelPricing.delete")} withArrow>
                        <ActionIcon variant="subtle" color="red" onClick={() => setDeleteTarget(price.model)} aria-label={t("settings.modelPricing.delete")}>
                          <Trash2 size={15} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {filteredPrices.length === 0 && (
                <Table.Tr><Table.Td colSpan={7}><Text ta="center" c="var(--text-muted)" py="md">{t("settings.modelPricing.noPrices")}</Text></Table.Td></Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        )}

        {(filter === "all" || filter === "missing") && visibleMissing.length > 0 && (
          <Stack gap="sm" mt={filter === "all" ? "lg" : 0}>
            <SectionTitle icon={CircleAlert} tone="warning" title={t("settings.modelPricing.missingSection")} count={visibleMissing.length} />
            {visibleMissing.map((model) => (
              <Group
                key={model}
                justify="space-between"
                wrap="nowrap"
                className="rounded-2xl px-3 py-2.5"
                style={{
                  backgroundColor: "var(--surface-container-lowest)",
                  border: "1px solid color-mix(in srgb, var(--border) 30%, transparent)",
                }}
              >
                <Group gap="sm" wrap="nowrap" className="min-w-0">
                  <IconTile icon={Coins} tone="warning" size={30} />
                  <Box className="min-w-0">
                    <Text size="sm" fw={600} c="var(--on-surface)" className="break-all">{model}</Text>
                    <Text size="xs" c="var(--text-muted)">{t("settings.modelPricing.unpricedHint")}</Text>
                  </Box>
                </Group>
                <Button size="compact-sm" variant="light" leftSection={<Plus size={14} />} className="shrink-0" onClick={() => openAddEditor(model)}>
                  {t("settings.modelPricing.addPrice")}
                </Button>
              </Group>
            ))}
          </Stack>
        )}

        {(filter === "all" || filter === "candidates") && groupedCandidates.length > 0 && (
          <Stack gap="sm" mt={filter === "all" ? "lg" : 0}>
            <SectionTitle
              icon={Sparkles}
              tone="primary"
              title={t("settings.modelPricing.candidateSection")}
              count={candidateTargetCount}
              action={
                <Button size="compact-sm" leftSection={<CircleCheck size={14} />} loading={applyingAll} onClick={() => void handleApplyAllCandidates()}>
                  {t("settings.modelPricing.applyAll", { count: candidateTargetCount })}
                </Button>
              }
            />
            {groupedCandidates.map(({ targetModel, items }) => {
              const data = items.map((item) => ({
                value: candidateKey(item),
                label: `${item.remote.model} · ${sourceLabel(item.remote.source, t)} · ${(item.score * 100).toFixed(1)}%`,
              }));
              const selected = items.find((item) => candidateKey(item) === (candidateSelections[targetModel] ?? data[0]?.value)) ?? items[0];
              return (
                <Card
                  key={targetModel}
                  radius="lg"
                  p="sm"
                  style={{
                    backgroundColor: "var(--surface-container-lowest)",
                    border: "1px solid color-mix(in srgb, var(--border) 30%, transparent)",
                  }}
                >
                  <Group justify="space-between" align="flex-start" gap="md" wrap="nowrap">
                    <Stack gap={8} className="min-w-0 flex-1">
                      <Group gap="sm" align="center" wrap="nowrap" className="min-w-0">
                        <IconTile icon={Sparkles} tone="primary" size={26} />
                        <Text fw={700} c="var(--on-surface)" className="truncate">{targetModel}</Text>
                      </Group>
                      <Select
                        label={t("settings.modelPricing.remoteCandidate")}
                        data={data}
                        value={candidateSelections[targetModel] ?? data[0]?.value ?? null}
                        allowDeselect={false}
                        onChange={(value) => value && setCandidateSelections((prev) => ({ ...prev, [targetModel]: value }))}
                      />
                      {selected && (
                        <Text size="xs" c="var(--text-muted)">
                          {t("settings.modelPricing.candidatePriceLine", {
                            input: formatPrice(selected.remote.inputPer1m),
                            output: formatPrice(selected.remote.outputPer1m),
                            cacheRead: formatPrice(selected.remote.cacheReadPer1m),
                            cacheWrite: formatPrice(selected.remote.cacheCreationPer1m),
                          })}
                        </Text>
                      )}
                    </Stack>
                    <Button mt={28} leftSection={<CircleCheck size={15} />} className="shrink-0" onClick={() => void handleApplyCandidate(targetModel, items)}>
                      {t("settings.modelPricing.confirmApply")}
                    </Button>
                  </Group>
                </Card>
              );
            })}
          </Stack>
        )}

        {pendingUnmatched.length > 0 && (filter === "all" || filter === "candidates") && (
          <Text size="xs" c="var(--text-muted)" mt="md">
            {t("settings.modelPricing.unmatched", {
              models: pendingUnmatched.slice(0, 12).join(t("settings.common.listSeparator")),
              suffix: pendingUnmatched.length > 12 ? t("settings.modelPricing.moreSuffix", { count: pendingUnmatched.length }) : "",
            })}
          </Text>
        )}
        </Box>
      </section>

      <Modal
        opened={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={
          <Group gap="xs" align="center">
            <IconTile icon={editingModel ? Pencil : Plus} tone="primary" size={26} />
            <Text fw={700}>{editingModel ? t("settings.modelPricing.editTitle") : t("settings.modelPricing.addTitle")}</Text>
          </Group>
        }
        centered
      >
        <Stack gap="md">
          <TextInput
            label={t("settings.modelPricing.modelId")}
            value={draft.model}
            disabled={editingModel !== null}
            onChange={(event) => setDraft((prev) => ({ ...prev, model: event.currentTarget.value }))}
          />
          <NumberInput label={t("settings.modelPricing.inputUsd")} prefix="$" min={0} decimalScale={8} value={draft.inputPer1m} onChange={(value) => setDraft((prev) => ({ ...prev, inputPer1m: Number(value) || 0 }))} />
          <NumberInput label={t("settings.modelPricing.outputUsd")} prefix="$" min={0} decimalScale={8} value={draft.outputPer1m} onChange={(value) => setDraft((prev) => ({ ...prev, outputPer1m: Number(value) || 0 }))} />
          <NumberInput label={t("settings.modelPricing.cacheReadUsd")} prefix="$" min={0} decimalScale={8} value={draft.cacheReadPer1m} onChange={(value) => setDraft((prev) => ({ ...prev, cacheReadPer1m: Number(value) || 0 }))} />
          <NumberInput label={t("settings.modelPricing.cacheWriteUsd")} prefix="$" min={0} decimalScale={8} value={draft.cacheCreationPer1m} onChange={(value) => setDraft((prev) => ({ ...prev, cacheCreationPer1m: Number(value) || 0 }))} />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setEditorOpen(false)}>{t("settings.modelPricing.cancel")}</Button>
            <Button leftSection={<CircleCheck size={15} />} onClick={() => void saveDraft()}>{t("settings.modelPricing.save")}</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={
          <Group gap="xs" align="center">
            <IconTile icon={Trash2} tone="danger" size={26} />
            <Text fw={700}>{t("settings.modelPricing.deleteTitle")}</Text>
          </Group>
        }
        centered
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">
            {deleteTarget ? t("settings.modelPricing.deleteConfirm", { model: deleteTarget }) : ""}
          </Text>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setDeleteTarget(null)}>{t("settings.modelPricing.cancel")}</Button>
            <Button color="red" leftSection={<Trash2 size={15} />} loading={deleting} onClick={() => void confirmDelete()}>{t("settings.modelPricing.delete")}</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
