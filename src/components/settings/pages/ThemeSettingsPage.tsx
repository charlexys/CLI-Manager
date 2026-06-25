import { useEffect, useMemo, useState } from "react";
import {
  ActionIcon,
  Badge,
  Box,
  Card,
  Group,
  NumberInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Slider,
  Stack,
  Switch,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { CircleHelp } from "lucide-react";
import {
  TERMINAL_THEME_GROUPS,
  TERMINAL_THEME_PRESETS,
  getTerminalTheme,
  resolveAutoTerminalThemeId,
} from "../../../lib/terminalThemes";
import { normalizeShellKey, getOsPlatform } from "../../../lib/shell";
import type { OsPlatform } from "../../../lib/shell";
import { getShellOptions } from "../../../lib/types";
import {
  TERMINAL_SCROLLBACK_ROWS_DEFAULT,
  TERMINAL_SCROLLBACK_ROWS_MAX,
  TERMINAL_SCROLLBACK_ROWS_MIN,
  useSettingsStore,
  type BatchLaunchPaneDirection,
  type UnsplitBehavior,
} from "../../../stores/settingsStore";
import { TerminalBackgroundSection } from "./TerminalBackgroundSection";
import {
  listSystemFonts,
  mergeFontFamilyOptions,
  type SystemFontFamily,
} from "../../../lib/systemFonts";
import { FontFamilySelect } from "../FontFamilySelect";
import { useI18n, type TranslationKey } from "../../../lib/i18n";

const SWATCH_KEYS = ["background", "foreground", "red", "green", "blue", "cyan"] as const;
const FONT_SIZE_MIN = 10;
const FONT_SIZE_MAX = 24;
const TERMINAL_FONT_FALLBACK = "monospace";

const FONT_FAMILY_OPTIONS: { value: string; label: string | TranslationKey }[] = [
  { value: "Cascadia Code, Consolas, monospace", label: "settings.terminal.fontCascadiaRecommended" },
  { value: "\"JetBrains Mono\", \"Cascadia Code\", Consolas, monospace", label: "JetBrains Mono" },
  { value: "\"Fira Code\", \"Cascadia Code\", Consolas, monospace", label: "Fira Code" },
  { value: "\"Microsoft YaHei\", \"Cascadia Code\", Consolas, monospace", label: "settings.terminal.fontMicrosoftYahei" },
  { value: "Consolas, monospace", label: "Consolas" },
  { value: "\"Courier New\", monospace", label: "Courier New" },
];

const UNSPLIT_OPTIONS: { value: UnsplitBehavior; label: TranslationKey }[] = [
  { value: "merge", label: "settings.terminal.unsplit.merge" },
  { value: "close", label: "settings.terminal.unsplit.close" },
];

const TERMINAL_THEME_GROUP_LABEL_KEYS: Record<string, { name: TranslationKey; description: TranslationKey }> = {
  cool: {
    name: "settings.terminal.group.cool.name",
    description: "settings.terminal.group.cool.description",
  },
  warm: {
    name: "settings.terminal.group.warm.name",
    description: "settings.terminal.group.warm.description",
  },
  nature: {
    name: "settings.terminal.group.nature.name",
    description: "settings.terminal.group.nature.description",
  },
  "pink-purple": {
    name: "settings.terminal.group.pinkPurple.name",
    description: "settings.terminal.group.pinkPurple.description",
  },
  "high-contrast": {
    name: "settings.terminal.group.highContrast.name",
    description: "settings.terminal.group.highContrast.description",
  },
  "light-office": {
    name: "settings.terminal.group.lightOffice.name",
    description: "settings.terminal.group.lightOffice.description",
  },
};

function clampFontSize(value: number) {
  if (!Number.isFinite(value)) return FONT_SIZE_MIN;
  return Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, value));
}

function clampTerminalScrollbackRows(value: number) {
  if (!Number.isFinite(value)) return TERMINAL_SCROLLBACK_ROWS_DEFAULT;
  return Math.min(TERMINAL_SCROLLBACK_ROWS_MAX, Math.max(TERMINAL_SCROLLBACK_ROWS_MIN, Math.round(value)));
}

export function ThemeSettingsPage() {
  const { t } = useI18n();
  const labelText = (label: string | TranslationKey) =>
    label.startsWith("settings.") ? t(label as TranslationKey) : label;
  const terminalThemeMode = useSettingsStore((s) => s.terminalThemeMode);
  const terminalThemeName = useSettingsStore((s) => s.terminalThemeName);
  const resolvedTheme = useSettingsStore((s) => s.resolvedTheme);
  const lightThemePalette = useSettingsStore((s) => s.lightThemePalette);
  const darkThemePalette = useSettingsStore((s) => s.darkThemePalette);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const terminalScrollbackRows = useSettingsStore((s) => s.terminalScrollbackRows);
  const fontFamily = useSettingsStore((s) => s.fontFamily);
  const defaultShell = useSettingsStore((s) => s.defaultShell);
  const useExternalTerminal = useSettingsStore((s) => s.useExternalTerminal);
  const unsplitBehavior = useSettingsStore((s) => s.unsplitBehavior);
  const shellRuntimeMonitoringEnabled = useSettingsStore((s) => s.shellRuntimeMonitoringEnabled);
  const batchLaunchGroupInPane = useSettingsStore((s) => s.batchLaunchGroupInPane);
  const batchLaunchPaneDirection = useSettingsStore((s) => s.batchLaunchPaneDirection);
  const setTerminalThemeMode = useSettingsStore((s) => s.setTerminalThemeMode);
  const update = useSettingsStore((s) => s.update);
  const [query, setQuery] = useState("");
  const [fontSizeDraft, setFontSizeDraft] = useState(fontSize);
  const [terminalScrollbackRowsDraft, setTerminalScrollbackRowsDraft] = useState(terminalScrollbackRows);
  const [osPlatform, setOsPlatform] = useState<OsPlatform>("windows");
  const [systemFonts, setSystemFonts] = useState<SystemFontFamily[]>([]);
  const [systemFontsLoading, setSystemFontsLoading] = useState(false);
  const [systemFontsError, setSystemFontsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSystemFontsLoading(true);
    setSystemFontsError(null);

    void listSystemFonts()
      .then((fonts) => {
        if (!cancelled) setSystemFonts(fonts);
      })
      .catch((err) => {
        console.warn("Failed to list system fonts:", err);
        if (!cancelled) setSystemFontsError(t("settings.terminal.fontLoadError"));
      })
      .finally(() => {
        if (!cancelled) setSystemFontsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    void getOsPlatform().then(setOsPlatform);
  }, []);

  useEffect(() => {
    setFontSizeDraft(fontSize);
  }, [fontSize]);

  useEffect(() => {
    setTerminalScrollbackRowsDraft(terminalScrollbackRows);
  }, [terminalScrollbackRows]);

  const autoThemeId = useMemo(
    () => resolveAutoTerminalThemeId(resolvedTheme, lightThemePalette, darkThemePalette),
    [darkThemePalette, lightThemePalette, resolvedTheme]
  );
  const effectiveThemeName = terminalThemeMode === "follow-app" ? "auto" : terminalThemeName;

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return TERMINAL_THEME_PRESETS;
    return TERMINAL_THEME_PRESETS.filter((preset) => preset.name.toLowerCase().includes(keyword));
  }, [query]);

  const groupedThemes = useMemo(
    () =>
      TERMINAL_THEME_GROUPS.map((group) => ({
        ...group,
        presets: filtered.filter((preset) => preset.group === group.id),
      })).filter((group) => group.presets.length > 0),
    [filtered]
  );

  const selectedTheme = useMemo(() => {
    const effective = getTerminalTheme(effectiveThemeName, resolvedTheme, lightThemePalette, darkThemePalette);
    const selectedPreset =
      TERMINAL_THEME_PRESETS.find((item) => item.id === (effectiveThemeName === "auto" ? autoThemeId : effectiveThemeName)) ??
      null;
    return {
      label:
        terminalThemeMode === "follow-app"
          ? t("settings.terminal.followAppCurrent", { name: selectedPreset?.name ?? "Auto" })
          : selectedPreset?.name ?? t("settings.terminal.independentTheme"),
      theme: effective,
    };
  }, [autoThemeId, darkThemePalette, effectiveThemeName, lightThemePalette, resolvedTheme, terminalThemeMode]);

  const fontFamilyOptions = useMemo(
    () =>
      mergeFontFamilyOptions(
        fontFamily,
        FONT_FAMILY_OPTIONS.map((option) => ({ ...option, label: labelText(option.label) })),
        systemFonts,
        TERMINAL_FONT_FALLBACK
      ),
    [fontFamily, systemFonts, t]
  );
  const normalizedDefaultShell = normalizeShellKey(defaultShell);
  const shellSelectValue = normalizedDefaultShell ?? defaultShell;
  const isCustomShellValue = !normalizedDefaultShell;
  const shellOptions = useMemo(
    () => [
      ...(isCustomShellValue ? [{ value: defaultShell, label: t("settings.terminal.customShell") }] : []),
      ...getShellOptions(osPlatform),
    ],
    [defaultShell, isCustomShellValue, osPlatform, t]
  );
  const commitFontSize = (value = fontSizeDraft) => {
    const next = clampFontSize(value);
    setFontSizeDraft(next);
    if (next !== fontSize) {
      void update("fontSize", next);
    }
  };
  const commitTerminalScrollbackRows = (value = terminalScrollbackRowsDraft) => {
    const next = clampTerminalScrollbackRows(value);
    setTerminalScrollbackRowsDraft(next);
    if (next !== terminalScrollbackRows) {
      void update("terminalScrollbackRows", next);
    }
  };

  // 注意：sticky 必须放在普通 div wrapper 上。Mantine Card（.m_e615b15f）自带
  // `position: relative`，且项目引入的是无 cascade layer 的 @mantine/core/styles.css，
  // 其优先级高于 Tailwind v4 @layer utilities 中的 `sticky`，导致直接写在 Card 上失效。
  const terminalPreview = (
    <div className="self-start xl:sticky xl:top-5 xl:z-10 xl:col-start-2 xl:row-span-3 xl:row-start-1">
      <section className="ui-surface-card rounded-2xl border border-border p-4">
        <Stack gap="sm">
          <Box>
            <Text size="sm" fw={600} c="var(--on-surface)">
              {t("settings.terminal.preview")}
            </Text>
            <Text mt={4} size="xs" c="var(--on-surface-variant)">
              {selectedTheme.label}
            </Text>
          </Box>
          <Box
            className="rounded-xl border p-3 font-mono text-xs"
            style={{
              borderColor: "var(--border)",
              backgroundColor: selectedTheme.theme.background ?? "var(--surface-container-lowest)",
              color: selectedTheme.theme.foreground ?? "var(--on-surface)",
            }}
          >
            <div>$ echo "hello cli-manager"</div>
            <div className="mt-1 opacity-80">{t("settings.terminal.previewEcho")}</div>
            <Group mt="md" gap={6}>
              {SWATCH_KEYS.map((key) => (
                <Box
                  key={key}
                  component="span"
                  w={16}
                  h={16}
                  style={{
                    backgroundColor:
                      (selectedTheme.theme as Record<string, string | undefined>)[key] ?? "var(--surface-container-lowest)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: 4,
                  }}
                  title={key}
                />
              ))}
            </Group>
          </Box>

          <Text size="xs" fw={600} c="var(--on-surface-variant)">
            {t("settings.terminal.fontPreview")}
          </Text>
          <Box
            className="rounded-xl border border-border p-4 font-mono"
            style={{ backgroundColor: "var(--surface-container-lowest)", color: "var(--on-surface)" }}
          >
            <Box style={{ fontFamily, fontSize: `${fontSize}px` }}>
              <div>$ cli-manager --doctor</div>
              <div className="opacity-80">{t("settings.terminal.previewReady")}</div>
              <div className="mt-1 text-success">{t("settings.terminal.previewInitialized")}</div>
            </Box>
          </Box>
        </Stack>
      </section>
    </div>
  );

  return (
    <Stack gap="md">
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="ui-surface-card rounded-2xl border border-border p-4 xl:col-start-1 xl:row-start-1">
          <Stack gap="md">
            <Text size="sm" fw={600} c="var(--on-surface)">
              {t("settings.terminal.behavior")}
            </Text>

            <Stack gap={6}>
              <Group justify="space-between" align="center">
                <Text size="xs" c="var(--on-surface-variant)">
                  {t("settings.terminal.fontSize")}
                </Text>
                <NumberInput
                  min={FONT_SIZE_MIN}
                  max={FONT_SIZE_MAX}
                  value={fontSizeDraft}
                  onChange={(value) => setFontSizeDraft(typeof value === "number" ? value : Number(value))}
                  onBlur={() => commitFontSize()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") commitFontSize();
                  }}
                  size="xs"
                  w={84}
                  aria-label={t("settings.terminal.fontSizeValue")}
                />
              </Group>
              <Slider
                min={FONT_SIZE_MIN}
                max={FONT_SIZE_MAX}
                step={1}
                value={fontSizeDraft}
                onChange={setFontSizeDraft}
                onChangeEnd={(value) => commitFontSize(value)}
                color="cliPrimary"
                aria-label={t("settings.terminal.fontSizeSlider")}
              />
              <Text size="xs" c="var(--text-muted)">
                {t("settings.terminal.fontSizeDescription")}
              </Text>
            </Stack>

            <Stack gap={6}>
              <Group justify="space-between" align="center">
                <Group gap={6}>
                  <Text size="xs" c="var(--on-surface-variant)">
                    {t("settings.terminal.scrollbackRows")}
                  </Text>
                  <Tooltip
                    multiline
                    w={320}
                    label={
                      <Stack gap={4}>
                        <Text size="xs" c="inherit">{t("settings.terminal.scrollbackMemoryHint")}</Text>
                        <Text size="xs" c="inherit">{t("settings.terminal.scrollbackMultiHint")}</Text>
                        <Text size="xs" c="inherit">
                          {t("settings.terminal.scrollbackCodexHint")}
                        </Text>
                      </Stack>
                    }
                  >
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      size="xs"
                      radius="xl"
                      aria-label={t("settings.terminal.scrollbackHelpAria")}
                    >
                      <CircleHelp size={14} strokeWidth={1.8} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
                <NumberInput
                  min={TERMINAL_SCROLLBACK_ROWS_MIN}
                  max={TERMINAL_SCROLLBACK_ROWS_MAX}
                  step={1000}
                  value={terminalScrollbackRowsDraft}
                  onChange={(value) => setTerminalScrollbackRowsDraft(typeof value === "number" ? value : Number(value))}
                  onBlur={() => commitTerminalScrollbackRows()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") commitTerminalScrollbackRows();
                  }}
                  size="xs"
                  w={104}
                  aria-label={t("settings.terminal.scrollbackValue")}
                />
              </Group>
              <Slider
                min={TERMINAL_SCROLLBACK_ROWS_MIN}
                max={TERMINAL_SCROLLBACK_ROWS_MAX}
                step={1000}
                value={terminalScrollbackRowsDraft}
                onChange={setTerminalScrollbackRowsDraft}
                onChangeEnd={(value) => commitTerminalScrollbackRows(value)}
                color="cliPrimary"
                aria-label={t("settings.terminal.scrollbackSlider")}
              />
              <Text size="xs" c="var(--text-muted)">
                {t("settings.terminal.scrollbackDescription")}
              </Text>
            </Stack>

            <FontFamilySelect
              label={t("settings.terminal.fontFamily")}
              value={fontFamily}
              onChange={(value) => {
                if (value) void update("fontFamily", value);
              }}
              data={fontFamilyOptions}
              maxDropdownHeight={320}
              nothingFoundMessage={systemFontsLoading ? t("settings.general.uiFontLoading") : t("settings.general.uiFontEmpty")}
              size="xs"
              aria-label={t("settings.terminal.fontFamily")}
              description={
                systemFontsError ??
                t("settings.terminal.fontDescription", { count: systemFonts.length })
              }
            />

            <Select<string>
              label={t("settings.terminal.defaultShell")}
              value={shellSelectValue}
              onChange={(value) => {
                if (value) void update("defaultShell", value);
              }}
              data={shellOptions}
              allowDeselect={false}
              size="xs"
              aria-label={t("settings.terminal.defaultShell")}
            />

            <Select<UnsplitBehavior>
              label={t("settings.terminal.unsplitBehavior")}
              value={unsplitBehavior}
              onChange={(value) => {
                if (value) void update("unsplitBehavior", value);
              }}
              data={UNSPLIT_OPTIONS.map((option) => ({ ...option, label: t(option.label) }))}
              allowDeselect={false}
              size="xs"
              aria-label={t("settings.terminal.unsplitBehavior")}
              description={t("settings.terminal.unsplitDescription")}
            />

            <Card className="border border-border bg-surface-container-lowest" p="sm" radius="lg">
              <Group justify="space-between" align="center" gap="md" wrap="nowrap">
                <Box>
                  <Text size="xs" c="var(--on-surface-variant)">
                    {t("settings.terminal.externalPowerShell")}
                  </Text>
                  <Text mt={4} size="xs" c="var(--text-muted)">
                    {t("settings.terminal.externalPowerShellDescription")}
                  </Text>
                </Box>
                <Switch
                  color="cliPrimary"
                  checked={useExternalTerminal}
                  onChange={(event) => void update("useExternalTerminal", event.currentTarget.checked)}
                  aria-label={useExternalTerminal ? t("settings.terminal.disableExternalPowerShell") : t("settings.terminal.enableExternalPowerShell")}
                />
              </Group>
            </Card>

            <Card className="border border-border bg-surface-container-lowest" p="sm" radius="lg">
              <Group justify="space-between" align="center" gap="md" wrap="nowrap">
                <Box>
                  <Text size="xs" c="var(--on-surface-variant)">
                    {t("settings.terminal.shellMonitoring")}
                  </Text>
                  <Text mt={4} size="xs" c="var(--text-muted)">
                    {t("settings.terminal.shellMonitoringDescription")}
                  </Text>
                </Box>
                <Switch
                  color="cliPrimary"
                  checked={shellRuntimeMonitoringEnabled}
                  onChange={(event) => void update("shellRuntimeMonitoringEnabled", event.currentTarget.checked)}
                  aria-label={shellRuntimeMonitoringEnabled ? t("settings.terminal.disableShellMonitoring") : t("settings.terminal.enableShellMonitoring")}
                />
              </Group>
            </Card>

            <Card className="border border-border bg-surface-container-lowest" p="sm" radius="lg">
              <Group justify="space-between" align="center" gap="md" wrap="nowrap">
                <Box>
                  <Text size="xs" c="var(--on-surface-variant)">
                    {t("settings.terminal.batchPane")}
                  </Text>
                  <Text mt={4} size="xs" c="var(--text-muted)">
                    {t("settings.terminal.batchPaneDescription")}
                  </Text>
                </Box>
                <Switch
                  color="cliPrimary"
                  checked={batchLaunchGroupInPane}
                  onChange={(event) => void update("batchLaunchGroupInPane", event.currentTarget.checked)}
                  aria-label={batchLaunchGroupInPane ? t("settings.terminal.disableBatchPane") : t("settings.terminal.enableBatchPane")}
                />
              </Group>
              {batchLaunchGroupInPane && (
                <Group mt="sm" justify="space-between" align="center">
                  <Text size="xs" c="var(--on-surface-variant)">
                    {t("settings.terminal.splitDirection")}
                  </Text>
                  <SegmentedControl<BatchLaunchPaneDirection>
                    value={batchLaunchPaneDirection}
                    onChange={(value) => void update("batchLaunchPaneDirection", value)}
                    data={[
                      { value: "vertical", label: t("settings.terminal.splitVertical") },
                      { value: "horizontal", label: t("settings.terminal.splitHorizontal") },
                    ]}
                    color="cliPrimary"
                    size="xs"
                    aria-label={t("settings.terminal.splitDirectionAria")}
                  />
                </Group>
              )}
            </Card>
          </Stack>
        </section>

        {terminalPreview}

        <section className="ui-surface-card rounded-2xl border border-border p-4 xl:col-start-1 xl:row-start-2">
          <Stack gap="md">
            <Stack gap={6}>
              <Text size="sm" fw={600} c="var(--on-surface)">
                {t("settings.terminal.themeMode")}
              </Text>
              <SegmentedControl<"follow-app" | "independent">
                value={terminalThemeMode}
                onChange={(value) => void setTerminalThemeMode(value)}
                data={[
                  { value: "follow-app", label: t("settings.terminal.followApp") },
                  { value: "independent", label: t("settings.terminal.independent") },
                ]}
                color="cliPrimary"
                aria-label={t("settings.terminal.themeModeAria")}
              />
              <Text size="xs" c="var(--on-surface-variant)">
                {terminalThemeMode === "follow-app"
                  ? t("settings.terminal.followAppDescription")
                  : t("settings.terminal.independentDescription")}
              </Text>
            </Stack>

            <Group align="flex-end" justify="space-between" gap="md">
              <Text size="sm" fw={600} c="var(--on-surface)">
                {t("settings.terminal.themeLibrary")}
              </Text>
              <TextInput
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
                placeholder={t("settings.terminal.themeSearchPlaceholder")}
                size="xs"
                w={220}
                aria-label={t("settings.terminal.themeSearchAria")}
                disabled={terminalThemeMode !== "independent"}
              />
            </Group>

            <Stack gap="md">
            {groupedThemes.map((group) => (
              <section key={group.id}>
                <Group mb="xs" gap="xs" align="baseline">
                  <Text size="xs" fw={600} c="var(--on-surface)">
                    {t(TERMINAL_THEME_GROUP_LABEL_KEYS[group.id]?.name ?? "settings.terminal.group.cool.name")}
                  </Text>
                  <Text size="xs" c="var(--text-muted)">
                    {t(TERMINAL_THEME_GROUP_LABEL_KEYS[group.id]?.description ?? "settings.terminal.group.cool.description")}
                  </Text>
                </Group>
                <SimpleGrid cols={{ base: 1, sm: 2, xl: 3 }} spacing="xs">
                  {group.presets.map((preset) => {
                    const active = terminalThemeMode === "independent" && terminalThemeName === preset.id;
                    return (
                      <UnstyledButton
                        key={preset.id}
                        onClick={() => {
                          void update("terminalThemeName", preset.id);
                        }}
                        className="ui-interactive ui-focus-ring ui-selection-card relative rounded-xl border p-4 text-left transition-[transform,box-shadow,border-color,background-color]"
                        data-selected={active ? "true" : "false"}
                        disabled={terminalThemeMode !== "independent"}
                        aria-pressed={active}
                        w="100%"
                        style={{
                          display: "block",
                          minHeight: 108,
                          minWidth: 0,
                          overflow: "hidden",
                          whiteSpace: "normal",
                          backgroundColor: active
                            ? "color-mix(in srgb, var(--primary) 6%, var(--surface-container-lowest))"
                            : "var(--surface-container-lowest)",
                          borderColor: active
                            ? "color-mix(in srgb, var(--primary) 56%, var(--border))"
                            : "color-mix(in srgb, var(--border) 88%, transparent)",
                          boxShadow: active
                            ? "0 2px 8px color-mix(in srgb, var(--primary) 8%, transparent), inset 0 0 0 1px color-mix(in srgb, var(--primary) 24%, transparent)"
                            : "0 2px 8px color-mix(in srgb, var(--on-surface) 6%, transparent), inset 0 1px 0 color-mix(in srgb, #fff 12%, transparent)",
                        }}
                      >
                        {active && (
                          <Badge
                            className="absolute right-3 top-3"
                            size="xs"
                            variant="light"
                            style={{
                              backgroundColor: "color-mix(in srgb, var(--primary) 10%, transparent)",
                              border: "1px solid color-mix(in srgb, var(--primary) 22%, transparent)",
                              color: "var(--primary)",
                            }}
                          >
                            {t("settings.current")}
                          </Badge>
                        )}
                        <Stack gap={8} pr={active ? 48 : 0} style={{ minWidth: 0, padding: "4px 8px 2px" }}>
                          <Stack gap={2}>
                            <Text
                              size="sm"
                              fw={600}
                              c={active ? "var(--on-surface)" : "var(--on-surface-variant)"}
                              style={{ whiteSpace: "normal", overflowWrap: "anywhere", lineHeight: 1.25 }}
                            >
                              {preset.name}
                            </Text>
                            <Text
                              size="xs"
                              lh={1.55}
                              c={active ? "var(--on-surface-variant)" : "var(--text-muted)"}
                              style={{ whiteSpace: "normal", overflowWrap: "anywhere" }}
                            >
                              {preset.tone === "light" ? t("settings.terminal.toneLight") : t("settings.terminal.toneDark")}{preset.family ? ` · ${preset.family}` : ""}
                            </Text>
                          </Stack>
                          <Group gap={6}>
                            {SWATCH_KEYS.map((key) => (
                              <Box
                                key={key}
                                component="span"
                                w={16}
                                h={16}
                                className="h-4 w-4 rounded-[4px] border"
                                style={{
                                  backgroundColor:
                                    (preset.theme as Record<string, string | undefined>)[key] ??
                                    "var(--surface-container-lowest)",
                                  borderColor: active ? "color-mix(in srgb, var(--primary) 48%, var(--border))" : "var(--border)",
                                  boxShadow: "none",
                                }}
                              />
                            ))}
                          </Group>
                        </Stack>
                      </UnstyledButton>
                    );
                  })}
                </SimpleGrid>
              </section>
            ))}
            {filtered.length === 0 && (
              <Card className="border border-dashed border-border bg-surface-container-lowest text-center" p="lg" radius="lg">
                <Text size="xs" c="var(--on-surface-variant)">
                  {t("settings.terminal.noTheme")}
                </Text>
              </Card>
            )}
            </Stack>
          {terminalThemeMode !== "independent" && (
            <Card className="border border-border bg-surface-container-low" p="sm" radius="lg">
              <Text size="xs" c="var(--on-surface-variant)">
                {t("settings.terminal.followModeHint")}
              </Text>
            </Card>
          )}
          </Stack>
        </section>

        <div className="min-w-0 xl:col-start-1 xl:row-start-3">
          <TerminalBackgroundSection />
        </div>
      </section>
    </Stack>
  );
}
