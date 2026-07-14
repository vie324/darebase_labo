"use client";

// =============================================================
// ロープレ練習 — 「練習する」タブ
// スクリプト選択 → 録音/画面録画 → リアルタイム文字起こし → レビュー保存
// =============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  FileText,
  Gauge,
  Headphones,
  Mic,
  Monitor,
  RotateCcw,
  Save,
  Sparkles,
  Square,
  Type,
  Volume2,
} from "lucide-react";
import { Badge, Button, Card, Field, Select, Textarea } from "@/components/ui";
import { storeFile } from "@/lib/supabase";
import { cn, formatDuration, renderMarkdown, uid } from "@/lib/utils";
import type { RoleplaySession, TalkScript } from "@/lib/types";
import {
  analyzeTranscript,
  getSpeechRecognition,
  MODE_META,
  rateAssessment,
  scriptCategoryColor,
  type RoleplayMode,
  type SpeechRecognitionLike,
} from "./helpers";

type Phase = "setup" | "practice" | "review" | "saved";

type NewSession = Omit<RoleplaySession, "id" | "created_at"> &
  Partial<Pick<RoleplaySession, "id" | "created_at">>;

export function PracticePanel({
  scripts,
  initialScriptId,
  userName,
  addSession,
  onSaved,
}: {
  scripts: TalkScript[];
  initialScriptId: string;
  userName: string;
  addSession: (row: NewSession) => Promise<RoleplaySession>;
  onSaved: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("setup");
  const [scriptId, setScriptId] = useState<string>(initialScriptId);
  const [mode, setMode] = useState<RoleplayMode>("audio");

  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [selfNote, setSelfNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedPersistent, setSavedPersistent] = useState(true);

  const [mediaBlob, setMediaBlob] = useState<Blob | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string>("");

  // refs（コールバック内で最新値を参照するため）
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const timerRef = useRef<number | null>(null);
  const startAtRef = useRef<number>(0);
  const recordingRef = useRef(false);
  const mediaUrlRef = useRef<string>("");

  const speechSupported = typeof window !== "undefined" && getSpeechRecognition() !== null;

  const selectedScript = scripts.find((s) => s.id === scriptId) ?? null;

  // ---------- 後片付け ----------
  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopRecognition = useCallback(() => {
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    if (rec) {
      rec.onresult = null;
      rec.onend = null;
      rec.onerror = null;
      try {
        rec.stop();
      } catch {
        // already stopped
      }
    }
  }, []);

  const revokeMedia = useCallback(() => {
    if (mediaUrlRef.current) {
      URL.revokeObjectURL(mediaUrlRef.current);
      mediaUrlRef.current = "";
    }
  }, []);

  // アンマウント時に全リソース解放
  useEffect(() => {
    return () => {
      recordingRef.current = false;
      clearTimer();
      stopRecognition();
      stopTracks();
      try {
        recorderRef.current?.stop();
      } catch {
        // noop
      }
      revokeMedia();
    };
  }, [clearTimer, stopRecognition, stopTracks, revokeMedia]);

  function resetToSetup() {
    recordingRef.current = false;
    setRecording(false);
    clearTimer();
    stopRecognition();
    stopTracks();
    revokeMedia();
    setElapsed(0);
    setTranscript("");
    setInterim("");
    setSelfNote("");
    setError(null);
    setMediaBlob(null);
    setMediaUrl("");
    chunksRef.current = [];
    setPhase("setup");
  }

  // ---------- 音声認識 ----------
  const startRecognition = useCallback(() => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "ja-JP";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (event) => {
      let interimText = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) finalText += text;
        else interimText += text;
      }
      if (finalText) setTranscript((prev) => (prev ? prev + finalText : finalText));
      setInterim(interimText);
    };
    rec.onend = () => {
      // continuous でも無音で止まることがあるため録音中は再開
      if (recordingRef.current) {
        try {
          rec.start();
        } catch {
          // 連続 start の例外は無視
        }
      }
    };
    rec.onerror = () => {
      // no-speech / aborted 等は無視（録音は継続）
    };
    recognitionRef.current = rec;
    try {
      rec.start();
    } catch {
      // noop
    }
  }, []);

  // ---------- 録音停止 ----------
  const stopRecording = useCallback(() => {
    if (!recordingRef.current) return;
    recordingRef.current = false;
    setRecording(false);
    clearTimer();
    stopRecognition();
    setInterim("");
    try {
      recorderRef.current?.stop(); // onstop で review へ
    } catch {
      // noop
    }
    stopTracks();
  }, [clearTimer, stopRecognition, stopTracks]);

  // ---------- 録音開始 ----------
  const beginRecording = useCallback(async () => {
    setError(null);
    setTranscript("");
    setInterim("");
    setElapsed(0);
    revokeMedia();
    setMediaBlob(null);
    setMediaUrl("");
    chunksRef.current = [];

    let stream: MediaStream;
    try {
      stream =
        mode === "screen"
          ? await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
          : await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setError(
          mode === "screen"
            ? "画面共有がキャンセルされたか、許可されませんでした。もう一度お試しください。"
            : "マイクの使用が許可されませんでした。ブラウザのアドレスバーの権限設定からマイクを許可してください。"
        );
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setError("マイク／録画デバイスが見つかりませんでした。デバイスの接続をご確認ください。");
      } else if (name === "NotReadableError") {
        setError("デバイスに接続できませんでした。他のアプリがマイクを使用していないかご確認ください。");
      } else if (name === "AbortError") {
        setError("録画の開始が中断されました。もう一度お試しください。");
      } else {
        setError("録音を開始できませんでした。ブラウザの権限設定をご確認ください。");
      }
      return;
    }

    streamRef.current = stream;
    // 画面共有をブラウザUIから停止した場合に自動で録音終了
    stream.getVideoTracks().forEach((t) => {
      t.addEventListener("ended", () => stopRecording());
    });

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream);
    } catch {
      stopTracks();
      setError("このブラウザは録音（MediaRecorder）に対応していません。");
      return;
    }
    recorderRef.current = recorder;
    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
    };
    recorder.onstop = () => {
      const type = recorder.mimeType || (mode === "screen" ? "video/webm" : "audio/webm");
      const blob = new Blob(chunksRef.current, { type });
      const url = URL.createObjectURL(blob);
      mediaUrlRef.current = url;
      setMediaBlob(blob);
      setMediaUrl(url);
      setPhase("review");
    };
    recorder.start();

    recordingRef.current = true;
    setRecording(true);
    startAtRef.current = Date.now();
    clearTimer();
    timerRef.current = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startAtRef.current) / 1000));
    }, 250);

    startRecognition();
  }, [mode, revokeMedia, startRecognition, stopTracks, clearTimer, stopRecording]);

  // ---------- 保存 ----------
  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      let media_url = "";
      let persistent = true;
      if (mediaBlob) {
        const ext = mode === "screen" ? "webm" : "webm";
        const res = await storeFile(mediaBlob, `roleplay/${uid()}.${ext}`);
        media_url = res.url;
        persistent = res.persistent;
      }
      await addSession({
        script_id: scriptId,
        script_title: selectedScript ? selectedScript.title : "自由練習",
        user_name: userName,
        mode,
        duration_sec: elapsed,
        transcript: transcript.trim(),
        self_note: selfNote.trim(),
        feedbacks: [],
        media_url,
      });
      setSavedPersistent(persistent);
      setPhase("saved");
    } catch {
      setError("保存に失敗しました。もう一度お試しください。");
    } finally {
      setSaving(false);
    }
  };

  const modeMeta = MODE_META[mode];

  // ============================================================
  // 表示
  // ============================================================

  if (phase === "saved") {
    return (
      <Card className="mx-auto max-w-xl animate-scale-in p-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
          <Check className="h-8 w-8" />
        </div>
        <h2 className="mt-4 text-lg font-bold">練習を保存しました</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          練習履歴からいつでも振り返り・フィードバックができます。
        </p>
        {!savedPersistent && (
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-left text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              録画データはこのセッション中のみ再生可能です（ファイルが大きいため永続保存されていません）。
            </span>
          </div>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button variant="secondary" onClick={resetToSetup}>
            <RotateCcw className="h-4 w-4" />
            もう一度練習する
          </Button>
          <Button onClick={onSaved}>練習履歴を見る</Button>
        </div>
      </Card>
    );
  }

  if (phase === "review") {
    return (
      <div className="animate-fade-in space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge className={modeMeta.color}>
              {modeMeta.emoji} {modeMeta.label}
            </Badge>
            <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {selectedScript ? selectedScript.title : "自由練習"}
            </Badge>
            <span className="text-sm font-semibold tabular-nums text-slate-500 dark:text-slate-400">
              {formatDuration(elapsed)}
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={resetToSetup}>
            <RotateCcw className="h-4 w-4" />
            録り直す
          </Button>
        </div>

        {error && <ErrorBanner message={error} />}

        <div className="grid gap-4 lg:grid-cols-2">
          {/* プレビュー再生 */}
          <Card className="p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
              {mode === "screen" ? (
                <Monitor className="h-4 w-4 text-sky-500" />
              ) : (
                <Volume2 className="h-4 w-4 text-sky-500" />
              )}
              録音プレビュー
            </h3>
            {mediaUrl ? (
              mode === "screen" ? (
                <video
                  src={mediaUrl}
                  controls
                  className="w-full rounded-xl border border-slate-200 bg-black dark:border-slate-700"
                />
              ) : (
                <audio src={mediaUrl} controls className="w-full" />
              )
            ) : (
              <p className="text-sm text-slate-400 dark:text-slate-500">
                プレビューは利用できません。
              </p>
            )}
          </Card>

          {/* 簡易分析 */}
          <Card className="p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
              <Sparkles className="h-4 w-4 text-cyan-500" />
              簡易分析
            </h3>
            <AnalysisGrid durationSec={elapsed} transcript={transcript} />
          </Card>
        </div>

        {/* 文字起こし編集 */}
        <Card className="p-5">
          <Field label="文字起こし（編集できます）">
            <Textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={6}
              placeholder={
                speechSupported
                  ? "自動文字起こし結果です。必要に応じて修正してください。"
                  : "録音内容を手動で入力してください（このブラウザは自動文字起こしに非対応です）。"
              }
              className="min-h-32"
            />
          </Field>
          {!speechSupported && (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-3.5 w-3.5" />
              自動文字起こし非対応ブラウザのため、手動入力に基づいて分析します。
            </p>
          )}
        </Card>

        {/* セルフ振り返り */}
        <Card className="p-5">
          <Field label="セルフ振り返りメモ">
            <Textarea
              value={selfNote}
              onChange={(e) => setSelfNote(e.target.value)}
              rows={3}
              placeholder="よかった点 / 改善したい点をメモしましょう。"
            />
          </Field>
        </Card>

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={resetToSetup} disabled={saving}>
            破棄する
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? "保存中…" : "この練習を保存"}
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "practice") {
    return (
      <div className="animate-fade-in space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge className={modeMeta.color}>
              {modeMeta.emoji} {modeMeta.label}
            </Badge>
            {selectedScript ? (
              <Badge className={scriptCategoryColor(selectedScript.category)}>
                {selectedScript.category}
              </Badge>
            ) : (
              <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                自由練習
              </Badge>
            )}
          </div>
          {!recording && (
            <Button variant="ghost" size="sm" onClick={resetToSetup}>
              設定に戻る
            </Button>
          )}
        </div>

        {error && <ErrorBanner message={error} />}

        {!speechSupported && (
          <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              このブラウザは音声認識に非対応です。録音後に手動で文字起こしを入力できます。
            </span>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          {/* 左: スクリプト本文 */}
          <Card className="flex flex-col p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
              <FileText className="h-4 w-4 text-cyan-500" />
              {selectedScript ? selectedScript.title : "自由練習"}
            </h3>
            {selectedScript ? (
              <>
                {selectedScript.scenario && (
                  <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                    {selectedScript.scenario}
                  </p>
                )}
                <div
                  className="prose-simple scrollbar-thin max-h-[52vh] overflow-y-auto pr-1 text-sm"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedScript.content) }}
                />
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center py-10 text-center text-sm text-slate-400 dark:text-slate-500">
                <Mic className="mb-2 h-8 w-8" />
                スクリプトなしの自由練習モードです。
                <br />
                自分の言葉でトークを練習しましょう。
              </div>
            )}
          </Card>

          {/* 右: 録音パネル */}
          <Card className="flex flex-col items-center justify-center gap-5 p-6">
            {recording ? (
              <>
                <div className="flex items-center gap-2 rounded-full bg-rose-50 px-4 py-1.5 text-sm font-semibold text-rose-600 dark:bg-rose-500/15 dark:text-rose-300">
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500" />
                  録音中
                </div>
                <div className="text-center">
                  <p className="text-5xl font-bold tabular-nums tracking-tight">
                    {formatDuration(elapsed)}
                  </p>
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">経過時間</p>
                </div>
                <button
                  onClick={stopRecording}
                  className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-full bg-rose-600 text-white shadow-lg shadow-rose-500/30 transition-transform hover:bg-rose-500 active:scale-95"
                  aria-label="録音を停止"
                >
                  <Square className="h-6 w-6 fill-current" />
                </button>
                <p className="text-xs text-slate-400 dark:text-slate-500">停止して振り返る</p>

                {/* リアルタイム文字起こし */}
                <div className="w-full">
                  <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    <Type className="h-3.5 w-3.5" />
                    リアルタイム文字起こし
                  </p>
                  <div className="scrollbar-thin h-28 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-sm leading-relaxed dark:border-slate-700 dark:bg-slate-800/40">
                    {transcript || interim ? (
                      <p>
                        {transcript}
                        {interim && (
                          <span className="text-slate-400 dark:text-slate-500">{interim}</span>
                        )}
                      </p>
                    ) : (
                      <p className="text-slate-400 dark:text-slate-500">
                        {speechSupported
                          ? "話し始めると文字起こしが表示されます…"
                          : "音声認識に非対応のため、録音後に手動入力してください。"}
                      </p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div
                  className={cn(
                    "flex h-16 w-16 items-center justify-center rounded-2xl",
                    mode === "screen"
                      ? "bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400"
                      : "bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400"
                  )}
                >
                  {mode === "screen" ? (
                    <Monitor className="h-8 w-8" />
                  ) : (
                    <Headphones className="h-8 w-8" />
                  )}
                </div>
                <div className="text-center">
                  <p className="font-semibold">{modeMeta.label}の準備ができました</p>
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    {mode === "screen"
                      ? "録画開始後に共有する画面を選択します。"
                      : "ボタンを押すとマイクの使用許可を求めます。"}
                  </p>
                </div>
                <button
                  onClick={beginRecording}
                  className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-full bg-rose-600 text-white shadow-lg shadow-rose-500/30 transition-transform hover:bg-rose-500 active:scale-95"
                  aria-label="録音を開始"
                >
                  <span className="h-6 w-6 rounded-full bg-white" />
                </button>
                <p className="text-xs text-slate-400 dark:text-slate-500">タップして録音開始</p>
              </>
            )}
          </Card>
        </div>
      </div>
    );
  }

  // ---------- setup ----------
  return (
    <div className="mx-auto max-w-2xl animate-fade-in">
      <Card className="p-6">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <Mic className="h-5 w-5 text-cyan-500" />
          練習をはじめる
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          スクリプトと録音モードを選んで、ロープレを始めましょう。
        </p>

        {error && (
          <div className="mt-4">
            <ErrorBanner message={error} />
          </div>
        )}

        <div className="mt-5 space-y-5">
          <Field label="スクリプト">
            <Select value={scriptId} onChange={(e) => setScriptId(e.target.value)}>
              <option value="">自由練習（スクリプトなし）</option>
              {scripts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </Select>
          </Field>

          <div>
            <span className="mb-1.5 block text-xs font-semibold text-slate-500 dark:text-slate-400">
              録音モード
            </span>
            <div className="grid grid-cols-2 gap-3">
              <ModeCard
                active={mode === "audio"}
                onClick={() => setMode("audio")}
                icon={<Mic className="h-5 w-5" />}
                title="録音のみ"
                desc="マイク音声を録音"
                accent="sky"
              />
              <ModeCard
                active={mode === "screen"}
                onClick={() => setMode("screen")}
                icon={<Monitor className="h-5 w-5" />}
                title="画面録画"
                desc="画面＋音声を録画"
                accent="sky"
              />
            </div>
          </div>

          {selectedScript && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-800/40">
              <div className="mb-1.5 flex items-center gap-2">
                <Badge className={scriptCategoryColor(selectedScript.category)}>
                  {selectedScript.category}
                </Badge>
                <span className="text-sm font-semibold">{selectedScript.title}</span>
              </div>
              {selectedScript.scenario && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedScript.scenario}
                </p>
              )}
            </div>
          )}

          <Button size="lg" className="w-full" onClick={() => setPhase("practice")}>
            <Gauge className="h-5 w-5" />
            練習画面へ進む
          </Button>
        </div>
      </Card>
    </div>
  );
}

// ---------- サブコンポーネント ----------

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function ModeCard({
  active,
  onClick,
  icon,
  title,
  desc,
  accent,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
  accent: "sky" | "sky";
}) {
  const activeRing =
    accent === "sky"
      ? "border-sky-400 bg-sky-50 dark:border-sky-500/50 dark:bg-sky-500/10"
      : "border-sky-400 bg-sky-50 dark:border-sky-500/50 dark:bg-sky-500/10";
  const iconTint =
    accent === "sky"
      ? "bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-300"
      : "bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-300";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex cursor-pointer flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-all active:scale-[0.98]",
        active
          ? activeRing
          : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
      )}
    >
      <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", iconTint)}>
        {icon}
      </span>
      <span className="text-sm font-bold">{title}</span>
      <span className="text-xs text-slate-500 dark:text-slate-400">{desc}</span>
    </button>
  );
}

/** レビュー / 履歴で使う分析カードの中身 */
export function AnalysisGrid({
  durationSec,
  transcript,
}: {
  durationSec: number;
  transcript: string;
}) {
  const a = analyzeTranscript(transcript, durationSec);
  const assess = rateAssessment(a.rate);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <Metric label="話速" value={a.rate || "—"} unit="字/分" note={assess.label} noteColor={assess.color} />
        <Metric label="フィラー" value={a.fillerCount} unit="回" note="えー / あのー 等" />
        <Metric label="合計時間" value={formatDuration(durationSec)} note={`${a.charCount}字`} />
      </div>
      {a.fillerCount > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {a.fillerBreakdown
            .filter((f) => f.count > 0)
            .map((f) => (
              <span
                key={f.word}
                className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
              >
                「{f.word}」×{f.count}
              </span>
            ))}
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  unit,
  note,
  noteColor,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  note?: string;
  noteColor?: string;
}) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/50">
      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-0.5 text-lg font-bold tabular-nums leading-tight">
        {value}
        {unit && <span className="ml-0.5 text-[11px] font-medium text-slate-400">{unit}</span>}
      </p>
      {note && (
        <p className={cn("mt-0.5 text-[10px]", noteColor ?? "text-slate-400 dark:text-slate-500")}>
          {note}
        </p>
      )}
    </div>
  );
}
