import { useEffect, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import {
  Box,
  Button,
  Card,
  Group,
  Select,
  SimpleGrid,
  Slider,
  Stack,
  Switch,
  Text,
  UnstyledButton,
} from "@mantine/core";
import {
  useSettingsStore,
  type TerminalBackgroundFit,
  type TerminalBackgroundPosition,
  type TerminalBackgroundSettings,
} from "../../../stores/settingsStore";
import { backgroundAssetUrl } from "../../../lib/assetUrl";
import { formatFileSize } from "../../../lib/utils";
import { logError } from "../../../lib/logger";
import { useI18n, type TranslationKey } from "../../../lib/i18n";

interface SavedBackground {
  relativePath: string;
  sizeBytes: number;
  warning?: string;
}

const FIT_OPTIONS: { value: TerminalBackgroundFit; label: TranslationKey }[] = [
  { value: "cover", label: "settings.background.fit.cover" },
  { value: "contain", label: "settings.background.fit.contain" },
  { value: "center", label: "settings.background.fit.center" },
  { value: "tile", label: "settings.background.fit.tile" },
];

const POSITION_GRID: TerminalBackgroundPosition[] = [
  "top-left",
  "top-center",
  "top-right",
  "center-left",
  "center",
  "center-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

const POSITION_LABEL_KEYS: Record<TerminalBackgroundPosition, TranslationKey> = {
  "top-left": "settings.background.position.topLeft",
  "top-center": "settings.background.position.topCenter",
  "top-right": "settings.background.position.topRight",
  "center-left": "settings.background.position.centerLeft",
  center: "settings.background.position.center",
  "center-right": "settings.background.position.centerRight",
  "bottom-left": "settings.background.position.bottomLeft",
  "bottom-center": "settings.background.position.bottomCenter",
  "bottom-right": "settings.background.position.bottomRight",
};

export function TerminalBackgroundSection() {
  const { t } = useI18n();
  const terminalBackground = useSettingsStore((s) => s.terminalBackground);
  const update = useSettingsStore((s) => s.update);
  const terminalBackgroundMissing = useSettingsStore((s) => s.terminalBackgroundMissing);
  const clearTerminalBackgroundMissing = useSettingsStore((s) => s.clearTerminalBackgroundMissing);
  const [saving, setSaving] = useState(false);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [thumbFailed, setThumbFailed] = useState(false);

  const { enabled, imagePath, imageSizeBytes, opacity, fit, position, blur, overlayDarken } =
    terminalBackground;

  useEffect(() => {
    let cancelled = false;
    setThumbFailed(false);
    if (!imagePath) {
      setThumbUrl(null);
      return;
    }
    backgroundAssetUrl(imagePath).then((url) => {
      if (!cancelled) setThumbUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [imagePath]);

  // Patch helper — every UI control updates by spreading the current object plus a delta.
  const patch = (delta: Partial<TerminalBackgroundSettings>) => {
    void update("terminalBackground", { ...terminalBackground, ...delta });
  };

  const handlePickImage = async () => {
    if (saving) return;
    let selected: string | string[] | null;
    try {
      selected = await openDialog({
        multiple: false,
        directory: false,
        filters: [{ name: t("settings.background.dialogFilter"), extensions: ["jpg", "jpeg", "png", "gif"] }],
      });
    } catch (err) {
      toast.error(t("settings.background.openPickerFailed"), { description: String(err) });
      logError("openDialog failed for terminal background", { err });
      return;
    }
    if (!selected || typeof selected !== "string") return;

    setSaving(true);
    try {
      const saved = await invoke<SavedBackground>("save_background_image", {
        sourcePath: selected,
      });
      const prev = imagePath;
      await update("terminalBackground", {
        ...terminalBackground,
        imagePath: saved.relativePath,
        imageSizeBytes: saved.sizeBytes,
      });
      clearTerminalBackgroundMissing();
      // 用户更换图片时清理旧文件，避免 backgrounds/ 目录无限膨胀。
      // 注意：只在 imagePath 真正变化时清理，且仅保留新图。
      if (prev && prev !== saved.relativePath) {
        try {
          await invoke("cleanup_unused_backgrounds", {
            keepRelativePaths: [saved.relativePath],
          });
        } catch (err) {
          logError("cleanup_unused_backgrounds failed", { err });
        }
      }
      if (saved.warning === "file_too_large") {
        toast.warning(t("settings.background.largeTitle"), {
          description: t("settings.background.largeDescription"),
        });
      }
    } catch (err) {
      const msg = String(err);
      if (msg.includes("unsupported_format")) {
        toast.error(t("settings.background.unsupportedTitle"), { description: t("settings.background.unsupportedDescription") });
      } else {
        toast.error(t("settings.background.saveFailed"), { description: msg });
        logError("save_background_image failed", { err, source: selected });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    if (!imagePath && !terminalBackgroundMissing) return;
    if (!window.confirm(t("settings.background.confirmRemove"))) return;
    void (async () => {
      await update("terminalBackground", {
        ...terminalBackground,
        imagePath: null,
        imageSizeBytes: null,
      });
      clearTerminalBackgroundMissing();
      try {
        await invoke("cleanup_unused_backgrounds", { keepRelativePaths: [] });
      } catch (err) {
        logError("cleanup_unused_backgrounds failed", { err });
      }
    })();
  };

  const detailsDisabled = !enabled;

  return (
    <section className="ui-surface-card rounded-2xl border border-border p-4">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" gap="md" wrap="nowrap">
          <Box>
            <Text size="sm" fw={600} c="var(--on-surface)">
              {t("settings.background.title")}
            </Text>
            <Text mt={4} size="xs" c="var(--on-surface-variant)">
              {t("settings.background.description")}
            </Text>
          </Box>
          <Switch
            color="cliPrimary"
            checked={enabled}
            onChange={(event) => patch({ enabled: event.currentTarget.checked })}
            aria-label={enabled ? t("settings.background.disableAria") : t("settings.background.enableAria")}
          />
        </Group>

        {enabled && terminalBackgroundMissing && (
          <Card className="border border-warning/40 bg-warning/10" p="sm" radius="lg" role="alert">
            <Text size="xs" c="var(--warning)">
              {t("settings.background.missingWarning")}
            </Text>
          </Card>
        )}

        {enabled && !imagePath && !terminalBackgroundMissing && (
          <Card className="border border-dashed border-border bg-surface-container-low" p="sm" radius="lg">
            <Text size="xs" c="var(--on-surface-variant)">
              {t("settings.background.emptyHint")}
            </Text>
          </Card>
        )}

        <Stack gap="md" style={detailsDisabled ? { opacity: 0.55, pointerEvents: "none" } : undefined} aria-disabled={detailsDisabled}>
          <Card className="border border-border bg-surface-container-lowest" p="sm" radius="lg">
            <Stack gap="sm">
              <Text size="xs" fw={600} c="var(--on-surface)">
                {t("settings.background.image")}
              </Text>
              <Group align="flex-start" gap="md" wrap="nowrap">
                <Box
                  className="ui-selection-card flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-container-low text-[10px] text-on-surface-variant"
                  w={96}
                  h={64}
                  aria-label={t("settings.background.previewAria")}
                >
                  {thumbUrl && !thumbFailed ? (
                    <img
                      src={thumbUrl}
                      alt={t("settings.background.thumbnailAlt")}
                      className="h-full w-full object-cover"
                      onError={() => setThumbFailed(true)}
                    />
                  ) : thumbFailed ? (
                    <Text size="xs" ta="center" c="var(--warning)">
                      {t("settings.background.loadFailed")}
                    </Text>
                  ) : (
                    <Text size="xs" c="var(--on-surface-variant)">
                      {t("settings.background.noImage")}
                    </Text>
                  )}
                </Box>
                <Stack gap="xs" style={{ minWidth: 0, flex: 1 }}>
                  <Group gap="xs">
                    <Button
                      variant="light"
                      color="cliPrimary"
                      size="xs"
                      onClick={() => void handlePickImage()}
                      disabled={saving}
                    >
                      {saving ? t("settings.templates.saving") : imagePath ? t("settings.background.changeImage") : t("settings.background.chooseImage")}
                    </Button>
                    {imagePath && (
                      <Button variant="subtle" color="red" size="xs" onClick={handleClear} disabled={saving}>
                        {t("settings.background.clear")}
                      </Button>
                    )}
                    {thumbFailed && imagePath && (
                      <Button variant="subtle" color="cliPrimary" size="xs" onClick={() => void handlePickImage()}>
                        {t("settings.background.repick")}
                      </Button>
                    )}
                  </Group>
                  <Text size="xs" c="var(--on-surface-variant)" style={{ overflowWrap: "anywhere" }}>
                    {imagePath ? (
                      <>
                        {t("settings.background.currentFile")}<span className="font-mono">{imagePath}</span>
                        {typeof imageSizeBytes === "number" && (
                          <span className="ml-1 text-text-muted">（{formatFileSize(imageSizeBytes)}）</span>
                        )}
                      </>
                    ) : (
                      t("settings.background.noImageSelected")
                    )}
                  </Text>
                  {thumbFailed && imagePath && (
                    <Text size="xs" c="var(--warning)">
                      {t("settings.background.reloadHint")}
                    </Text>
                  )}
                </Stack>
              </Group>
            </Stack>
          </Card>

          <Card className="border border-border bg-surface-container-lowest" p="sm" radius="lg">
            <Stack gap="sm">
              <Text size="xs" fw={600} c="var(--on-surface)">
                {t("settings.background.displaySettings")}
              </Text>
              <SliderRow
                label={t("settings.background.opacity")}
                min={0}
                max={100}
                step={1}
                value={opacity}
                suffix="%"
                ariaLabel={t("settings.background.opacityAria")}
                onChange={(v) => patch({ opacity: v })}
              />
              <Select<TerminalBackgroundFit>
                label={t("settings.background.fitMode")}
                value={fit}
                onChange={(value) => {
                  if (value) patch({ fit: value });
                }}
                data={FIT_OPTIONS.map((option) => ({ ...option, label: t(option.label) }))}
                allowDeselect={false}
                size="xs"
                aria-label={t("settings.background.fitMode")}
              />
              <SliderRow
                label={t("settings.background.blur")}
                min={0}
                max={20}
                step={1}
                value={blur}
                suffix="px"
                ariaLabel={t("settings.background.blurAria")}
                onChange={(v) => patch({ blur: v })}
              />
              <SliderRow
                label={t("settings.background.overlayDarken")}
                min={0}
                max={80}
                step={1}
                value={overlayDarken}
                suffix="%"
                ariaLabel={t("settings.background.overlayDarkenAria")}
                onChange={(v) => patch({ overlayDarken: v })}
              />
            </Stack>
          </Card>

          <Card className="border border-border bg-surface-container-lowest" p="sm" radius="lg">
            <Stack gap="xs">
              <Text size="xs" fw={600} c="var(--on-surface)">
                {t("settings.background.positionAlign")}
              </Text>
              <Text size="xs" c="var(--on-surface-variant)">
                {t("settings.background.positionDescription")}
              </Text>
              <SimpleGrid cols={3} spacing={6} w={128}>
                {POSITION_GRID.map((pos) => {
                  const active = position === pos;
                  const positionLabel = t(POSITION_LABEL_KEYS[pos]);
                  return (
                    <UnstyledButton
                      key={pos}
                      type="button"
                      onClick={() => patch({ position: pos })}
                      className="ui-interactive ui-focus-ring ui-selection-card flex h-10 w-10 items-center justify-center rounded-lg border text-[10px]"
                      data-selected={active ? "true" : "false"}
                      aria-pressed={active}
                      aria-label={t("settings.background.positionAria", { label: positionLabel })}
                      title={positionLabel}
                    >
                      <Box
                        component="span"
                        w={8}
                        h={8}
                        style={{
                          borderRadius: 999,
                          backgroundColor: active ? "var(--primary)" : "var(--on-surface-variant)",
                          opacity: active ? 1 : 0.45,
                        }}
                      />
                    </UnstyledButton>
                  );
                })}
              </SimpleGrid>
            </Stack>
          </Card>
        </Stack>
      </Stack>
    </section>
  );
}

interface SliderRowProps {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  suffix?: string;
  ariaLabel: string;
  onChange: (next: number) => void;
}

function SliderRow({ label, min, max, step, value, suffix, ariaLabel, onChange }: SliderRowProps) {
  return (
    <Stack gap={6}>
      <Group justify="space-between" align="center">
        <Text size="xs" c="var(--on-surface-variant)">
          {label}
        </Text>
        <Text size="xs" ff="var(--font-ui-mono)" c="var(--on-surface)" className="tabular-nums">
          {value}
          {suffix ?? ""}
        </Text>
      </Group>
      <Slider
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        color="cliPrimary"
        aria-label={ariaLabel}
      />
    </Stack>
  );
}
