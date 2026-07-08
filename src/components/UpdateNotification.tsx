/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from "motion/react";
import { useState, useEffect, useCallback } from "react";
import { Download, X, ArrowDownToLine, Sparkles, RefreshCw, ExternalLink, CheckCircle, AlertCircle, Clock } from "lucide-react";

interface UpdateInfo {
  updateAvailable: boolean;
  latestVersion: string;
  currentVersion: string;
  downloadUrl?: string;
  releaseUrl?: string;
  releaseNotes?: string | null;
  error?: string;
  checkFailed?: boolean;
}

interface UpdateNotificationProps {
  /** Update info from the API. */
  updateInfo: UpdateInfo | null;
  /** Called when the user dismisses. */
  onDismiss: () => void;
  /** Called to trigger a manual check. */
  onCheckNow: () => void;
  /** Current check state. */
  checkState?: "idle" | "checking" | "done";
  /** Timestamp of last check. */
  lastCheck?: string | null;
}

export function UpdateNotification({ updateInfo, onDismiss, onCheckNow, checkState, lastCheck }: UpdateNotificationProps) {
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [visible, setVisible] = useState(false);

  // Show notification when we have info to display
  useEffect(() => {
    if (updateInfo && !dismissed) {
      setVisible(true);
    }
  }, [updateInfo, dismissed]);

  // Auto-dismiss "no update" / "check failed" after 6 seconds
  useEffect(() => {
    if (updateInfo && !updateInfo.updateAvailable) {
      const timer = setTimeout(() => {
        setDismissed(true);
        setVisible(false);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [updateInfo]);

  const handleDownload = useCallback(async () => {
    if (!updateInfo?.downloadUrl) return;
    setDownloading(true);
    setDownloadProgress("Downloading...");

    try {
      // Try Electron IPC download first
      if (window.electronAPI?.downloadUpdate) {
        const result = await window.electronAPI.downloadUpdate(updateInfo.downloadUrl);
        if (result.success) {
          setDownloadProgress("Installing...");
          await new Promise((r) => setTimeout(r, 1000));
          if (window.electronAPI?.installUpdate) {
            window.electronAPI.installUpdate(result.filePath);
          }
          return;
        }
        throw new Error(result.error || "Download failed");
      }

      // Fallback: open in browser
      window.open(updateInfo.downloadUrl, "_blank");
      setDownloadProgress(null);
      setDownloading(false);
      onDismiss();
    } catch (err: any) {
      setDownloadProgress(`Error: ${err.message}`);
      setTimeout(() => {
        setDownloadProgress(null);
        setDownloading(false);
      }, 3000);
    }
  }, [updateInfo, onDismiss]);

  // Don't show if nothing to display or dismissed
  if (!visible || !updateInfo) return null;

  const isUpdate = updateInfo.updateAvailable === true;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 260, damping: 25 }}
        className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4"
      >
        <div className={`relative overflow-hidden rounded-2xl bg-[#0A0A12]/95 border shadow-2xl backdrop-blur-2xl ${
          isUpdate
            ? "border-[#7C5CFF]/20 shadow-[#7C5CFF]/5"
            : updateInfo.checkFailed
            ? "border-rose-500/20 shadow-rose-500/5"
            : "border-emerald-500/20 shadow-emerald-500/5"
        }`}>
          {/* Gradient accent bar */}
          <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${
            isUpdate
              ? "from-[#7C5CFF] via-[#6EE7FF] to-[#ec4899]"
              : updateInfo.checkFailed
              ? "from-rose-500 via-amber-500 to-rose-500"
              : "from-emerald-500 via-emerald-400 to-emerald-500"
          }`} />

          <div className="p-4">
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div className="relative shrink-0">
                {isUpdate ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                      className="absolute inset-0 rounded-full bg-gradient-to-br from-[#7C5CFF]/20 via-[#6EE7FF]/10 to-[#ec4899]/10 blur-md"
                    />
                    <div className="relative p-2 rounded-xl bg-[#7C5CFF]/10 border border-[#7C5CFF]/20">
                      <Sparkles className="w-4 h-4 text-[#A288FF]" />
                    </div>
                  </>
                ) : updateInfo.checkFailed ? (
                  <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                  </div>
                ) : (
                  <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {isUpdate ? (
                  <>
                    <h3 className="text-sm font-semibold text-white">Update Available</h3>
                    <p className="text-[11px] text-gray-400 mt-0.5 font-mono">
                      v{updateInfo.latestVersion} is available
                      {updateInfo.currentVersion && (
                        <span className="text-gray-500">
                          {" · "}You have v{updateInfo.currentVersion}
                        </span>
                      )}
                    </p>
                    {updateInfo.releaseNotes && (
                      <p className="text-[10px] text-gray-500 mt-1.5 line-clamp-2 font-mono leading-relaxed">
                        {updateInfo.releaseNotes}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-3">
                      <button
                        onClick={handleDownload}
                        disabled={downloading}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono font-semibold transition-all duration-200 cursor-pointer ${
                          downloading
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 cursor-wait"
                            : "bg-[#7C5CFF] hover:bg-[#6B4FE0] text-white shadow-lg shadow-[#7C5CFF]/20"
                        }`}
                      >
                        {downloading ? (
                          <>
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            {downloadProgress || "Downloading..."}
                          </>
                        ) : (
                          <>
                            <ArrowDownToLine className="w-3 h-3" />
                            Download & Install
                          </>
                        )}
                      </button>
                      {updateInfo.releaseUrl && (
                        <a
                          href={updateInfo.releaseUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-gray-400 hover:text-white transition-all text-[10px] font-mono cursor-pointer"
                          onClick={() => setDismissed(true)}
                        >
                          <ExternalLink className="w-3 h-3" />
                          Details
                        </a>
                      )}
                    </div>
                  </>
                ) : updateInfo.checkFailed ? (
                  <>
                    <h3 className="text-sm font-semibold text-white">Check Failed</h3>
                    <p className="text-[11px] text-rose-400/80 mt-0.5 font-mono">
                      {updateInfo.error || "Could not reach update server"}
                    </p>
                    <p className="text-[9px] text-gray-500 mt-1 font-mono">
                      Check your internet connection or try again later.
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <button
                        onClick={() => { onCheckNow(); setDismissed(true); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-gray-400 hover:text-white transition-all text-[10px] font-mono cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Retry
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className="text-sm font-semibold text-white">Up to Date</h3>
                    <p className="text-[11px] text-gray-400 mt-0.5 font-mono">
                      You're running the latest version
                      {updateInfo.currentVersion && (
                        <span className="text-gray-500"> (v{updateInfo.currentVersion})</span>
                      )}
                    </p>
                    {lastCheck && (
                      <p className="text-[9px] text-gray-600 mt-1 font-mono flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        Checked at {lastCheck}
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Close */}
              <button
                onClick={() => {
                  setDismissed(true);
                  setVisible(false);
                  onDismiss();
                }}
                className="p-1 rounded-lg hover:bg-white/[0.08] text-gray-500 hover:text-white transition-all cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
