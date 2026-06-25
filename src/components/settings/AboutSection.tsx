import { useEffect, useState, type ComponentType } from "react";
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  Check,
  Download,
  ExternalLink,
  Github,
  Info,
  RefreshCw,
  RotateCw,
  UserRound,
} from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useTerminalStore } from "../../stores/terminalStore";
import { useUpdateStore } from "../../stores/updateStore";
import { MarkdownContent } from "../ui/MarkdownContent";
import { useI18n, type TranslationKey } from "../../lib/i18n";

const REPOSITORY_URL = "https://github.com/dark-hxx/CLI-Manager";
const MANUAL_URL = `${REPOSITORY_URL}/blob/master/docs/%E5%8A%9F%E8%83%BD%E6%B8%85%E5%8D%95.md`;
const AUTHOR_URL = "https://github.com/dark-hxx";

const PROJECT_HIGHLIGHTS: TranslationKey[] = [
  "settings.about.highlight.pty",
  "settings.about.highlight.cli",
  "settings.about.highlight.history",
  "settings.about.highlight.sync",
];

interface ExternalLinkItemProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  url: string;
}

async function openExternalUrl(url: string): Promise<void> {
  try {
    await openUrl(url);
  } catch (e) {
    console.error("Failed to open URL:", e);
  }
}

function ExternalLinkItem({ icon: Icon, title, description, url }: ExternalLinkItemProps) {
  return (
    <button
      type="button"
      onClick={() => void openExternalUrl(url)}
      className="ui-interactive ui-focus-ring ui-surface-card flex min-w-0 items-start gap-3 rounded-2xl border border-border p-4 text-left transition-colors hover:bg-surface-container-high"
    >
      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-surface-container-high text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-on-surface">
          {title}
          <ExternalLink className="h-3.5 w-3.5 text-on-surface-variant" />
        </span>
        <span className="mt-1 block text-xs leading-5 text-on-surface-variant">{description}</span>
      </span>
    </button>
  );
}

export function AboutSection() {
  const { language, t } = useI18n();
  const {
    currentVersion,
    checking,
    updateAvailable,
    updateInfo,
    downloading,
    downloadProgress,
    downloadTotalBytes,
    downloadedBytes,
    readyToInstall,
    installing,
    lastCheckedAt,
    error,
    releaseFallbackUrl,
    fetchVersion,
    checkUpdate,
    downloadUpdate,
    installAndRelaunch,
    reset,
  } = useUpdateStore();
  const activeTerminalCount = useTerminalStore((state) =>
    state.sessions.filter((session) => {
      const status = state.sessionStatuses[session.id];
      return status !== "exited" && status !== "error";
    }).length
  );
  const [installConfirmVisible, setInstallConfirmVisible] = useState(false);

  useEffect(() => {
    if (!currentVersion) {
      fetchVersion();
    }
  }, [currentVersion, fetchVersion]);

  useEffect(() => {
    if (!readyToInstall) {
      setInstallConfirmVisible(false);
    }
  }, [readyToInstall, updateInfo?.version]);

  const handleCheckUpdate = () => {
    if (checking || downloading || installing) return;
    setInstallConfirmVisible(false);
    checkUpdate();
  };

  const handleDownloadUpdate = async () => {
    if (downloading || installing) return;
    const downloaded = await downloadUpdate();
    if (downloaded) {
      setInstallConfirmVisible(true);
    }
  };

  const handleOpenReleaseFallback = () => {
    void openExternalUrl(updateInfo?.downloadUrl ?? releaseFallbackUrl);
  };

  const handleConfirmInstall = () => {
    if (installing) return;
    installAndRelaunch();
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    try {
      return new Date(dateStr).toLocaleDateString(language, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const formatBytes = (value: number | null) => {
    if (!value || value <= 0) return "";
    const units = ["B", "KB", "MB", "GB"];
    let size = value;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex += 1;
    }
    return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  };

  const canDownload = updateAvailable && updateInfo && !downloading && !readyToInstall && !installing;
  const showLatest = Boolean(lastCheckedAt && !checking && !error && !updateAvailable);
  const progressLabel = downloadTotalBytes
    ? `${downloadProgress}%（${formatBytes(downloadedBytes)} / ${formatBytes(downloadTotalBytes)}）`
    : downloadProgress > 0
      ? `${downloadProgress}%`
      : t("settings.about.downloading");

  return (
    <div className="space-y-4">
      <section className="ui-surface-card rounded-2xl border border-border p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Info className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-on-surface">{t("settings.about.projectIntro")}</div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-on-surface-variant">
              {t("settings.about.projectDescription")}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {PROJECT_HIGHLIGHTS.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-border bg-surface-container-high px-2.5 py-1 text-xs text-on-surface-variant"
                >
                  {t(item)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="ui-surface-card rounded-2xl border border-border p-4">
        <div className="text-sm font-semibold text-on-surface">{t("settings.about.updates")}</div>

        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-on-surface-variant">{t("settings.about.version")}</span>
          <span className="rounded-md bg-surface-container-high px-2 py-0.5 font-mono text-xs font-semibold text-on-surface">
            V{currentVersion || "---"}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleCheckUpdate}
            disabled={checking || downloading || installing}
            className="ui-interactive ui-focus-ring flex items-center gap-1.5 rounded-lg border border-border bg-surface-container-high px-3 py-1.5 text-xs font-medium text-on-surface transition-colors hover:bg-surface-container-highest disabled:cursor-not-allowed disabled:opacity-60"
            aria-label={checking ? t("settings.about.checking") : t("settings.about.checkUpdate")}
          >
            {checking ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>{t("settings.about.checkingEllipsis")}</span>
              </>
            ) : (
              <>
                <RefreshCw className="h-3.5 w-3.5" />
                <span>{t("settings.about.checkUpdate")}</span>
              </>
            )}
          </button>

          {error && (
            <div className="flex flex-wrap items-center gap-1 text-xs text-danger">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>{error}</span>
              <button type="button" onClick={handleCheckUpdate} className="ml-1 underline hover:no-underline">
                {t("settings.about.retry")}
              </button>
              <button type="button" onClick={handleOpenReleaseFallback} className="ml-1 underline hover:no-underline">
                {t("settings.about.viewRelease")}
              </button>
            </div>
          )}

          {showLatest && (
            <div className="flex items-center gap-1 text-xs text-success">
              <Check className="h-3.5 w-3.5" />
              <span>{t("settings.about.latest")}</span>
            </div>
          )}
        </div>

        {updateAvailable && updateInfo && (
          <div className="mt-3 rounded-xl border border-accent/30 bg-accent/5 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-on-surface">V{updateInfo.version}</span>
                  <span className="rounded-full bg-success/20 px-2 py-0.5 text-[10px] font-medium text-success">
                    {t("settings.about.updateAvailable")}
                  </span>
                </div>
                {updateInfo.releaseDate && (
                  <div className="mt-1 text-xs text-on-surface-variant">
                    {t("settings.about.releaseDate", { date: formatDate(updateInfo.releaseDate) })}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                {canDownload && (
                  <button
                    type="button"
                    onClick={handleDownloadUpdate}
                    className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>{t("settings.about.downloadUpdate")}</span>
                  </button>
                )}
                {readyToInstall && !installConfirmVisible && (
                  <button
                    type="button"
                    onClick={() => setInstallConfirmVisible(true)}
                    className="flex items-center gap-1.5 rounded-lg bg-success px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                    <span>{t("settings.about.installRelaunch")}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleOpenReleaseFallback}
                  className="flex items-center gap-1 text-xs text-on-surface-variant underline hover:no-underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  <span>{t("settings.about.viewReleasePage")}</span>
                </button>
              </div>
            </div>

            {downloading && (
              <div className="mt-3 rounded-lg border border-border/60 bg-surface-container-high/60 p-3">
                <div className="mb-2 flex items-center justify-between text-xs text-on-surface-variant">
                  <span>{t("settings.about.downloadingUpdate")}</span>
                  <span>{progressLabel}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-container-highest">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${downloadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {readyToInstall && installConfirmVisible && (
              <div className="mt-3 rounded-lg border border-danger/40 bg-danger/10 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-danger" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-on-surface">{t("settings.about.confirmInstallTitle")}</div>
                    <div className="mt-1 text-xs text-on-surface-variant">
                      {t("settings.about.installWarning")}
                      {activeTerminalCount > 0
                        ? t("settings.about.runningTerminalsWarning", { count: activeTerminalCount })
                        : t("settings.about.saveWorkWarning")}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleConfirmInstall}
                        disabled={installing}
                        className="rounded-lg bg-danger px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {installing ? t("settings.about.installing") : t("settings.about.installRelaunch")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setInstallConfirmVisible(false)}
                        disabled={installing}
                        className="rounded-lg border border-border bg-surface-container-high px-3 py-1.5 text-xs font-medium text-on-surface transition-colors hover:bg-surface-container-highest disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {t("settings.about.later")}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {updateInfo.releaseNotes && (
              <div className="mt-3 border-t border-border/50 pt-3">
                <div className="mb-1 text-xs font-medium text-on-surface-variant">{t("settings.about.releaseNotes")}</div>
                <MarkdownContent content={updateInfo.releaseNotes} linkBehavior="open" />
              </div>
            )}

            <button
              type="button"
              onClick={reset}
              disabled={checking || downloading || installing}
              className="mt-3 text-xs text-on-surface-variant underline hover:no-underline disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t("settings.about.remindLater")}
            </button>
          </div>
        )}
      </section>

      <div className="space-y-3">
        <div className="px-1 text-sm font-semibold text-on-surface">{t("settings.about.resources")}</div>
        <div className="grid gap-3 md:grid-cols-2">
          <ExternalLinkItem
            icon={Github}
            title={t("settings.about.gitTitle")}
            description={t("settings.about.gitDescription")}
            url={REPOSITORY_URL}
          />
          <ExternalLinkItem
            icon={BookOpen}
            title={t("settings.about.manualTitle")}
            description={t("settings.about.manualDescription")}
            url={MANUAL_URL}
          />
        </div>
      </div>

      <section className="ui-surface-card rounded-2xl border border-border p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-2xl bg-surface-container-high text-primary">
            <UserRound className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-on-surface">{t("settings.about.authorInfo")}</div>
            <div className="mt-2 text-sm text-on-surface-variant">{t("settings.about.author")}</div>
            <div className="mt-1 text-xs leading-5 text-on-surface-variant">
              {t("settings.about.authorDescription")}
            </div>
            <button
              type="button"
              onClick={() => void openExternalUrl(AUTHOR_URL)}
              className="ui-interactive ui-focus-ring mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-container-high px-3 py-1.5 text-xs font-medium text-on-surface transition-colors hover:bg-surface-container-highest"
            >
              <Github className="h-3.5 w-3.5" />
              <span>{t("settings.about.viewAuthor")}</span>
              <ExternalLink className="h-3 w-3 text-on-surface-variant" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
