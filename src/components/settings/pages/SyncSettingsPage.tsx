import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Card,
  Checkbox,
  Group,
  Modal,
  PasswordInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  UnstyledButton,
} from "@mantine/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  useSyncStore,
  type AutoSyncAction,
  type SyncDataDomain,
  type SyncMode,
  type SyncPreview,
} from "../../../stores/syncStore";
import {
  Cloud,
  Download,
  Upload,
  AlertTriangle,
  Check,
  Folder,
} from "../../icons";
import { toast } from "sonner";
import { useI18n, type TranslationKey } from "../../../lib/i18n";

const SYNC_MODE_OPTIONS: { value: SyncMode; label: TranslationKey; description: TranslationKey }[] = [
  { value: "cloud", label: "settings.sync.mode.cloud", description: "settings.sync.mode.cloudDescription" },
  { value: "local", label: "settings.sync.mode.local", description: "settings.sync.mode.localDescription" },
];

const AUTO_SYNC_OPTIONS: { value: AutoSyncAction; label: TranslationKey }[] = [
  { value: "off", label: "settings.sync.auto.off" },
  { value: "upload", label: "settings.sync.auto.upload" },
  { value: "download", label: "settings.sync.auto.download" },
];

const DOMAIN_OPTIONS: { value: SyncDataDomain; label: TranslationKey }[] = [
  { value: "projects", label: "settings.sync.domain.projects" },
  { value: "groups", label: "settings.sync.domain.groups" },
  { value: "command_templates", label: "settings.sync.domain.commandTemplates" },
];

export function SyncSettingsPage() {
  const { language, t } = useI18n();
  const {
    webdavUrl,
    webdavUsername,
    hasPassword,
    status,
    lastSyncAt,
    conflictInfo,
    loaded,
    syncMode,
    localSyncDir,
    remoteDir,
    deviceName,
    knownDeviceNames,
    autoSyncOnStartup,
    autoSyncOnClose,
    load,
    setConfig,
    clearPassword,
    testConnection,
    setDeviceName,
    setAutoSyncOnStartup,
    setAutoSyncOnClose,
    upload,
    download,
    getPreview,
    resolveConflict,
    clearConflict,
    setSyncMode,
    setLocalSyncDir,
    setRemoteDir,
    localExport,
    localImport,
  } = useSyncStore();

  const [url, setUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deviceNameInput, setDeviceNameInput] = useState("");
  const [remoteDirInput, setRemoteDirInput] = useState("");
  const [preview, setPreview] = useState<SyncPreview | null>(null);
  const [previewMode, setPreviewMode] = useState<"upload" | "download" | null>(null);
  const [previewDeviceName, setPreviewDeviceName] = useState("");
  const [selectedDomains, setSelectedDomains] = useState<SyncDataDomain[]>([
    "projects",
    "groups",
    "command_templates",
  ]);
  const [showImportConfirm, setShowImportConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded) {
      void load();
    }
  }, [loaded, load]);

  useEffect(() => {
    if (loaded) {
      setUrl(webdavUrl);
      setUsername(webdavUsername);
      setDeviceNameInput(deviceName);
      setRemoteDirInput(remoteDir);
      setPreviewDeviceName(deviceName);
    }
  }, [loaded, webdavUrl, webdavUsername, deviceName, remoteDir]);

  const handleTest = async () => {
    if (!url.trim() || !username.trim() || !password.trim()) {
      toast.error(t("settings.sync.fillConnection"));
      return;
    }

    setTesting(true);
    try {
      const result = await testConnection(url.trim(), username.trim(), password);
      if (result.success) {
        toast.success(t("settings.sync.connectionSuccess"));
        await setConfig(url.trim(), username.trim(), password);
        setShowPassword(false);
      } else {
        toast.error(t("settings.sync.connectionFailed"), { description: result.message });
      }
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!url.trim()) {
      toast.error(t("settings.sync.fillWebdavUrl"));
      return;
    }

    if (password.trim()) {
      await setConfig(url.trim(), username.trim(), password);
      toast.success(t("settings.sync.savedWithPassword"));
    } else {
      await setConfig(url.trim(), username.trim());
      toast.success(t("settings.sync.saved"));
    }
  };

  const handleSaveDeviceName = async () => {
    try {
      await setDeviceName(deviceNameInput);
      toast.success(t("settings.sync.deviceSaved"));
    } catch (error) {
      toast.error(t("settings.sync.saveFailed"), { description: error instanceof Error ? error.message : String(error) });
    }
  };

  const handleSaveRemoteDir = async () => {
    try {
      await setRemoteDir(remoteDirInput.trim());
      toast.success(t("settings.sync.saved"));
    } catch (error) {
      toast.error(t("settings.sync.saveFailed"), { description: error instanceof Error ? error.message : String(error) });
    }
  };

  const openPreview = async (mode: "upload" | "download") => {
    if (!hasPassword) {
      toast.error(t("settings.sync.configureWebdavFirst"));
      return;
    }
    try {
      const nextPreview = await getPreview(previewDeviceName || deviceName);
      if (mode === "download" && nextPreview.remote.missing) {
        toast.error(t("settings.sync.cannotDownload"));
        return;
      }
      setPreview(nextPreview);
      setPreviewMode(mode);
      setSelectedDomains(["projects", "groups", "command_templates"]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(mode === "upload" ? t("settings.sync.readUploadPreviewFailed") : t("settings.sync.readDownloadPreviewFailed"), { description: message });
    }
  };

  const confirmPreviewAction = async () => {
    if (!previewMode) return;
    if (previewMode === "download" && preview?.remote.missing) {
      toast.error(t("settings.sync.cannotDownload"));
      return;
    }
    try {
      if (previewMode === "upload") {
        await upload();
        toast.success(t("settings.sync.uploadSuccess"));
      } else {
        await download(true, { deviceName: previewDeviceName || deviceName, domains: selectedDomains });
        toast.success(t("settings.sync.downloadSuccess"));
      }
      setPreview(null);
      setPreviewMode(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(previewMode === "upload" ? t("settings.sync.uploadFailed") : t("settings.sync.downloadFailed"), { description: message });
    }
  };

  const toggleDomain = (domain: SyncDataDomain) => {
    setSelectedDomains((current) =>
      current.includes(domain) ? current.filter((item) => item !== domain) : [...current, domain]
    );
  };

  const handlePickLocalDir = async () => {
    try {
      const result = await openDialog({ directory: true, multiple: false, title: t("settings.sync.chooseLocalDir") });
      if (typeof result === "string" && result.length > 0) {
        await setLocalSyncDir(result);
      }
    } catch (error) {
      toast.error(t("settings.sync.chooseDirFailed"), { description: String(error) });
    }
  };

  const handleLocalExport = async () => {
    if (!localSyncDir) {
      toast.error(t("settings.sync.pickLocalDirFirst"));
      return;
    }
    try {
      const path = await localExport();
      toast.success(t("settings.sync.localExportSuccess"), { description: path });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(t("settings.sync.localExportFailed"), { description: message });
    }
  };

  const handleLocalImportPick = async () => {
    try {
      const result = await openDialog({
        directory: false,
        multiple: false,
        title: t("settings.sync.chooseZip"),
        filters: [{ name: t("settings.sync.zipFilter"), extensions: ["zip"] }],
        defaultPath: localSyncDir || undefined,
      });
      if (typeof result === "string" && result.length > 0) {
        setShowImportConfirm(result);
      }
    } catch (error) {
      toast.error(t("settings.sync.chooseFileFailed"), { description: String(error) });
    }
  };

  const confirmLocalImport = async () => {
    const zipPath = showImportConfirm;
    setShowImportConfirm(null);
    if (!zipPath) return;
    try {
      await localImport(zipPath);
      toast.success(t("settings.sync.localImportSuccess"));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(t("settings.sync.localImportFailed"), { description: message });
    }
  };

  const formatLastSync = () => {
    if (!lastSyncAt) return t("settings.sync.never");
    const date = new Date(lastSyncAt);
    return date.toLocaleString(language);
  };
  const formatDateTime = (value: string | number) => new Date(value).toLocaleString(language);
  const namesText = (names: string[]) => names.join(t("settings.common.listSeparator")) || t("settings.sync.none");

  return (
    <Stack gap="md">
      {conflictInfo && (
        <Card className="border border-yellow-500/30 bg-yellow-500/10" p="md" radius="lg">
          <Group align="flex-start" gap="sm" wrap="nowrap">
            <ThemeIcon variant="light" color="yellow" size="sm">
              <AlertTriangle size={16} />
            </ThemeIcon>
            <Stack gap="sm" className="flex-1">
              <Box>
                <Text fw={600} c="yellow">
                  {t("settings.sync.conflictTitle")}
                </Text>
                <Text mt={4} size="sm" c="var(--on-surface-variant)">
                  {t("settings.sync.conflictDescription")}
                </Text>
              </Box>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                <Card className="bg-surface-container-high" p="sm" radius="lg">
                  <Text fw={600}>{t("settings.sync.localVersion")}</Text>
                  <Text mt={4} size="sm" c="var(--on-surface-variant)">
                    {formatDateTime(conflictInfo.local_modified)}
                  </Text>
                  <Text mt={8} size="xs">
                    {t("settings.sync.summary", {
                      projects: conflictInfo.local_projects,
                      groups: conflictInfo.local_groups,
                      templates: conflictInfo.local_templates,
                    })}
                  </Text>
                </Card>
                <Card className="bg-surface-container-high" p="sm" radius="lg">
                  <Text fw={600}>{t("settings.sync.remoteVersion")}</Text>
                  <Text mt={4} size="sm" c="var(--on-surface-variant)">
                    {formatDateTime(conflictInfo.remote_modified)}
                  </Text>
                  <Text mt={8} size="xs">
                    {t("settings.sync.summary", {
                      projects: conflictInfo.remote_projects,
                      groups: conflictInfo.remote_groups,
                      templates: conflictInfo.remote_templates,
                    })}
                  </Text>
                </Card>
              </SimpleGrid>
              <Group gap="xs">
                <Button size="xs" color="cliPrimary" onClick={() => resolveConflict(true)}>
                  {t("settings.sync.keepLocal")}
                </Button>
                <Button size="xs" variant="default" color="gray" onClick={() => resolveConflict(false)}>
                  {t("settings.sync.useRemote")}
                </Button>
                <Button size="xs" variant="subtle" color="gray" onClick={clearConflict}>
                  {t("settings.sync.cancel")}
                </Button>
              </Group>
            </Stack>
          </Group>
        </Card>
      )}

      <section className="ui-surface-card rounded-2xl border border-border p-4">
        <Stack gap="sm">
          <Text size="sm" fw={600} c="var(--on-surface)">
            {t("settings.sync.method")}
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
          {SYNC_MODE_OPTIONS.map((opt) => {
            const active = syncMode === opt.value;
            return (
              <UnstyledButton
                key={opt.value}
                onClick={() => void setSyncMode(opt.value)}
                className="ui-interactive ui-focus-ring ui-selection-card rounded-xl border text-left"
                data-selected={active ? "true" : "false"}
                aria-pressed={active}
                w="100%"
                style={{
                  display: "block",
                  minHeight: 76,
                  minWidth: 0,
                  padding: "14px 16px",
                  whiteSpace: "normal",
                }}
              >
                <Stack gap={4} style={{ minWidth: 0 }}>
                  <Text size="sm" fw={600} c="var(--on-surface)" style={{ lineHeight: 1.25 }}>
                    {t(opt.label)}
                  </Text>
                  <Text size="xs" lh={1.45} c="var(--on-surface-variant)" style={{ overflowWrap: "anywhere" }}>
                    {t(opt.description)}
                  </Text>
                </Stack>
              </UnstyledButton>
            );
          })}
          </SimpleGrid>
        </Stack>
      </section>

      {syncMode === "cloud" && (
        <>
          <section className="ui-surface-card rounded-2xl border border-border p-4">
            <Stack gap="md">
              <Text size="sm" fw={600} c="var(--on-surface)">
                {t("settings.sync.webdavConfig")}
              </Text>

              <TextInput
                  label={t("settings.sync.serverUrl")}
                  type="url"
                  value={url}
                  onChange={(event) => setUrl(event.currentTarget.value)}
                  placeholder="https://dav.example.com/webdav"
                  size="sm"
                  aria-label={t("settings.sync.serverUrlAria")}
              />

              <Box>
                <Group align="flex-end" gap="xs" wrap="nowrap">
                  <TextInput
                    label={t("settings.sync.remoteDir")}
                    type="text"
                    value={remoteDirInput}
                    onChange={(event) => setRemoteDirInput(event.currentTarget.value)}
                    placeholder={t("settings.sync.remoteDirPlaceholder")}
                    size="sm"
                    className="flex-1"
                    aria-label={t("settings.sync.remoteDir")}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    color="gray"
                    onClick={handleSaveRemoteDir}
                  >
                    {t("settings.sync.saveRemoteDir")}
                  </Button>
                </Group>
                <Text mt={4} size="xs" c="var(--on-surface-variant)">
                  {t("settings.sync.remoteDirDescription")}
                </Text>
              </Box>

              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <TextInput
                    label={t("settings.sync.username")}
                    type="text"
                    value={username}
                    onChange={(event) => setUsername(event.currentTarget.value)}
                    placeholder={t("settings.sync.usernamePlaceholder")}
                    size="sm"
                    aria-label={t("settings.sync.usernameAria")}
                />
                <PasswordInput
                    label={t("settings.sync.password")}
                    value={password}
                    onChange={(event) => setPassword(event.currentTarget.value)}
                    placeholder="••••••••"
                    visible={showPassword}
                    onVisibilityChange={setShowPassword}
                    size="sm"
                    aria-label={t("settings.sync.passwordAria")}
                />
              </SimpleGrid>

              <Box>
                <Group align="flex-end" gap="xs" wrap="nowrap">
                  <TextInput
                    label={t("settings.sync.deviceName")}
                    type="text"
                    value={deviceNameInput}
                    onChange={(event) => setDeviceNameInput(event.currentTarget.value)}
                    placeholder={t("settings.sync.devicePlaceholder")}
                    size="sm"
                    className="flex-1"
                    aria-label={t("settings.sync.deviceName")}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    color="gray"
                    onClick={handleSaveDeviceName}
                  >
                    {t("settings.sync.saveDeviceName")}
                  </Button>
                </Group>
                <Text mt={4} size="xs" c="var(--on-surface-variant)">
                  {t("settings.sync.deviceDescription")}
                </Text>
              </Box>

              <Group gap="xs">
                <Button
                  size="xs"
                  color="cliPrimary"
                  onClick={handleTest}
                  disabled={testing || !url.trim() || !username.trim() || !password.trim()}
                >
                  {testing ? t("settings.sync.testing") : t("settings.sync.testConnection")}
                </Button>
                <Button
                  size="xs"
                  variant="default"
                  color="gray"
                  onClick={handleSave}
                >
                  {t("settings.sync.saveConfig")}
                </Button>
                {hasPassword && (
                  <Button
                    size="xs"
                    variant="subtle"
                    color="red"
                    onClick={clearPassword}
                  >
                    {t("settings.sync.clearPassword")}
                  </Button>
                )}
              </Group>

              {hasPassword && (
                <Group gap="xs" c="var(--success)">
                  <Check size={16} />
                  <Text size="sm">{t("settings.sync.webdavConfigured")}</Text>
                </Group>
              )}
            </Stack>
          </section>

          <section className="ui-surface-card rounded-2xl border border-border p-4">
            <Stack gap="md">
              <Text size="sm" fw={600} c="var(--on-surface)">
                {t("settings.sync.cloudActions")}
              </Text>
            {!hasPassword && (
              <Card className="border border-yellow-500/30 bg-yellow-500/10" p="sm" radius="lg">
                <Text size="sm" c="yellow">
                  {t("settings.sync.webdavRequired")}
                </Text>
              </Card>
            )}

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <Select<AutoSyncAction>
                  label={t("settings.sync.onStartup")}
                  value={autoSyncOnStartup}
                  onChange={(value) => {
                    if (value) void setAutoSyncOnStartup(value);
                  }}
                  data={AUTO_SYNC_OPTIONS.map((option) => ({ ...option, label: t(option.label) }))}
                  allowDeselect={false}
                  size="sm"
              />
              <Select<AutoSyncAction>
                  label={t("settings.sync.onClose")}
                  value={autoSyncOnClose}
                  onChange={(value) => {
                    if (value) void setAutoSyncOnClose(value);
                  }}
                  data={AUTO_SYNC_OPTIONS.map((option) => ({ ...option, label: t(option.label) }))}
                  allowDeselect={false}
                  size="sm"
              />
            </SimpleGrid>

            <Select<string>
                label={t("settings.sync.restoreDevice")}
                value={previewDeviceName}
                onChange={(value) => setPreviewDeviceName(value ?? "")}
                data={knownDeviceNames.map((name) => ({ value: name, label: name }))}
                allowDeselect={false}
                size="sm"
            />

            <Group gap="sm">
              <Button
                size="sm"
                color="cliPrimary"
                leftSection={status === "syncing" ? undefined : <Upload size={16} />}
                onClick={() => void openPreview("upload")}
                disabled={!hasPassword || status === "syncing"}
              >
                {status === "syncing" ? t("settings.sync.syncing") : t("settings.sync.uploadCloud")}
              </Button>
              <Button
                size="sm"
                variant="default"
                color="gray"
                leftSection={status === "syncing" ? undefined : <Download size={16} />}
                onClick={() => void openPreview("download")}
                disabled={!hasPassword || status === "syncing"}
              >
                {status === "syncing" ? t("settings.sync.syncing") : t("settings.sync.downloadCloud")}
              </Button>
            </Group>

            <Group gap="xs" c="var(--on-surface-variant)">
              <Cloud size={16} />
              <Text size="sm">{t("settings.sync.lastSync", { time: formatLastSync() })}</Text>
            </Group>
            </Stack>
          </section>

          <Card className="border border-border bg-surface-container-high" p="md" radius="lg">
            <Text fw={600} c="var(--on-surface)">{t("settings.sync.instructions")}</Text>
            <Stack mt="xs" gap={4}>
              <Text size="sm" c="var(--on-surface-variant)">{t("settings.sync.cloudInstruction1")}</Text>
              <Text size="sm" c="var(--on-surface-variant)">{t("settings.sync.cloudInstruction2")}</Text>
              <Text size="sm" c="var(--on-surface-variant)">{t("settings.sync.cloudInstruction3")}</Text>
              <Text size="sm" c="var(--on-surface-variant)">{t("settings.sync.cloudInstruction4")}</Text>
            </Stack>
          </Card>
        </>
      )}

      {syncMode === "local" && (
        <>
          <section className="ui-surface-card rounded-2xl border border-border p-4">
            <Stack gap="md">
              <Text size="sm" fw={600} c="var(--on-surface)">
                {t("settings.sync.localDir")}
              </Text>
              <Group align="flex-end" gap="xs" wrap="nowrap">
                <TextInput
                  label={t("settings.sync.directory")}
                  type="text"
                  value={localSyncDir}
                  readOnly
                  placeholder={t("settings.sync.noDirSelected")}
                  className="flex-1"
                  size="sm"
                  aria-label={t("settings.sync.localDirAria")}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  color="gray"
                  leftSection={<Folder size={16} />}
                  onClick={handlePickLocalDir}
                >
                  {t("settings.sync.selectDir")}
                </Button>
              </Group>
              {localSyncDir && (
                <Group gap="xs" c="var(--success)">
                  <Check size={16} />
                  <Text size="sm">{t("settings.sync.localDirConfigured")}</Text>
                </Group>
              )}
            </Stack>
          </section>

          <section className="ui-surface-card rounded-2xl border border-border p-4">
            <Stack gap="md">
              <Text size="sm" fw={600} c="var(--on-surface)">
                {t("settings.sync.localActions")}
              </Text>

            {!localSyncDir && (
              <Card className="border border-yellow-500/30 bg-yellow-500/10" p="sm" radius="lg">
                <Text size="sm" c="yellow">
                  {t("settings.sync.localDirRequired")}
                </Text>
              </Card>
            )}

            <Group gap="sm">
              <Button
                size="sm"
                color="cliPrimary"
                leftSection={status === "syncing" ? undefined : <Upload size={16} />}
                onClick={handleLocalExport}
                disabled={!localSyncDir || status === "syncing"}
              >
                {status === "syncing" ? t("settings.sync.syncing") : t("settings.sync.exportZip")}
              </Button>
              <Button
                size="sm"
                variant="default"
                color="gray"
                leftSection={status === "syncing" ? undefined : <Download size={16} />}
                onClick={handleLocalImportPick}
                disabled={status === "syncing"}
              >
                {status === "syncing" ? t("settings.sync.syncing") : t("settings.sync.importZip")}
              </Button>
            </Group>

            <Group gap="xs" c="var(--on-surface-variant)">
              <Folder size={16} />
              <Text size="sm">{t("settings.sync.lastSync", { time: formatLastSync() })}</Text>
            </Group>
            </Stack>
          </section>

          <Card className="border border-border bg-surface-container-high" p="md" radius="lg">
            <Text fw={600} c="var(--on-surface)">{t("settings.sync.instructions")}</Text>
            <Stack mt="xs" gap={4}>
              <Text size="sm" c="var(--on-surface-variant)">{t("settings.sync.localInstruction1")}</Text>
              <Text size="sm" c="var(--on-surface-variant)">{t("settings.sync.localInstruction2")}</Text>
              <Text size="sm" c="var(--on-surface-variant)">{t("settings.sync.localInstruction3")}</Text>
              <Text size="sm" c="var(--on-surface-variant)">{t("settings.sync.localInstruction4")}</Text>
            </Stack>
          </Card>
        </>
      )}

      <Modal
        opened={Boolean(preview && previewMode)}
        onClose={() => {
          setPreview(null);
          setPreviewMode(null);
        }}
        title={previewMode === "upload" ? t("settings.sync.confirmUpload") : t("settings.sync.confirmDownload")}
        size="xl"
        centered
      >
        {preview && previewMode && (
          <Stack gap="md">
            <Group align="flex-start" gap="sm" wrap="nowrap">
              <ThemeIcon variant="light" color="yellow" size="sm">
                <AlertTriangle size={16} />
              </ThemeIcon>
              <Text size="sm" c="var(--on-surface-variant)">
                {t("settings.sync.previewDescription", {
                  description:
                    previewMode === "upload"
                      ? t("settings.sync.uploadPreviewDescription")
                      : t("settings.sync.downloadPreviewDescription"),
                })}
              </Text>
            </Group>

            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
              {[preview.local, preview.remote].map((item, index) => (
                <Card key={index === 0 ? "local" : "remote"} className="bg-surface-container-low" p="sm" radius="lg">
                  <Text fw={600} c="var(--on-surface)">{index === 0 ? t("settings.sync.localContent") : t("settings.sync.cloudContent")}</Text>
                  <Text mt={4} size="sm" c="var(--on-surface-variant)">{t("settings.sync.device", { name: item.deviceName })}</Text>
                  <Text size="sm" c="var(--on-surface-variant)">
                    {t("settings.sync.time", { time: item.missing ? t("settings.sync.noCloudSnapshot") : formatDateTime(item.lastModified) })}
                  </Text>
                  {item.missing && (
                    <Card mt="xs" className="border border-yellow-500/30 bg-yellow-500/10" p="xs" radius="md">
                      <Text size="xs" c="yellow">
                        {t("settings.sync.emptyCloudSnapshot")}
                      </Text>
                    </Card>
                  )}
                  <Text mt="xs" size="xs" c="var(--on-surface-variant)">
                    {t("settings.sync.summary", {
                      projects: item.projects,
                      groups: item.groups,
                      templates: item.commandTemplates,
                    })}
                  </Text>
                  <Stack mt="xs" gap={4}>
                    <Text size="xs" c="var(--on-surface-variant)">{t("settings.sync.projectNames", { names: namesText(item.projectNames) })}</Text>
                    <Text size="xs" c="var(--on-surface-variant)">{t("settings.sync.groupNames", { names: namesText(item.groupNames) })}</Text>
                    <Text size="xs" c="var(--on-surface-variant)">{t("settings.sync.templateNames", { names: namesText(item.templateNames) })}</Text>
                  </Stack>
                </Card>
              ))}
            </SimpleGrid>

            {previewMode === "download" && (
              <Card className="bg-surface-container-low" p="sm" radius="lg">
                <Stack gap="xs">
                  <Text size="sm" fw={600} c="var(--on-surface)">{t("settings.sync.selectOverwriteScope")}</Text>
                  <Group gap="sm">
                  {DOMAIN_OPTIONS.map((option) => (
                    <Checkbox
                      key={option.value}
                      checked={selectedDomains.includes(option.value)}
                      onChange={() => toggleDomain(option.value)}
                      label={t(option.label)}
                      color="cliPrimary"
                    />
                  ))}
                  </Group>
                </Stack>
              </Card>
            )}

            <Group justify="flex-end" gap="xs">
              <Button
                size="xs"
                variant="default"
                color="gray"
                onClick={() => {
                  setPreview(null);
                  setPreviewMode(null);
                }}
              >
                {t("settings.sync.cancel")}
              </Button>
              <Button
                size="xs"
                color="cliPrimary"
                onClick={() => void confirmPreviewAction()}
                disabled={previewMode === "download" && selectedDomains.length === 0}
              >
                {t("settings.sync.execute")}
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      <Modal
        opened={Boolean(showImportConfirm)}
        onClose={() => setShowImportConfirm(null)}
        title={t("settings.sync.confirmImport")}
        size="sm"
        centered
      >
        {showImportConfirm && (
          <Stack gap="md">
            <Group align="flex-start" gap="sm" wrap="nowrap">
              <ThemeIcon variant="light" color="yellow" size="sm">
                <AlertTriangle size={16} />
              </ThemeIcon>
              <Text size="sm" c="var(--on-surface-variant)" style={{ overflowWrap: "anywhere" }}>
                {t("settings.sync.importWarning", { path: showImportConfirm })}
              </Text>
            </Group>
            <Group justify="flex-end" gap="xs">
              <Button size="xs" variant="default" color="gray" onClick={() => setShowImportConfirm(null)}>
                {t("settings.sync.cancel")}
              </Button>
              <Button size="xs" color="red" onClick={confirmLocalImport}>
                {t("settings.sync.confirmImport")}
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
