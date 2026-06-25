import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { ActionIcon, Badge, Box, Button, Card, Group, SimpleGrid, Stack, Switch, Text, TextInput } from "@mantine/core";
import { Play, CheckCircle, HelpCircle, ChevronDown, ChevronUp, Folder, FileCode, Copy, Check, X, Activity, Bell, ShieldAlert, ToggleRight, AlertTriangle, BellOff, XCircle, Layers } from "lucide-react";
import { useSettingsStore, type HookEventType } from "@/stores/settingsStore";
import { useI18n, type TranslationKey } from "@/lib/i18n";

type HookInstallStatus = "directoryMissing" | "notInstalled" | "partialInstalled" | "installed";

interface ToolHookSettingsStatus {
  configDir: string | null;
  hooksDir: string | null;
  configPath: string | null;
  featureConfigPath: string | null;
  status: HookInstallStatus;
  attentionScriptInstalled: boolean;
  finishedScriptInstalled: boolean;
  sessionStartHookInstalled: boolean;
  runningHookInstalled: boolean;
  attentionHookInstalled: boolean;
  stopHookInstalled: boolean;
  failureHookInstalled: boolean;
  subagentStartHookInstalled: boolean;
  hooksFeatureInstalled: boolean;
}

interface HookSettingsStatus {
  claude: ToolHookSettingsStatus;
  codex: ToolHookSettingsStatus;
  ccSwitch: CcSwitchHookProtectionStatus;
  claudeAutoRepaired: boolean;
}

type CcSwitchHookProtectionState =
  | "notDetected"
  | "notSynced"
  | "synced"
  | "invalidDb"
  | "unavailable"
  | "syncFailed";

interface CcSwitchHookProtectionStatus {
  state: CcSwitchHookProtectionState;
  dbPath: string | null;
  message: string | null;
  wslMismatch: boolean;
}

const STATUS_LABELS: Record<HookInstallStatus, TranslationKey> = {
  directoryMissing: "settings.hooks.status.directoryMissing",
  notInstalled: "settings.hooks.status.notInstalled",
  partialInstalled: "settings.hooks.status.partialInstalled",
  installed: "settings.hooks.status.installed",
};

const STATUS_COLORS: Record<HookInstallStatus, string> = {
  directoryMissing: "yellow",
  notInstalled: "gray",
  partialInstalled: "yellow",
  installed: "green",
};

const CCSWITCH_STATE_LABELS: Record<CcSwitchHookProtectionState, TranslationKey> = {
  notDetected: "settings.hooks.cc.notDetected",
  notSynced: "settings.hooks.cc.notSynced",
  synced: "settings.hooks.cc.synced",
  invalidDb: "settings.hooks.cc.invalidDb",
  unavailable: "settings.hooks.cc.unavailable",
  syncFailed: "settings.hooks.cc.syncFailed",
};

const CCSWITCH_STATE_COLORS: Record<CcSwitchHookProtectionState, string> = {
  notDetected: "gray",
  notSynced: "yellow",
  synced: "green",
  invalidDb: "red",
  unavailable: "yellow",
  syncFailed: "red",
};


function formatPath(value: string | null, fallback: string): string {
  return value && value.trim() ? value : fallback;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatCcSwitchMessage(message: string | null, t: (key: TranslationKey) => string): string | null {
  if (!message) return null;
  const messages: Record<string, TranslationKey> = {
    db_not_found: "settings.hooks.cc.dbNotFound",
    unsupported_format: "settings.hooks.cc.unsupportedFormat",
    wsl_environment_mismatch: "settings.hooks.cc.wslMismatch",
    common_config_parse_failed: "settings.hooks.cc.commonParseFailed",
  };
  return messages[message] ? t(messages[message]) : message;
}

function getCcSwitchProtectionDescription(
  status: CcSwitchHookProtectionStatus | null | undefined,
  t: (key: TranslationKey) => string
): string {
  if (!status) return t("settings.hooks.cc.detecting");
  switch (status.state) {
    case "synced":
      return t("settings.hooks.cc.syncedDescription");
    case "notSynced":
      return t("settings.hooks.cc.notSyncedDescription");
    case "notDetected":
      return t("settings.hooks.cc.notDetectedDescription");
    case "invalidDb":
      return t("settings.hooks.cc.invalidDbDescription");
    case "unavailable":
      return status.wslMismatch
        ? t("settings.hooks.cc.wslMismatchDescription")
        : t("settings.hooks.cc.unavailableDescription");
    case "syncFailed":
      return t("settings.hooks.cc.syncFailedDescription");
  }
}

function CcSwitchProtectionCard({ status }: { status?: CcSwitchHookProtectionStatus | null }) {
  const { t } = useI18n();
  const state = status?.state ?? "notDetected";
  const isHealthy = state === "synced";
  const isWarning = state === "notSynced" || state === "unavailable";
  const Icon = isHealthy ? CheckCircle : isWarning || state === "notDetected" ? HelpCircle : AlertTriangle;
  const formattedMessage = formatCcSwitchMessage(status?.message ?? null, t);

  return (
    <Card className="border border-border bg-surface-container-low" p="sm" radius="lg">
      <Stack gap="xs">
        <Group justify="space-between" gap="sm" align="flex-start">
          <Group gap="sm" wrap="nowrap" className="min-w-0">
            <Box
              style={{
                color: isHealthy
                  ? "var(--success)"
                  : state === "syncFailed" || state === "invalidDb"
                    ? "var(--error)"
                    : "var(--warning)",
                marginTop: 2,
                flexShrink: 0,
              }}
            >
              <Icon size={18} />
            </Box>
            <Box className="min-w-0">
              <Text size="sm" fw={500} c="var(--on-surface)">
                {t("settings.hooks.cc.protection")}
              </Text>
              <Text mt={4} size="xs" c="var(--on-surface-variant)">
                {getCcSwitchProtectionDescription(status, t)}
              </Text>
            </Box>
          </Group>
          <Badge variant="light" color={CCSWITCH_STATE_COLORS[state]} radius="xl" className="shrink-0">
            {t(CCSWITCH_STATE_LABELS[state])}
          </Badge>
        </Group>
        {status?.dbPath && (
          <Text
            component="code"
            size="xs"
            ff="var(--font-ui-mono)"
            c="var(--on-surface-variant)"
            className="break-all"
          >
            {status.dbPath}
          </Text>
        )}
        {formattedMessage && (
          <Text size="xs" c={state === "syncFailed" || state === "invalidDb" ? "red" : "yellow"}>
            {formattedMessage}
          </Text>
        )}
      </Stack>
    </Card>
  );
}

function PathRow({ label, value }: { label: string; value: string | null }) {
  const { t } = useI18n();
  const formatted = formatPath(value, t("settings.hooks.notSelected"));
  const hasValue = Boolean(value && value.trim());
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!hasValue || !value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getIcon = () => {
    if (
      label === t("settings.hooks.claudeConfigDir") ||
      label === t("settings.hooks.codexConfigDir") ||
      label === t("settings.hooks.hooksDir")
    ) return <Folder size={16} />;
    if (label.includes('json') || label.includes('toml')) return <FileCode size={16} />;
    return <FileCode size={16} />;
  };

  return (
    <Card className="border border-border/50 bg-surface-container-lowest" p="sm" radius="md">
      <Group gap="xs" wrap="nowrap" align="flex-start">
        <Box
          style={{
            color: hasValue ? "var(--primary)" : "var(--text-muted)",
            marginTop: 2,
          }}
        >
          {getIcon()}
        </Box>
        <Stack gap={4} className="min-w-0 flex-1">
          <Text size="xs" fw={500} c="var(--on-surface-variant)">
            {label}
          </Text>
          <Text
            component="code"
            size="xs"
            ff="var(--font-ui-mono)"
            c={hasValue ? "var(--on-surface)" : "var(--text-muted)"}
            className="min-w-0 break-all leading-5"
            title={formatted}
          >
            {formatted}
          </Text>
        </Stack>
        {hasValue && (
          <Button
            variant="subtle"
            color="gray"
            size="compact-xs"
            onClick={handleCopy}
            className="shrink-0"
            aria-label={t("settings.hooks.copyPath")}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </Button>
        )}
      </Group>
    </Card>
  );
}

interface HookCardProps {
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  notifyEnabled?: boolean;
  onToggleNotify?: () => void;
  notifyDisabled?: boolean;
}

function HookCard({ icon, label, checked, notifyEnabled, onToggleNotify, notifyDisabled }: HookCardProps) {
  const { t } = useI18n();
  return (
    <Card
      className="border transition-colors"
      p="md"
      radius="lg"
      style={{
        borderColor: checked ? "var(--success)" : "var(--border)",
        backgroundColor: checked ? "var(--success-container)" : "var(--surface-container-low)",
      }}
    >
      <Stack gap={8} align="center">
        <Box
          style={{
            color: checked ? "var(--success)" : "var(--text-muted)",
            fontSize: 26,
            lineHeight: 1,
          }}
        >
          {icon}
        </Box>
        <Text size="xs" fw={500} c={checked ? "var(--on-success-container)" : "var(--on-surface-variant)"} ta="center" lh={1.3}>
          {label}
        </Text>
        <Group gap={4} align="center" wrap="nowrap">
          <Badge
            variant="filled"
            color={checked ? "green" : "gray"}
            radius="xl"
            size="xs"
          >
            {checked ? t("settings.hooks.status.installed") : t("settings.hooks.status.notInstalled")}
          </Badge>
          {onToggleNotify && (
            <ActionIcon
              variant={notifyEnabled ? "light" : "subtle"}
              color={notifyEnabled ? "blue" : "gray"}
              size="sm"
              radius="xl"
              onClick={(e) => { e.stopPropagation(); onToggleNotify(); }}
              disabled={notifyDisabled}
              aria-label={t("settings.hooks.systemNotificationAria", { label })}
            >
              {notifyEnabled ? <Bell size={12} /> : <BellOff size={12} />}
            </ActionIcon>
          )}
        </Group>
      </Stack>
    </Card>
  );
}

function StatusPill({ status }: { status: HookInstallStatus }) {
  const { t } = useI18n();
  return (
    <Badge variant="light" color={STATUS_COLORS[status]} radius="xl">
      {t(STATUS_LABELS[status])}
    </Badge>
  );
}

function SettingsSwitchRow({
  title,
  description,
  checked,
  onCheckedChange,
  icon: Icon,
  tools,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  icon?: React.ComponentType<{ size?: number }>;
  tools?: ("claude" | "codex")[];
}) {
  return (
    <Card className="border border-border bg-surface-container-low" p="sm" radius="lg">
      <Group justify="space-between" align="center" gap="md" wrap="nowrap">
        <Group gap="sm" wrap="nowrap" className="min-w-0">
          {Icon && (
            <Box
              style={{
                color: checked ? "var(--primary)" : "var(--text-muted)",
                marginTop: 2,
                flexShrink: 0,
              }}
            >
              <Icon size={18} />
            </Box>
          )}
          <Box className="min-w-0">
            <Group gap="xs" align="center" wrap="wrap">
              <Text size="sm" fw={500} c="var(--on-surface)" className="whitespace-nowrap">
                {title}
              </Text>
              {tools?.map((tool) => (
                <Badge
                  key={tool}
                  variant="light"
                  size="xs"
                  color={tool === "claude" ? "orange" : "blue"}
                  style={{ textTransform: "none" }}
                >
                  {tool === "claude" ? "Claude" : "Codex"}
                </Badge>
              ))}
            </Group>
            <Text mt={4} size="xs" c="var(--text-muted)">
              {description}
            </Text>
          </Box>
        </Group>
        <Switch
          color="cliPrimary"
          className="shrink-0"
          checked={checked}
          onChange={(event) => onCheckedChange(event.currentTarget.checked)}
          aria-label={title}
        />
      </Group>
    </Card>
  );
}

export function HookSettingsPage() {
  const { t } = useI18n();
  const claudeHookConfigDir = useSettingsStore((s) => s.claudeHookConfigDir);
  const codexHookConfigDir = useSettingsStore((s) => s.codexHookConfigDir);
  const [status, setStatus] = useState<HookSettingsStatus | null>(null);
  const [selectedDir, setSelectedDir] = useState<string | null>(claudeHookConfigDir);
  const [codexSelectedDir, setCodexSelectedDir] = useState<string | null>(codexHookConfigDir);
  const [loading, setLoading] = useState(false);
  const [claudeWorking, setClaudeWorking] = useState(false);
  const [codexWorking, setCodexWorking] = useState(false);
  const hookPopupNotificationsEnabled = useSettingsStore((s) => s.hookPopupNotificationsEnabled);
  const hookPopupAutoCloseEnabled = useSettingsStore((s) => s.hookPopupAutoCloseEnabled);
  const hookPopupAutoCloseSeconds = useSettingsStore((s) => s.hookPopupAutoCloseSeconds);
  const systemNotificationsEnabled = useSettingsStore((s) => s.systemNotificationsEnabled);
  const systemNotificationEvents = useSettingsStore((s) => s.systemNotificationEvents);
  const ccSwitchDbPath = useSettingsStore((s) => s.ccSwitchDbPath);
  const claudeHookAutoRepairKnownInstalled = useSettingsStore((s) => s.claudeHookAutoRepairKnownInstalled);
  const claudeHookAutoRepairNoticeShown = useSettingsStore((s) => s.claudeHookAutoRepairNoticeShown);
  const updateSetting = useSettingsStore((s) => s.update);
  const [autoCloseSecondsDraft, setAutoCloseSecondsDraft] = useState(String(hookPopupAutoCloseSeconds));
  const [claudePathsOpen, setClaudePathsOpen] = useState(false);
  const [claudeInfoOpen, setClaudeInfoOpen] = useState(false);
  const [codexPathsOpen, setCodexPathsOpen] = useState(false);
  const [codexInfoOpen, setCodexInfoOpen] = useState(false);

  useEffect(() => {
    setAutoCloseSecondsDraft(String(hookPopupAutoCloseSeconds));
  }, [hookPopupAutoCloseSeconds]);

  const selectedDirArg = useMemo(() => selectedDir ?? undefined, [selectedDir]);
  const codexSelectedDirArg = useMemo(() => codexSelectedDir ?? undefined, [codexSelectedDir]);

  const refreshStatus = async (dir = selectedDirArg, codexDir = codexSelectedDirArg) => {
    setLoading(true);
    try {
      const nextStatus = await invoke<HookSettingsStatus>("hook_settings_get_status", {
        selectedDir: dir,
        codexSelectedDir: codexDir,
        ccSwitchDbPath: ccSwitchDbPath ?? undefined,
        autoRepair: claudeHookAutoRepairKnownInstalled,
      });
      setStatus(nextStatus);
      if (nextStatus.claude.configDir) {
        setSelectedDir(nextStatus.claude.configDir);
      }
      if (nextStatus.codex.configDir) {
        setCodexSelectedDir(nextStatus.codex.configDir);
      }
      if (nextStatus.claudeAutoRepaired && !claudeHookAutoRepairNoticeShown) {
        toast.info(t("settings.hooks.autoRepaired"), {
          description: t("settings.hooks.autoRepairedDescription"),
        });
        await updateSetting("claudeHookAutoRepairNoticeShown", true);
      }
    } catch (error) {
      toast.error(t("settings.hooks.refreshFailed"), { description: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshStatus();
  }, []);

  const handleSelectDir = async () => {
    try {
      const dir = await invoke<string | null>("hook_settings_select_dir", {
        title: t("settings.hooks.selectClaudeDir"),
      });
      if (!dir) return;
      setSelectedDir(dir);
      await updateSetting("claudeHookConfigDir", dir);
      await refreshStatus(dir, codexSelectedDirArg);
    } catch (error) {
      toast.error(t("settings.hooks.selectDirFailed"), { description: getErrorMessage(error) });
    }
  };

  const handleSelectCodexDir = async () => {
    try {
      const dir = await invoke<string | null>("hook_settings_select_dir", {
        title: t("settings.hooks.selectCodexDir"),
      });
      if (!dir) return;
      setCodexSelectedDir(dir);
      await updateSetting("codexHookConfigDir", dir);
      await refreshStatus(selectedDirArg, dir);
    } catch (error) {
      toast.error(t("settings.hooks.selectCodexDirFailed"), { description: getErrorMessage(error) });
    }
  };

  // 手动粘贴配置目录（支持 WSL UNC，如 \\wsl.localhost\Ubuntu-22.04\home\<用户名>\.claude）。
  // 原生选目录弹窗进 WSL 路径体验差，故提供文本输入兜底。
  const handleManualClaudeDirCommit = async (raw: string) => {
    const dir = raw.trim() || null;
    setSelectedDir(dir);
    await updateSetting("claudeHookConfigDir", dir);
    await refreshStatus(dir ?? undefined, codexSelectedDirArg);
  };

  const handleManualCodexDirCommit = async (raw: string) => {
    const dir = raw.trim() || null;
    setCodexSelectedDir(dir);
    await updateSetting("codexHookConfigDir", dir);
    await refreshStatus(selectedDirArg, dir ?? undefined);
  };

  const handleClaudeInstall = async () => {
    setClaudeWorking(true);
    try {
      const nextStatus = await invoke<HookSettingsStatus>("hook_settings_install", {
        selectedDir: selectedDirArg,
        codexSelectedDir: codexSelectedDirArg,
        ccSwitchDbPath: ccSwitchDbPath ?? undefined,
      });
      setStatus(nextStatus);
      if (nextStatus.claude.configDir) setSelectedDir(nextStatus.claude.configDir);
      await updateSetting("claudeHookAutoRepairKnownInstalled", true);
      await updateSetting("claudeHookAutoRepairNoticeShown", false);
      toast.success(t("settings.hooks.claudeInstalled"), {
        description: getCcSwitchProtectionDescription(nextStatus.ccSwitch, t),
      });
    } catch (error) {
      toast.error(t("settings.hooks.claudeInstallFailed"), { description: getErrorMessage(error) });
    } finally {
      setClaudeWorking(false);
    }
  };

  const handleClaudeUninstall = async () => {
    setClaudeWorking(true);
    try {
      const nextStatus = await invoke<HookSettingsStatus>("hook_settings_uninstall", {
        selectedDir: selectedDirArg,
        codexSelectedDir: codexSelectedDirArg,
        ccSwitchDbPath: ccSwitchDbPath ?? undefined,
      });
      setStatus(nextStatus);
      if (nextStatus.claude.configDir) setSelectedDir(nextStatus.claude.configDir);
      await updateSetting("claudeHookAutoRepairKnownInstalled", false);
      await updateSetting("claudeHookAutoRepairNoticeShown", false);
      toast.success(t("settings.hooks.claudeDeleted"));
    } catch (error) {
      toast.error(t("settings.hooks.claudeDeleteFailed"), { description: getErrorMessage(error) });
    } finally {
      setClaudeWorking(false);
    }
  };

  const handleCodexInstall = async () => {
    setCodexWorking(true);
    try {
      const nextStatus = await invoke<HookSettingsStatus>("hook_settings_install_codex", {
        selectedDir: selectedDirArg,
        codexSelectedDir: codexSelectedDirArg,
        ccSwitchDbPath: ccSwitchDbPath ?? undefined,
      });
      setStatus(nextStatus);
      if (nextStatus.codex.configDir) setCodexSelectedDir(nextStatus.codex.configDir);
      toast.success(t("settings.hooks.codexInstalled"), {
        description: getCcSwitchProtectionDescription(nextStatus.ccSwitch, t),
      });
    } catch (error) {
      toast.error(t("settings.hooks.codexInstallFailed"), { description: getErrorMessage(error) });
    } finally {
      setCodexWorking(false);
    }
  };

  const handleCodexUninstall = async () => {
    setCodexWorking(true);
    try {
      const nextStatus = await invoke<HookSettingsStatus>("hook_settings_uninstall_codex", {
        selectedDir: selectedDirArg,
        codexSelectedDir: codexSelectedDirArg,
        ccSwitchDbPath: ccSwitchDbPath ?? undefined,
      });
      setStatus(nextStatus);
      if (nextStatus.codex.configDir) setCodexSelectedDir(nextStatus.codex.configDir);
      toast.success(t("settings.hooks.codexDeleted"));
    } catch (error) {
      toast.error(t("settings.hooks.codexDeleteFailed"), { description: getErrorMessage(error) });
    } finally {
      setCodexWorking(false);
    }
  };

  const handleCommitAutoCloseSeconds = () => {
    const nextValue = Number(autoCloseSecondsDraft);
    const nextSeconds = Number.isFinite(nextValue) ? Math.round(nextValue) : hookPopupAutoCloseSeconds;
    const clampedSeconds = Math.max(5, Math.min(3600, nextSeconds));
    setAutoCloseSecondsDraft(String(clampedSeconds));
    if (clampedSeconds !== hookPopupAutoCloseSeconds) {
      void updateSetting("hookPopupAutoCloseSeconds", clampedSeconds);
    }
  };

  const claude = status?.claude;
  const codex = status?.codex;
  const ccSwitchProtection = status?.ccSwitch ?? null;
  const claudeStatus = claude?.status ?? "directoryMissing";
  const codexStatus = codex?.status ?? "directoryMissing";
  const claudeSessionStartInstalled = Boolean(claude?.attentionScriptInstalled && claude.sessionStartHookInstalled);
  const claudeRunningInstalled = Boolean(claude?.attentionScriptInstalled && claude.runningHookInstalled);
  const claudeAttentionInstalled = Boolean(claude?.attentionScriptInstalled && claude.attentionHookInstalled);
  // Claude — 拆分为独立事件
  const claudeStopInstalled = Boolean(claude?.finishedScriptInstalled && claude.stopHookInstalled);
  const claudeFailureInstalled = Boolean(claude?.finishedScriptInstalled && claude.failureHookInstalled);
  const claudeSubagentInstalled = Boolean(claude?.subagentStartHookInstalled);
  const codexSessionStartInstalled = Boolean(codex?.attentionScriptInstalled && codex.sessionStartHookInstalled);
  const codexRunningInstalled = Boolean(codex?.attentionScriptInstalled && codex.runningHookInstalled);
  const codexAttentionInstalled = Boolean(codex?.attentionScriptInstalled && codex.attentionHookInstalled);
  // Codex — 拆分为独立事件
  const codexStopInstalled = Boolean(codex?.finishedScriptInstalled && codex.stopHookInstalled);
  const codexSubagentInstalled = Boolean(codex?.subagentStartHookInstalled);

  // 切换一组 HookEventType 的系统通知状态
  const toggleNotifyEvents = (events: HookEventType[], enabled: boolean) => {
    const update = { ...systemNotificationEvents };
    for (const event of events) {
      update[event] = enabled;
    }
    void updateSetting("systemNotificationEvents", update);
  };
  const notifyState = (events: HookEventType[]) => events.every((e) => systemNotificationEvents[e]);

  return (
    <Stack gap="md">
      <section className="ui-surface-card rounded-2xl border border-border p-4">
        <Stack gap="md">
          <Box>
            <Text size="sm" fw={600} c="var(--on-surface)">
              {t("settings.hooks.popupSection")}
            </Text>
            <Text mt={4} size="xs" c="var(--on-surface-variant)">
              {t("settings.hooks.popupSectionDescription")}
            </Text>
          </Box>
          <SettingsSwitchRow
            title={t("settings.hooks.popup")}
            description={t("settings.hooks.popupDescription")}
            checked={hookPopupNotificationsEnabled}
            onCheckedChange={(checked) => void updateSetting("hookPopupNotificationsEnabled", checked)}
          />
          <SettingsSwitchRow
            title={t("settings.hooks.autoClose")}
            description={t("settings.hooks.autoCloseDescription")}
            checked={hookPopupAutoCloseEnabled}
            onCheckedChange={(checked) => void updateSetting("hookPopupAutoCloseEnabled", checked)}
          />
          <Card className="border border-border bg-surface-container-low" p="sm" radius="lg">
            <Group justify="space-between" align="center" gap="md">
              <Box>
                <Text size="sm" fw={500} c="var(--on-surface)">
                  {t("settings.hooks.defaultCloseTime")}
                </Text>
                <Text mt={4} size="xs" c="var(--text-muted)">
                  {t("settings.hooks.defaultCloseTimeDescription")}
                </Text>
              </Box>
              <Group gap="xs">
              <TextInput
                type="number"
                min={5}
                max={3600}
                step={1}
                value={autoCloseSecondsDraft}
                disabled={!hookPopupAutoCloseEnabled}
                onChange={(e) => setAutoCloseSecondsDraft(e.target.value)}
                onBlur={handleCommitAutoCloseSeconds}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCommitAutoCloseSeconds();
                  }
                }}
                w={96}
                size="xs"
                aria-label={t("settings.hooks.closeSecondsAria")}
              />
                <Text size="xs" c="var(--on-surface-variant)">
                  {t("settings.hooks.seconds")}
                </Text>
              </Group>
            </Group>
          </Card>
        </Stack>
      </section>

      <CcSwitchProtectionCard status={ccSwitchProtection} />

      <Card className="border border-border bg-surface-container-low" p="sm" radius="lg">
        <Group justify="space-between" align="center" gap="md">
          <Group gap="sm">
            <Bell
              size={16}
              style={{ color: systemNotificationsEnabled ? "var(--primary)" : "var(--text-muted)" }}
            />
            <Box>
              <Text size="sm" fw={500} c="var(--on-surface)">
                {t("settings.hooks.systemNotifications")}
              </Text>
              <Text size="xs" c="var(--on-surface-variant)">
                {t("settings.hooks.systemNotificationsDescription")}
              </Text>
            </Box>
          </Group>
          <Switch
            color="cliPrimary"
            checked={systemNotificationsEnabled}
            onChange={(event) => void updateSetting("systemNotificationsEnabled", event.currentTarget.checked)}
            aria-label={t("settings.hooks.enableSystemNotifications")}
          />
        </Group>
      </Card>

      <section className="ui-surface-card rounded-2xl border border-border p-4">
        <Stack gap="lg">
          <Group justify="space-between" align="flex-start" gap="md">
            <Box>
              <Text size="sm" fw={600} c="var(--on-surface)">
                {t("settings.hooks.claudeBridge")}
              </Text>
              <Text mt={4} size="xs" c="var(--on-surface-variant)">
                {t("settings.hooks.claudeBridgeDescription")}
              </Text>
            </Box>
            <StatusPill status={claudeStatus} />
          </Group>

          <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="md">
            <HookCard
              icon={<Play />}
              label={t("settings.hooks.event.sessionStart")}
              checked={claudeSessionStartInstalled}
              notifyEnabled={notifyState(["SessionStart"])}
              onToggleNotify={() => toggleNotifyEvents(["SessionStart"], !notifyState(["SessionStart"]))}
              notifyDisabled={!systemNotificationsEnabled}
            />
            <HookCard
              icon={<Activity />}
              label={t("settings.hooks.event.running")}
              checked={claudeRunningInstalled}
              notifyEnabled={notifyState(["UserPromptSubmit"])}
              onToggleNotify={() => toggleNotifyEvents(["UserPromptSubmit"], !notifyState(["UserPromptSubmit"]))}
              notifyDisabled={!systemNotificationsEnabled}
            />
            <HookCard
              icon={<Bell />}
              label={t("settings.hooks.event.attention")}
              checked={claudeAttentionInstalled}
              notifyEnabled={notifyState(["Notification"])}
              onToggleNotify={() => toggleNotifyEvents(["Notification"], !notifyState(["Notification"]))}
              notifyDisabled={!systemNotificationsEnabled}
            />
            <HookCard
              icon={<CheckCircle />}
              label={t("settings.hooks.event.complete")}
              checked={claudeStopInstalled}
              notifyEnabled={notifyState(["Stop"])}
              onToggleNotify={() => toggleNotifyEvents(["Stop"], !notifyState(["Stop"]))}
              notifyDisabled={!systemNotificationsEnabled}
            />
            <HookCard
              icon={<XCircle size={26} />}
              label={t("settings.hooks.event.failed")}
              checked={claudeFailureInstalled}
              notifyEnabled={notifyState(["StopFailure"])}
              onToggleNotify={() => toggleNotifyEvents(["StopFailure"], !notifyState(["StopFailure"]))}
              notifyDisabled={!systemNotificationsEnabled}
            />
            <HookCard
              icon={<Layers size={26} />}
              label={t("settings.hooks.event.subagent")}
              checked={claudeSubagentInstalled}
            />
          </SimpleGrid>

          <Group gap="xs">
            <Button
              variant="subtle"
              color="gray"
              size="xs"
              onClick={() => setClaudePathsOpen(!claudePathsOpen)}
              leftSection={claudePathsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            >
              {t("settings.hooks.viewPaths")}
            </Button>
            <Button
              variant="subtle"
              color="gray"
              size="xs"
              onClick={() => setClaudeInfoOpen(!claudeInfoOpen)}
              leftSection={<HelpCircle size={14} />}
            >
              {t("settings.hooks.installGuide")}
            </Button>
          </Group>

          {claudePathsOpen && (
            <Card className="bg-surface-container-low/50" p="sm" radius="lg">
              <Stack gap="xs">
                <PathRow label={t("settings.hooks.claudeConfigDir")} value={claude?.configDir ?? selectedDir} />
                <PathRow label={t("settings.hooks.hooksDir")} value={claude?.hooksDir ?? null} />
                <PathRow label="settings.json" value={claude?.configPath ?? null} />
              </Stack>
            </Card>
          )}

          {claudeInfoOpen && (
            <Card className="bg-surface-container-low/50" p="md" radius="lg">
              <Stack gap="md">
                <Group gap="sm" wrap="nowrap" align="flex-start">
                  <Box style={{ color: "var(--success)", marginTop: 2 }}>
                    <Check size={18} />
                  </Box>
                  <Stack gap={4}>
                    <Text size="xs" fw={500} c="var(--on-surface)">
                      {t("settings.hooks.installContent")}
                    </Text>
                    <Stack gap={2}>
                      <Group gap="xs">
                        <FileCode size={12} style={{ color: "var(--text-muted)" }} />
                        <Text size="xs" c="var(--on-surface-variant)" ff="var(--font-ui-mono)">
                          {t("settings.hooks.registerSettingsHook")}
                        </Text>
                      </Group>
                      <Group gap="xs">
                        <FileCode size={12} style={{ color: "var(--text-muted)" }} />
                        <Text size="xs" c="var(--on-surface-variant)">
                          {t("settings.hooks.pointsToApp")}
                        </Text>
                      </Group>
                    </Stack>
                  </Stack>
                </Group>

                <Group gap="sm" wrap="nowrap" align="flex-start">
                  <Box style={{ color: "var(--warning)", marginTop: 2 }}>
                    <X size={18} />
                  </Box>
                  <Stack gap={4}>
                    <Text size="xs" fw={500} c="var(--on-surface)">
                      {t("settings.hooks.keepOnDelete")}
                    </Text>
                    <Stack gap={2}>
                      <Text size="xs" c="var(--on-surface-variant)">
                        {t("settings.hooks.userHooks")}
                      </Text>
                      <Text size="xs" c="var(--on-surface-variant)">
                        {t("settings.hooks.otherHooks")}
                      </Text>

                    </Stack>
                  </Stack>
                </Group>
              </Stack>
            </Card>
          )}

          <TextInput
            size="xs"
            label={t("settings.hooks.claudeDirInput")}
            placeholder={t("settings.hooks.claudeDirPlaceholder")}
            value={selectedDir ?? ""}
            onChange={(e) => setSelectedDir(e.currentTarget.value || null)}
            onBlur={(e) => void handleManualClaudeDirCommit(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleManualClaudeDirCommit(e.currentTarget.value);
            }}
            disabled={loading || claudeWorking || codexWorking}
          />

          <Group gap="xs">
            <Button variant="light" color="cliPrimary" size="xs" onClick={handleSelectDir} disabled={loading || claudeWorking || codexWorking}>
              {t("settings.hooks.selectClaudeButton")}
            </Button>
            <Button color="cliPrimary" size="xs" onClick={handleClaudeInstall} disabled={loading || claudeWorking || claudeStatus === "directoryMissing"}>
              {claudeWorking ? t("settings.hooks.processing") : t("settings.hooks.installClaude")}
            </Button>
            <Button variant="light" color="red" size="xs" onClick={handleClaudeUninstall} disabled={loading || claudeWorking || claudeStatus === "directoryMissing"}>
              {t("settings.hooks.deleteClaude")}
            </Button>
            <Button variant="default" color="gray" size="xs" onClick={() => void refreshStatus()} disabled={loading || claudeWorking || codexWorking}>
              {loading ? t("settings.hooks.refreshing") : t("settings.hooks.refreshStatus")}
            </Button>
          </Group>
        </Stack>
      </section>

      <section className="ui-surface-card rounded-2xl border border-border p-4">
        <Stack gap="lg">
          <Group justify="space-between" align="flex-start" gap="md">
            <Box>
              <Text size="sm" fw={600} c="var(--on-surface)">
                {t("settings.hooks.codexBridge")}
              </Text>
              <Text mt={4} size="xs" c="var(--on-surface-variant)">
                {t("settings.hooks.codexBridgeDescription")}
              </Text>
            </Box>
            <StatusPill status={codexStatus} />
          </Group>

          <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="md">
            <HookCard
              icon={<Play />}
              label={t("settings.hooks.event.sessionStart")}
              checked={codexSessionStartInstalled}
              notifyEnabled={notifyState(["SessionStart"])}
              onToggleNotify={() => toggleNotifyEvents(["SessionStart"], !notifyState(["SessionStart"]))}
              notifyDisabled={!systemNotificationsEnabled}
            />
            <HookCard
              icon={<Activity />}
              label={t("settings.hooks.event.running")}
              checked={codexRunningInstalled}
              notifyEnabled={notifyState(["UserPromptSubmit"])}
              onToggleNotify={() => toggleNotifyEvents(["UserPromptSubmit"], !notifyState(["UserPromptSubmit"]))}
              notifyDisabled={!systemNotificationsEnabled}
            />
            <HookCard
              icon={<ShieldAlert />}
              label={t("settings.hooks.event.needsApproval")}
              checked={codexAttentionInstalled}
              notifyEnabled={notifyState(["PermissionRequest"])}
              onToggleNotify={() => toggleNotifyEvents(["PermissionRequest"], !notifyState(["PermissionRequest"]))}
              notifyDisabled={!systemNotificationsEnabled}
            />
            <HookCard
              icon={<CheckCircle />}
              label={t("settings.hooks.event.done")}
              checked={codexStopInstalled}
              notifyEnabled={notifyState(["Stop"])}
              onToggleNotify={() => toggleNotifyEvents(["Stop"], !notifyState(["Stop"]))}
              notifyDisabled={!systemNotificationsEnabled}
            />
            <HookCard
              icon={<Layers size={26} />}
              label={t("settings.hooks.event.subagent")}
              checked={codexSubagentInstalled}
            />
            <HookCard
              icon={<ToggleRight />}
              label={t("settings.hooks.event.hooksFeature")}
              checked={Boolean(codex?.hooksFeatureInstalled)}
            />
          </SimpleGrid>

          <Group gap="xs">
            <Button
              variant="subtle"
              color="gray"
              size="xs"
              onClick={() => setCodexPathsOpen(!codexPathsOpen)}
              leftSection={codexPathsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            >
              {t("settings.hooks.viewPaths")}
            </Button>
            <Button
              variant="subtle"
              color="gray"
              size="xs"
              onClick={() => setCodexInfoOpen(!codexInfoOpen)}
              leftSection={<HelpCircle size={14} />}
            >
              {t("settings.hooks.installGuide")}
            </Button>
          </Group>

          {codexPathsOpen && (
            <Card className="bg-surface-container-low/50" p="sm" radius="lg">
              <Stack gap="xs">
                <PathRow label={t("settings.hooks.codexConfigDir")} value={codex?.configDir ?? codexSelectedDir} />
                <PathRow label={t("settings.hooks.hooksDir")} value={codex?.hooksDir ?? null} />
                <PathRow label="hooks.json" value={codex?.configPath ?? null} />
                <PathRow label="config.toml" value={codex?.featureConfigPath ?? null} />
              </Stack>
            </Card>
          )}

          {codexInfoOpen && (
            <Card className="bg-surface-container-low/50" p="md" radius="lg">
              <Stack gap="md">
                <Group gap="sm" wrap="nowrap" align="flex-start">
                  <Box style={{ color: "var(--success)", marginTop: 2 }}>
                    <Check size={18} />
                  </Box>
                  <Stack gap={4}>
                    <Text size="xs" fw={500} c="var(--on-surface)">
                      {t("settings.hooks.installContent")}
                    </Text>
                    <Stack gap={2}>
                      <Group gap="xs">
                        <FileCode size={12} style={{ color: "var(--text-muted)" }} />
                        <Text size="xs" c="var(--on-surface-variant)" ff="var(--font-ui-mono)">
                          {t("settings.hooks.registerHooksJson")}
                        </Text>
                      </Group>
                      <Group gap="xs">
                        <FileCode size={12} style={{ color: "var(--text-muted)" }} />
                        <Text size="xs" c="var(--on-surface-variant)">
                          {t("settings.hooks.pointsToApp")}
                        </Text>
                      </Group>
                      <Group gap="xs">
                        <FileCode size={12} style={{ color: "var(--text-muted)" }} />
                        <Text size="xs" c="var(--on-surface-variant)">
                          {t("settings.hooks.enableCodexHooks")}
                        </Text>
                      </Group>
                    </Stack>
                  </Stack>
                </Group>

                <Group gap="sm" wrap="nowrap" align="flex-start">
                  <Box style={{ color: "var(--warning)", marginTop: 2 }}>
                    <AlertTriangle size={18} />
                  </Box>
                  <Stack gap={4}>
                    <Text size="xs" fw={500} c="var(--on-surface)">
                      {t("settings.hooks.codexNotes")}
                    </Text>
                    <Stack gap={2}>
                      <Text size="xs" c="var(--on-surface-variant)">
                        {t("settings.hooks.noProjectHooks")}
                      </Text>
                      <Text size="xs" c="var(--on-surface-variant)">
                        {t("settings.hooks.codexApprovalNote")}
                      </Text>
                    </Stack>
                  </Stack>
                </Group>
              </Stack>
            </Card>
          )}

          <TextInput
            size="xs"
            label={t("settings.hooks.codexDirInput")}
            placeholder={t("settings.hooks.codexDirPlaceholder")}
            value={codexSelectedDir ?? ""}
            onChange={(e) => setCodexSelectedDir(e.currentTarget.value || null)}
            onBlur={(e) => void handleManualCodexDirCommit(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleManualCodexDirCommit(e.currentTarget.value);
            }}
            disabled={loading || claudeWorking || codexWorking}
          />

          <Group gap="xs">
            <Button variant="light" color="cliPrimary" size="xs" onClick={handleSelectCodexDir} disabled={loading || claudeWorking || codexWorking}>
              {t("settings.hooks.selectCodexButton")}
            </Button>
            <Button color="cliPrimary" size="xs" onClick={handleCodexInstall} disabled={loading || codexWorking || codexStatus === "directoryMissing"}>
              {codexWorking ? t("settings.hooks.processing") : t("settings.hooks.installCodex")}
            </Button>
            <Button variant="light" color="red" size="xs" onClick={handleCodexUninstall} disabled={loading || codexWorking || codexStatus === "directoryMissing"}>
              {t("settings.hooks.deleteCodex")}
            </Button>
            <Button variant="default" color="gray" size="xs" onClick={() => void refreshStatus()} disabled={loading || claudeWorking || codexWorking}>
              {loading ? t("settings.hooks.refreshing") : t("settings.hooks.refreshStatus")}
            </Button>
          </Group>
        </Stack>
      </section>
    </Stack>
  );
}
