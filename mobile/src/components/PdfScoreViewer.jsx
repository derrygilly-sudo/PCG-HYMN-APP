// src/components/PdfScoreViewer.jsx
import {
  IconArrowsMaximize,
  IconCloudCheck,
  IconDownload,
  IconExternalLink,
  IconFileText,
  IconMaximize,
  IconMusic,
  IconRefresh,
  IconShare,
  IconX,
} from "@tabler/icons-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import * as FileSystem from "expo-file-system";
import {
  downloadAndCachePdf,
  generatePdfViewerHtml,
  getLocalPdfPath,
  resolvePdfUrl,
  shareOrOpenPdf,
} from "../services/pdfService";
import { useSettingsStore } from "../stores/settingsStore";
import { getThemeColors, theme } from "../theme/theme";

const PdfScoreViewer = ({
  rawUrl,
  hymn,
  scoreType = "solfa", // 'solfa' | 'staff'
  label = "Musical Score",
}) => {
  const darkMode = useSettingsStore((state) => state.darkMode);
  const colors = getThemeColors(darkMode);

  const [resolvedUri, setResolvedUri] = useState(null);
  const [localUri, setLocalUri] = useState(null);
  const [base64Data, setBase64Data] = useState(null);
  const [isCached, setIsCached] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [useGoogleDocsFallback, setUseGoogleDocsFallback] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const webViewRef = useRef(null);
  const fullscreenWebViewRef = useRef(null);

  useEffect(() => {
    checkAndPrepareScore();
  }, [rawUrl, hymn?.id, scoreType]);

  const checkAndPrepareScore = async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const fullUrl = resolvePdfUrl(rawUrl);
      setResolvedUri(fullUrl);

      // Check local cache in app storage
      if (hymn?.id) {
        const cachedPath = await getLocalPdfPath(hymn.id, scoreType);
        if (cachedPath) {
          setLocalUri(cachedPath);
          setIsCached(true);

          // Read base64 for seamless offline Android WebView rendering
          if (Platform.OS === "android") {
            try {
              const base64 = await FileSystem.readAsStringAsync(cachedPath, {
                encoding: FileSystem.EncodingType.Base64,
              });
              setBase64Data(base64);
            } catch (err) {
              console.warn("Failed reading local PDF base64:", err);
            }
          }
        } else {
          setLocalUri(null);
          setIsCached(false);
          setBase64Data(null);
        }
      }
    } catch (e) {
      console.error("Score prep error:", e);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!resolvedUri || !hymn?.id) return;
    setIsDownloading(true);
    setDownloadProgress(0);

    const res = await downloadAndCachePdf(
      hymn.id,
      scoreType,
      resolvedUri,
      (p) => setDownloadProgress(p)
    );

    setIsDownloading(false);
    if (res.success && res.uri) {
      setLocalUri(res.uri);
      setIsCached(true);
      if (Platform.OS === "android") {
        try {
          const base64 = await FileSystem.readAsStringAsync(res.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          setBase64Data(base64);
        } catch (e) {}
      }
      Alert.alert("Saved Offline", `${label} is now available offline on your device.`);
    } else {
      Alert.alert("Download Error", "Could not save PDF score. Please check your network connection.");
    }
  };

  const handleShareOrOpen = async () => {
    const target = localUri || resolvedUri;
    if (!target) return;
    const title = `PCG Hymn #${hymn?.hymn_number || ""} - ${label}`;
    await shareOrOpenPdf(target, title);
  };

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "OPEN_EXTERNAL") {
        handleShareOrOpen();
      } else if (data.type === "ERROR") {
        setHasError(true);
      } else if (data.type === "LOADED") {
        setIsLoading(false);
      }
    } catch (e) {}
  };

  if (!rawUrl) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <IconMusic size={36} color={colors.textSecondary} strokeWidth={1.5} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>{label} Not Available</Text>
        <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
          Sheet music has not been uploaded for Hymn #{hymn?.hymn_number || ""}.
        </Text>
      </View>
    );
  }

  // Construct WebView source
  const getWebViewSource = () => {
    // 1. Google Docs Viewer fallback for Android if requested
    if (Platform.OS === "android" && useGoogleDocsFallback && resolvedUri) {
      return {
        uri: `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(resolvedUri)}`,
      };
    }

    // 2. iOS natively renders PDF files flawlessly directly via URI
    if (Platform.OS === "ios") {
      const uriToUse = localUri || resolvedUri;
      return { uri: uriToUse };
    }

    // 3. Web platform: standard URL
    if (Platform.OS === "web") {
      return { uri: localUri || resolvedUri };
    }

    // 4. Android default: High-quality Mozilla PDF.js embedded HTML viewer
    const htmlContent = generatePdfViewerHtml({
      pdfUrl: base64Data ? "" : resolvedUri,
      base64Data: base64Data,
      darkMode,
      title: `${label} - Hymn #${hymn?.hymn_number || ""}`,
    });

    return { html: htmlContent, baseUrl: "https://cdnjs.cloudflare.com" };
  };

  const webViewSource = getWebViewSource();

  return (
    <View style={styles.wrapper}>
      {/* Score Header Card */}
      <View style={[styles.toolbarCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.toolbarLeft}>
          <View style={[styles.typeIconBadge, { backgroundColor: scoreType === "staff" ? "#eef2ff" : "#fef3c7" }]}>
            {scoreType === "staff" ? (
              <IconMusic size={18} color="#18227c" strokeWidth={2} />
            ) : (
              <IconFileText size={18} color="#b45309" strokeWidth={2} />
            )}
          </View>
          <View>
            <Text style={[styles.scoreTitle, { color: colors.text }]}>{label}</Text>
            <View style={styles.badgeRow}>
              <View style={[styles.formatBadge, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
                <Text style={[styles.formatBadgeText, { color: colors.primary }]}>PDF Document</Text>
              </View>
              {isCached && (
                <View style={[styles.cachedBadge, { backgroundColor: "#dcfce7" }]}>
                  <IconCloudCheck size={12} color="#15803d" strokeWidth={2.5} />
                  <Text style={styles.cachedBadgeText}>Saved Offline</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.toolbarActions}>
          {/* Download / Saved Button */}
          {isDownloading ? (
            <View style={[styles.actionBtn, { backgroundColor: colors.surfaceCard }]}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : isCached ? (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnActive, { backgroundColor: "#dcfce7" }]}
              onPress={() => Alert.alert("Offline Ready", "This score PDF is saved locally for offline use.")}
              title="Saved Offline"
            >
              <IconCloudCheck size={18} color="#15803d" strokeWidth={2.2} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.surfaceCard }]}
              onPress={handleDownload}
              title="Save Offline"
            >
              <IconDownload size={18} color={colors.text} strokeWidth={2} />
            </TouchableOpacity>
          )}

          {/* Share / Open External Button */}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.surfaceCard }]}
            onPress={handleShareOrOpen}
            title="Share or Open in PDF Reader"
          >
            <IconShare size={18} color={colors.text} strokeWidth={2} />
          </TouchableOpacity>

          {/* Fullscreen Expand Button */}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            onPress={() => setIsFullscreen(true)}
            title="Expand Fullscreen"
          >
            <IconMaximize size={18} color="#FFFFFF" strokeWidth={2.2} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Embedded In-Screen PDF Viewer */}
      <View style={[styles.viewerContainer, { backgroundColor: darkMode ? "#0f172a" : "#f1f5f9", borderColor: colors.border }]}>
        <WebView
          key={`inline-webview-${reloadKey}-${useGoogleDocsFallback ? "gdocs" : "pdfjs"}`}
          ref={webViewRef}
          source={webViewSource}
          style={styles.webView}
          originWhitelist={["*"]}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowFileAccess={true}
          allowUniversalAccessFromFileURLs={true}
          mixedContentMode="always"
          scalesPageToFit={true}
          bounces={false}
          onMessage={handleMessage}
          onLoadStart={() => setIsLoading(true)}
          onLoadEnd={() => setIsLoading(false)}
          onError={() => {
            setIsLoading(false);
            setHasError(true);
          }}
        />

        {/* Loading Indicator */}
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading sheet score...
            </Text>
          </View>
        )}

        {/* Fallback & Helper Bar */}
        <View style={[styles.footerBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={styles.footerLink}
            onPress={() => setIsFullscreen(true)}
          >
            <IconArrowsMaximize size={14} color={colors.primary} strokeWidth={2} />
            <Text style={[styles.footerLinkText, { color: colors.primary }]}>
              Tap for Fullscreen Choir View
            </Text>
          </TouchableOpacity>

          {Platform.OS === "android" && (
            <TouchableOpacity
              style={styles.footerLink}
              onPress={() => {
                setUseGoogleDocsFallback((prev) => !prev);
                setReloadKey((k) => k + 1);
              }}
            >
              <IconRefresh size={13} color={colors.textSecondary} />
              <Text style={[styles.footerLinkText, { color: colors.textSecondary }]}>
                {useGoogleDocsFallback ? "Use PDF.js Engine" : "Switch Engine"}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.footerLink}
            onPress={handleShareOrOpen}
          >
            <IconExternalLink size={13} color={colors.textSecondary} />
            <Text style={[styles.footerLinkText, { color: colors.textSecondary }]}>
              External Reader
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* FULLSCREEN CHOIR / ORGANIST MODAL */}
      <Modal
        visible={isFullscreen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setIsFullscreen(false)}
      >
        <SafeAreaView style={[styles.fullscreenSafeArea, { backgroundColor: darkMode ? "#0f172a" : "#ffffff" }]}>
          <StatusBar hidden={false} barStyle={darkMode ? "light-content" : "dark-content"} />

          {/* Fullscreen Top Header */}
          <View style={[styles.fullscreenHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <View style={styles.fullscreenTitleWrap}>
              <Text style={[styles.fullscreenTitle, { color: colors.text }]} numberOfLines={1}>
                #{hymn?.hymn_number} - {hymn?.title_en || hymn?.title_twi}
              </Text>
              <Text style={[styles.fullscreenSubtitle, { color: colors.textSecondary }]}>
                {label} {hymn?.key_signature ? `• Key: ${hymn.key_signature}` : ""}
              </Text>
            </View>

            <View style={styles.fullscreenActions}>
              <TouchableOpacity
                style={[styles.iconBtn, { backgroundColor: colors.surfaceCard }]}
                onPress={handleShareOrOpen}
                title="Share"
              >
                <IconShare size={18} color={colors.text} strokeWidth={2} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.closeBtn, { backgroundColor: darkMode ? "#334155" : "#e2e8f0" }]}
                onPress={() => setIsFullscreen(false)}
              >
                <IconX size={20} color={colors.text} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Fullscreen WebView */}
          <View style={styles.fullscreenWebViewContainer}>
            <WebView
              key={`fullscreen-webview-${reloadKey}-${useGoogleDocsFallback ? "gdocs" : "pdfjs"}`}
              ref={fullscreenWebViewRef}
              source={webViewSource}
              style={styles.webView}
              originWhitelist={["*"]}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              allowFileAccess={true}
              allowUniversalAccessFromFileURLs={true}
              mixedContentMode="always"
              scalesPageToFit={true}
              bounces={false}
              onMessage={handleMessage}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 16,
    marginVertical: 10,
  },
  toolbarCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  toolbarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  typeIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreTitle: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  formatBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  formatBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  cachedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  cachedBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#15803d",
  },
  toolbarActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnActive: {
    borderWidth: 1,
    borderColor: "#86efac",
  },
  viewerContainer: {
    height: 480,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
  },
  webView: {
    flex: 1,
    backgroundColor: "transparent",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: "600",
  },
  footerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  footerLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  footerLinkText: {
    fontSize: 11.5,
    fontWeight: "600",
  },
  emptyContainer: {
    marginHorizontal: 16,
    marginVertical: 12,
    padding: 32,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  fullscreenSafeArea: {
    flex: 1,
  },
  fullscreenHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  fullscreenTitleWrap: {
    flex: 1,
    paddingRight: 12,
  },
  fullscreenTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  fullscreenSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  fullscreenActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  fullscreenWebViewContainer: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
});

export default PdfScoreViewer;
