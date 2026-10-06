package com.falconrodmaker.pos;

import android.Manifest;
import android.app.Dialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.Message;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.browser.customtabs.CustomTabsIntent;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

public class MainActivity extends BridgeActivity {
    private PermissionRequest pendingPermissionRequest = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeAppOpenerPlugin.class);
        registerPlugin(NativeSpeechRecognizerPlugin.class);
        registerPlugin(NativeFileSaverPlugin.class);
        super.onCreate(savedInstanceState);
        try {
            WebView webView = this.getBridge() != null ? this.getBridge().getWebView() : null;
            if (webView != null) {
                WebSettings settings = webView.getSettings();
                settings.setJavaScriptCanOpenWindowsAutomatically(true);
                settings.setSupportMultipleWindows(true);
                settings.setDomStorageEnabled(true);
                settings.setDatabaseEnabled(true);
                CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

                webView.setWebChromeClient(new WebChromeClient() {
                    @Override
                    public void onPermissionRequest(final PermissionRequest request) {
                        MainActivity.this.runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                try {
                                    if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                                        request.grant(request.getResources());
                                    } else {
                                        pendingPermissionRequest = request;
                                        ActivityCompat.requestPermissions(MainActivity.this, new String[]{Manifest.permission.RECORD_AUDIO}, 1002);
                                    }
                                } catch (Exception e) {
                                    e.printStackTrace();
                                    try {
                                        request.grant(request.getResources());
                                    } catch (Exception ignored) {}
                                }
                            }
                        });
                    }

                    @Override
                    public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                        try {
                            final Dialog authDialog = new Dialog(MainActivity.this, android.R.style.Theme_DeviceDefault_NoActionBar_Fullscreen);
                            final WebView popupWebView = new WebView(MainActivity.this);
                            WebSettings popupSettings = popupWebView.getSettings();
                            popupSettings.setJavaScriptEnabled(true);
                            popupSettings.setDomStorageEnabled(true);
                            popupSettings.setSupportMultipleWindows(true);
                            popupSettings.setJavaScriptCanOpenWindowsAutomatically(true);
                            CookieManager.getInstance().setAcceptThirdPartyCookies(popupWebView, true);

                            popupWebView.setWebChromeClient(new WebChromeClient() {
                                @Override
                                public void onCloseWindow(WebView window) {
                                    if (authDialog.isShowing()) {
                                        authDialog.dismiss();
                                    }
                                }
                            });

                            popupWebView.setWebViewClient(new WebViewClient() {
                                @Override
                                public boolean shouldOverrideUrlLoading(WebView view, String url) {
                                    if (url == null) return false;
                                    try {
                                        // 0. WhatsApp App Scheme & Web Links
                                        if (url.startsWith("whatsapp://")) {
                                            try {
                                                Intent waIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                                                waIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                                MainActivity.this.startActivity(waIntent);
                                                if (authDialog.isShowing()) {
                                                    authDialog.dismiss();
                                                }
                                                return true;
                                            } catch (Exception notInstalled) {
                                                try {
                                                    Intent playStore = new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=com.whatsapp"));
                                                    playStore.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                                    MainActivity.this.startActivity(playStore);
                                                    if (authDialog.isShowing()) authDialog.dismiss();
                                                    return true;
                                                } catch (Exception ignored) {}
                                            }
                                        }

                                        if (url.contains("api.whatsapp.com") || url.contains("wa.me")) {
                                            try {
                                                Intent waIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                                                waIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                                MainActivity.this.startActivity(waIntent);
                                                if (authDialog.isShowing()) {
                                                    authDialog.dismiss();
                                                }
                                                return true;
                                            } catch (Exception ignored) {}
                                        }

                                        // 1. Android Intent URLs (intent://... -> launch Google Sheets/Drive app directly)
                                        if (url.startsWith("intent://") || url.startsWith("market://")) {
                                            Intent intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME);
                                            if (intent != null) {
                                                try {
                                                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                                    MainActivity.this.startActivity(intent);
                                                    if (authDialog.isShowing()) {
                                                        authDialog.dismiss();
                                                    }
                                                    return true;
                                                } catch (Exception notInstalledErr) {
                                                    String fallbackUrl = intent.getStringExtra("browser_fallback_url");
                                                    if (fallbackUrl != null) {
                                                        Intent fallbackIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(fallbackUrl));
                                                        fallbackIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                                        MainActivity.this.startActivity(fallbackIntent);
                                                        if (authDialog.isShowing()) {
                                                            authDialog.dismiss();
                                                        }
                                                        return true;
                                                    }
                                                }
                                            }
                                        }

                                        // 2. Direct Google Sheets URL -> launch native Google Sheets app directly
                                        if (url.contains("docs.google.com/spreadsheets")) {
                                            Intent docIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                                            docIntent.setPackage("com.google.android.apps.docs.editors.sheets");
                                            docIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                            try {
                                                MainActivity.this.startActivity(docIntent);
                                                if (authDialog.isShowing()) {
                                                    authDialog.dismiss();
                                                }
                                                return true;
                                            } catch (Exception e) {
                                                // Fallback to Drive app or browser
                                                Intent fallback = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                                                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                                MainActivity.this.startActivity(fallback);
                                                if (authDialog.isShowing()) {
                                                    authDialog.dismiss();
                                                }
                                                return true;
                                            }
                                        }

                                        // 3. Direct Google Drive URL -> launch native Google Drive app directly
                                        if (url.contains("drive.google.com")) {
                                            Intent driveIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                                            driveIntent.setPackage("com.google.android.apps.docs");
                                            driveIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                            try {
                                                MainActivity.this.startActivity(driveIntent);
                                                if (authDialog.isShowing()) {
                                                    authDialog.dismiss();
                                                }
                                                return true;
                                            } catch (Exception e) {
                                                Intent fallback = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                                                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                                MainActivity.this.startActivity(fallback);
                                                if (authDialog.isShowing()) {
                                                    authDialog.dismiss();
                                                }
                                                return true;
                                            }
                                        }
                                    } catch (Exception e) {
                                        e.printStackTrace();
                                    }
                                    return false;
                                }
                            });

                            authDialog.setContentView(popupWebView);
                            authDialog.show();

                            WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                            transport.setWebView(popupWebView);
                            resultMsg.sendToTarget();
                            return true;
                        } catch (Exception e) {
                            e.printStackTrace();
                            return false;
                        }
                    }
                });
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
    }

    @CapacitorPlugin(name = "NativeAppOpener")
    public static class NativeAppOpenerPlugin extends Plugin {
        private void launchExplicitCustomTab(Uri uri) {
            try {
                CustomTabsIntent customTabs = new CustomTabsIntent.Builder()
                    .setShowTitle(true)
                    .setUrlBarHidingEnabled(true)
                    .build();
                customTabs.intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                // Attempt to target Chrome Custom Tabs explicitly if present
                customTabs.intent.setPackage("com.android.chrome");
                customTabs.launchUrl(getContext(), uri);
            } catch (Exception chromeNotFound) {
                try {
                    CustomTabsIntent genericCustomTabs = new CustomTabsIntent.Builder()
                        .setShowTitle(true)
                        .build();
                    genericCustomTabs.intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    genericCustomTabs.launchUrl(getContext(), uri);
                } catch (Exception genericFail) {
                    Intent web = new Intent(Intent.ACTION_VIEW, uri);
                    web.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(web);
                }
            }
        }

        @PluginMethod
        public void openApp(PluginCall call) {
            String url = call.getString("url");
            String targetApp = call.getString("targetApp");
            if (url == null || url.isEmpty()) {
                call.reject("URL is required");
                return;
            }

            try {
                Uri uri = Uri.parse(url);
                Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

                boolean isSheets = "sheets".equalsIgnoreCase(targetApp) || url.contains("docs.google.com/spreadsheets");
                boolean isDrive = "drive".equalsIgnoreCase(targetApp) || url.contains("drive.google.com");

                if (isSheets) {
                    PackageManager pm = getContext().getPackageManager();
                    // 1. Direct targeted ACTION_VIEW to Google Sheets app
                    try {
                        Intent sheetsIntent = new Intent(Intent.ACTION_VIEW, uri);
                        sheetsIntent.setPackage("com.google.android.apps.docs.editors.sheets");
                        sheetsIntent.addCategory(Intent.CATEGORY_BROWSABLE);
                        sheetsIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                        getContext().startActivity(sheetsIntent);
                        call.resolve();
                        return;
                    } catch (Exception e1) {
                        // 2. Try Launch Intent for Google Sheets app
                        try {
                            Intent launchIntent = pm.getLaunchIntentForPackage("com.google.android.apps.docs.editors.sheets");
                            if (launchIntent != null) {
                                launchIntent.setData(uri);
                                launchIntent.setAction(Intent.ACTION_VIEW);
                                launchIntent.addCategory(Intent.CATEGORY_BROWSABLE);
                                launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                getContext().startActivity(launchIntent);
                                call.resolve();
                                return;
                            }
                        } catch (Exception e2) {}

                        // 3. Fallback to Google Drive native app (can view and edit sheets)
                        try {
                            Intent driveIntent = new Intent(Intent.ACTION_VIEW, uri);
                            driveIntent.setPackage("com.google.android.apps.docs");
                            driveIntent.addCategory(Intent.CATEGORY_BROWSABLE);
                            driveIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                            getContext().startActivity(driveIntent);
                            call.resolve();
                            return;
                        } catch (Exception e3) {
                            launchExplicitCustomTab(uri);
                            call.resolve();
                            return;
                        }
                    }
                } else if (isDrive) {
                    PackageManager pm = getContext().getPackageManager();
                    // 1. Direct targeted ACTION_VIEW to Google Drive app
                    try {
                        Intent driveIntent = new Intent(Intent.ACTION_VIEW, uri);
                        driveIntent.setPackage("com.google.android.apps.docs");
                        driveIntent.addCategory(Intent.CATEGORY_BROWSABLE);
                        driveIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                        getContext().startActivity(driveIntent);
                        call.resolve();
                        return;
                    } catch (Exception e1) {
                        // 2. Try Launch Intent for Google Drive app
                        try {
                            Intent launchIntent = pm.getLaunchIntentForPackage("com.google.android.apps.docs");
                            if (launchIntent != null) {
                                launchIntent.setData(uri);
                                launchIntent.setAction(Intent.ACTION_VIEW);
                                launchIntent.addCategory(Intent.CATEGORY_BROWSABLE);
                                launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                getContext().startActivity(launchIntent);
                                call.resolve();
                                return;
                            }
                        } catch (Exception e2) {}

                        launchExplicitCustomTab(uri);
                        call.resolve();
                        return;
                    }
                }

                // Generic explicit Custom Tab for any other URL
                launchExplicitCustomTab(uri);
                call.resolve();
            } catch (Exception ex) {
                call.reject(ex.getMessage());
            }
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == 1002 && pendingPermissionRequest != null) {
            try {
                if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                    pendingPermissionRequest.grant(pendingPermissionRequest.getResources());
                } else {
                    pendingPermissionRequest.deny();
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
            pendingPermissionRequest = null;
        }
    }

    @CapacitorPlugin(name = "NativeSpeechRecognizer")
    public static class NativeSpeechRecognizerPlugin extends Plugin {
        private SpeechRecognizer speechRecognizer = null;
        private PluginCall activeCall = null;

        @PluginMethod
        public void isAvailable(PluginCall call) {
            boolean available = SpeechRecognizer.isRecognitionAvailable(getContext());
            JSObject ret = new JSObject();
            ret.put("available", available);
            call.resolve(ret);
        }

        @PluginMethod
        public void startListening(PluginCall call) {
            getActivity().runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                            ActivityCompat.requestPermissions(getActivity(), new String[]{Manifest.permission.RECORD_AUDIO}, 1002);
                            call.reject("RECORD_AUDIO permission requested. Please tap again.");
                            return;
                        }

                        if (speechRecognizer != null) {
                            try {
                                speechRecognizer.destroy();
                            } catch (Exception ignored) {}
                            speechRecognizer = null;
                        }

                        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
                        if (speechRecognizer == null) {
                            call.reject("SpeechRecognizer could not be created on this device");
                            return;
                        }

                        activeCall = call;
                        String lang = call.getString("language", "en-US");

                        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang);
                        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, lang);
                        intent.putExtra(RecognizerIntent.EXTRA_ONLY_RETURN_LANGUAGE_PREFERENCE, false);
                        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
                        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3);

                        speechRecognizer.setRecognitionListener(new RecognitionListener() {
                            @Override
                            public void onReadyForSpeech(Bundle params) {
                                JSObject data = new JSObject();
                                data.put("status", "ready");
                                notifyListeners("speechState", data);
                            }

                            @Override
                            public void onBeginningOfSpeech() {
                                JSObject data = new JSObject();
                                data.put("status", "listening");
                                notifyListeners("speechState", data);
                            }

                            @Override
                            public void onRmsChanged(float rmsdB) {
                                JSObject data = new JSObject();
                                int level = Math.max(0, Math.min(100, (int) ((rmsdB + 2) * 8.33f)));
                                data.put("level", level);
                                notifyListeners("speechRms", data);
                            }

                            @Override
                            public void onBufferReceived(byte[] buffer) {}

                            @Override
                            public void onEndOfSpeech() {
                                JSObject data = new JSObject();
                                data.put("status", "processing");
                                notifyListeners("speechState", data);
                            }

                            @Override
                            public void onError(int error) {
                                JSObject data = new JSObject();
                                data.put("error", error);
                                String errMsg = "Error " + error;
                                switch (error) {
                                    case SpeechRecognizer.ERROR_AUDIO: errMsg = "audio"; break;
                                    case SpeechRecognizer.ERROR_CLIENT: errMsg = "client"; break;
                                    case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS: errMsg = "not-allowed"; break;
                                    case SpeechRecognizer.ERROR_NETWORK:
                                    case SpeechRecognizer.ERROR_NETWORK_TIMEOUT: errMsg = "network"; break;
                                    case SpeechRecognizer.ERROR_NO_MATCH: errMsg = "no-speech"; break;
                                    case SpeechRecognizer.ERROR_RECOGNIZER_BUSY: errMsg = "busy"; break;
                                    case SpeechRecognizer.ERROR_SPEECH_TIMEOUT: errMsg = "no-speech"; break;
                                }
                                data.put("message", errMsg);
                                notifyListeners("speechError", data);

                                if (activeCall != null) {
                                    JSObject res = new JSObject();
                                    res.put("transcript", "");
                                    res.put("error", errMsg);
                                    activeCall.resolve(res);
                                    activeCall = null;
                                }
                            }

                            @Override
                            public void onResults(Bundle results) {
                                java.util.ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                                String transcript = (matches != null && !matches.isEmpty()) ? matches.get(0) : "";
                                JSObject data = new JSObject();
                                data.put("transcript", transcript);
                                data.put("isFinal", true);
                                notifyListeners("speechResult", data);

                                if (activeCall != null) {
                                    JSObject res = new JSObject();
                                    res.put("transcript", transcript);
                                    activeCall.resolve(res);
                                    activeCall = null;
                                }
                            }

                            @Override
                            public void onPartialResults(Bundle partialResults) {
                                java.util.ArrayList<String> matches = partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                                String transcript = (matches != null && !matches.isEmpty()) ? matches.get(0) : "";
                                if (!transcript.isEmpty()) {
                                    JSObject data = new JSObject();
                                    data.put("transcript", transcript);
                                    data.put("isFinal", false);
                                    notifyListeners("speechResult", data);
                                }
                            }

                            @Override
                            public void onEvent(int eventType, Bundle params) {}
                        });

                        speechRecognizer.startListening(intent);
                    } catch (Exception e) {
                        call.reject("Failed to start listening: " + e.getMessage());
                    }
                }
            });
        }

        @PluginMethod
        public void stopListening(PluginCall call) {
            getActivity().runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        if (speechRecognizer != null) {
                            speechRecognizer.stopListening();
                            speechRecognizer.cancel();
                            speechRecognizer.destroy();
                            speechRecognizer = null;
                        }
                        activeCall = null;
                        call.resolve();
                    } catch (Exception e) {
                        call.reject(e.getMessage());
                    }
                }
            });
        }
    }

    @CapacitorPlugin(name = "NativeFileSaver")
    public static class NativeFileSaverPlugin extends Plugin {
        @PluginMethod
        public void saveFile(PluginCall call) {
            String fileName = call.getString("fileName");
            String base64Data = call.getString("base64Data");
            String mimeType = call.getString("mimeType", "application/octet-stream");

            if (fileName == null || base64Data == null) {
                call.reject("fileName and base64Data are required");
                return;
            }

            if (base64Data.contains(",")) {
                base64Data = base64Data.substring(base64Data.indexOf(",") + 1);
            }

            try {
                byte[] fileBytes = android.util.Base64.decode(base64Data, android.util.Base64.DEFAULT);

                // Android 10+ (API 29+): MediaStore directly into Downloads
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                    android.content.ContentValues values = new android.content.ContentValues();
                    values.put(android.provider.MediaStore.MediaColumns.DISPLAY_NAME, fileName);
                    values.put(android.provider.MediaStore.MediaColumns.MIME_TYPE, mimeType);
                    values.put(android.provider.MediaStore.MediaColumns.RELATIVE_PATH, android.os.Environment.DIRECTORY_DOWNLOADS);

                    android.content.ContentResolver resolver = getContext().getContentResolver();
                    android.net.Uri uri = resolver.insert(android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);

                    if (uri != null) {
                        try (java.io.OutputStream out = resolver.openOutputStream(uri)) {
                            if (out != null) {
                                out.write(fileBytes);
                                out.flush();
                            }
                        }
                        JSObject ret = new JSObject();
                        ret.put("success", true);
                        ret.put("uri", uri.toString());
                        ret.put("message", "File saved to Downloads folder");
                        call.resolve(ret);
                        return;
                    }
                }

                // Android 9 and below fallback:
                java.io.File downloadDir = android.os.Environment.getExternalStoragePublicDirectory(android.os.Environment.DIRECTORY_DOWNLOADS);
                if (!downloadDir.exists()) {
                    downloadDir.mkdirs();
                }
                java.io.File destFile = new java.io.File(downloadDir, fileName);
                try (java.io.FileOutputStream fos = new java.io.FileOutputStream(destFile)) {
                    fos.write(fileBytes);
                    fos.flush();
                }

                android.media.MediaScannerConnection.scanFile(
                    getContext(),
                    new String[]{destFile.getAbsolutePath()},
                    new String[]{mimeType},
                    null
                );

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("path", destFile.getAbsolutePath());
                ret.put("message", "File saved to Downloads folder");
                call.resolve(ret);
            } catch (Exception e) {
                e.printStackTrace();
                call.reject("Error saving file: " + e.getMessage());
            }
        }

        @PluginMethod
        public void shareFile(PluginCall call) {
            String fileName = call.getString("fileName");
            String base64Data = call.getString("base64Data");
            String mimeType = call.getString("mimeType", "application/octet-stream");

            if (fileName == null || base64Data == null) {
                call.reject("fileName and base64Data are required");
                return;
            }

            if (base64Data.contains(",")) {
                base64Data = base64Data.substring(base64Data.indexOf(",") + 1);
            }

            try {
                byte[] fileBytes = android.util.Base64.decode(base64Data, android.util.Base64.DEFAULT);
                java.io.File cacheDir = new java.io.File(getContext().getCacheDir(), "exports");
                if (!cacheDir.exists()) cacheDir.mkdirs();
                java.io.File tempFile = new java.io.File(cacheDir, fileName);
                try (java.io.FileOutputStream fos = new java.io.FileOutputStream(tempFile)) {
                    fos.write(fileBytes);
                    fos.flush();
                }

                android.net.Uri contentUri = androidx.core.content.FileProvider.getUriForFile(
                    getContext(),
                    getContext().getPackageName() + ".fileprovider",
                    tempFile
                );

                Intent shareIntent = new Intent(Intent.ACTION_SEND);
                String resolvedMime = (mimeType != null && !mimeType.isEmpty() && !mimeType.equals("application/octet-stream"))
                    ? mimeType
                    : (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg")) ? "image/jpeg"
                    : fileName.endsWith(".png") ? "image/png"
                    : fileName.endsWith(".pdf") ? "application/pdf"
                    : "image/jpeg";
                shareIntent.setType(resolvedMime);
                shareIntent.putExtra(Intent.EXTRA_STREAM, contentUri);
                shareIntent.setClipData(android.content.ClipData.newRawUri("Export File", contentUri));
                shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                java.util.List<android.content.pm.ResolveInfo> resInfoList = getContext().getPackageManager().queryIntentActivities(shareIntent, android.content.pm.PackageManager.MATCH_DEFAULT_ONLY);
                for (android.content.pm.ResolveInfo resolveInfo : resInfoList) {
                    String packageName = resolveInfo.activityInfo.packageName;
                    getContext().grantUriPermission(packageName, contentUri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
                }

                Intent chooser = Intent.createChooser(shareIntent, "Share " + fileName);
                chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

                getActivity().runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        try {
                            getActivity().startActivity(chooser);
                        } catch (Exception actErr) {
                            try {
                                getContext().startActivity(chooser);
                            } catch (Exception ignored) {}
                        }
                    }
                });

                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
            } catch (Exception e) {
                e.printStackTrace();
                call.reject("Error sharing file: " + e.getMessage());
            }
        }
    }
}
