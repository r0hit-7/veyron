import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload, Link, AlertTriangle, CheckCircle, XCircle, Loader2, Eye, Info, Sparkles } from 'lucide-react';
import { useLang } from '../context/LanguageContext';
import { detectDeepfake } from '../api';
import { recordUserActivity } from '../lib/userStats';
import { GlassmorphicPanel, CyberGrid } from '../components/premium/PremiumUI';

type Verdict = 'fake' | 'real' | 'suspicious' | 'unverified' | null;
type InputMode = 'upload' | 'link';

interface AnalysisResult {
  verdict: Verdict;
  confidence: number;
  reason: string;
  manipulation: string[];
  action: string;
  context?: string;
}

const verdictConfig = {
  fake: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', label: 'FAKE / AI Generated', labelHi: 'नकली / AI निर्मित' },
  suspicious: { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30', label: 'SUSPICIOUS', labelHi: 'संदिग्ध' },
  real: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30', label: 'LIKELY REAL', labelHi: 'संभवतः असली' },
  unverified: { icon: Info, color: 'text-slate-300', bg: 'bg-slate-500/10 border-slate-500/30', label: 'UNVERIFIED', labelHi: 'असत्यापित' },
};

export default function DeepfakeDetector() {
  const MAX_FILE_MB = 25;
  const [mode, setMode] = useState<InputMode>('upload');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const { t } = useLang();

  async function analyze() {
    if (mode === 'upload' && !file) return;
    if (mode === 'link' && !url.trim()) return;
    if (mode === 'upload' && file && file.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`File size exceeds ${MAX_FILE_MB}MB. Please upload a smaller file.`);
      return;
    }
    setLoading(true);
    setResult(null);
    setError('');
    try {
      const data = await detectDeepfake(mode === 'upload' ? file : url.trim());
      const verdict = data.verdict === 'fake' ? 'fake' : data.verdict === 'suspicious' ? 'suspicious' : data.verdict === 'unverified' ? 'unverified' : 'real';
      recordUserActivity(
        'deepfake',
        verdict === 'fake' ? 'dangerous' : verdict === 'suspicious' ? 'suspicious' : 'safe',
        data.details || 'Deepfake analysis completed.'
      );
      const rawConfidence = Number(data.confidenceScore ?? data.confidence ?? 0.5);
      const confidencePercent = rawConfidence <= 1 ? rawConfidence * 100 : rawConfidence;
      setResult({
        verdict,
        confidence: Math.round(confidencePercent),
        reason: data.details || 'Model analysis complete.',
        manipulation: data.findings || data.recommendations || [],
        action: t(data.englishSummary || 'Verify before sharing.', data.hindiSummary || 'साझा करने से पहले सत्यापित करें।'),
        context: `${data.details} Source: ${data.mediaUrl || (file?.name || 'unknown')}`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deepfake analysis failed.');
    } finally {
      setLoading(false);
    }
  }

  const verdictConf = result?.verdict ? verdictConfig[result.verdict] : null;

  return (
    <div className="min-h-screen bg-veyron-navy pt-16 relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-32 right-1/3 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
        <CyberGrid />
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="mb-12">
          <div className="flex items-center gap-4 mb-6">
            <motion.div whileHover={{ scale: 1.1, rotate: 10 }} className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 p-4 flex items-center justify-center shadow-cyber-lg">
              <Eye className="w-8 h-8 text-white" />
            </motion.div>
            <div>
              <h1 className="font-grotesk text-4xl font-bold text-white mb-2">{t('Deepfake Detector', 'डीपफेक डिटेक्टर')}</h1>
              <p className="text-lg text-slate-300">{t('AI-Powered Media Authentication', 'AI-संचालित मीडिया प्रमाणीकरण')}</p>
            </div>
          </div>

          <GlassmorphicPanel hover={false} className="!p-4 !bg-blue-500/10 !border-blue-500/30">
            <div className="flex gap-4">
              <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-slate-300 space-y-1">
                <p className="font-semibold text-blue-300">{t('About This Detector', 'इस डिटेक्टर के बारे में')}</p>
                <p>{t('Analyzes images and videos for AI-generated content. Supports JPG, PNG, WEBP, MP4, MOV up to 25MB.', 'AI-निर्मित कंटेंट के लिए विश्लेषण। JPG, PNG, WEBP, MP4, MOV 25MB तक समर्थित।')}</p>
                <p className="text-yellow-300 text-xs mt-2">{t('⚠️ Detection is experimental—use as a signal, not final proof. Always verify from trusted sources.', '⚠️ यह प्रायोगिक है—संकेत की तरह लें, अंतिम प्रमाण नहीं।')}</p>
              </div>
            </div>
          </GlassmorphicPanel>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-8">
          <div className="inline-flex gap-2 p-1 bg-white/5 border border-cyan-500/20 rounded-xl">
            {[
              { mode: 'upload' as const, icon: Upload, en: 'Upload File', hi: 'फ़ाइल अपलोड' },
              { mode: 'link' as const, icon: Link, en: 'Paste URL', hi: 'URL डालें' },
            ].map((item) => (
              <motion.button
                key={item.mode}
                onClick={() => { setMode(item.mode); setResult(null); }}
                whileHover={{ scale: 1.05 }}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  mode === item.mode ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-glow' : 'text-slate-400 hover:text-cyan-300'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {t(item.en, item.hi)}
              </motion.button>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-8">
          <GlassmorphicPanel hover={true} delay={0.2} className="!p-8">
            {mode === 'upload' ? (
              <div>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime" className="hidden" onChange={(e) => { setFile(e.target.files?.[0] || null); setResult(null); setError(''); }} />
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  onClick={() => fileRef.current?.click()}
                  className="w-full border-2 border-dashed border-cyan-500/40 hover:border-cyan-400 rounded-2xl p-12 text-center transition-all group relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5 group-hover:from-cyan-500/10 transition-all" />
                  <div className="relative space-y-4">
                    <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 3, repeat: Infinity }} className="flex justify-center">
                      <Upload className="w-12 h-12 text-cyan-400 group-hover:text-cyan-300 transition-colors" />
                    </motion.div>
                    {file ? (
                      <div>
                        <p className="text-white font-semibold text-lg">{file.name}</p>
                        <p className="text-slate-400 text-sm mt-2">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-cyan-300 font-semibold text-lg">{t('Drag image or video here', 'छवि या वीडियो यहां लाएं')}</p>
                        <p className="text-slate-400 text-sm mt-2">{t('or click to browse', 'या चुनने के लिए क्लिक करें')}</p>
                        <p className="text-slate-500 text-xs mt-3">JPG • PNG • WEBP • MP4 • MOV (max 25MB)</p>
                      </div>
                    )}
                  </div>
                </motion.button>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="text-slate-300 text-sm font-semibold block">{t('Paste image or video URL', 'छवि या वीडियो URL डालें')}</label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => { setUrl(e.target.value); setResult(null); }}
                  placeholder="https://example.com/image.jpg"
                  className="w-full bg-veyron-navy border border-cyan-500/20 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 focus:shadow-glow-sm transition-all"
                />
              </div>
            )}
          </GlassmorphicPanel>
        </motion.div>

        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          onClick={analyze}
          disabled={loading || (mode === 'upload' ? !file : !url.trim())}
          whileHover={{ scale: 1.02 }}
          className="w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-bold text-base rounded-xl transition-all shadow-cyber-lg hover:shadow-cyber-xl"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {t('Analyzing...', 'विश्लेषण हो रहा है...')}
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              {t('Analyze Media', 'मीडिया विश्लेषण करें')}
            </>
          )}
        </motion.button>

        {error && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            {error}
          </motion.p>
        )}

        {result && verdictConf && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="mt-12">
            <GlassmorphicPanel hover={false}>
              <div className="flex items-start justify-between mb-8">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-red-500/10">
                    <verdictConf.icon className={`w-8 h-8 ${verdictConf.color}`} />
                  </div>
                  <div>
                    <h2 className={`font-grotesk text-3xl font-bold ${verdictConf.color} mb-2`}>{t(verdictConf.label, verdictConf.labelHi)}</h2>
                    <div className="flex items-center gap-3">
                      <div className="text-sm text-slate-400">{t('Confidence Score', 'विश्वास स्कोर')}:</div>
                      <div className="w-40 h-2.5 bg-slate-800/50 rounded-full overflow-hidden border border-cyan-500/20">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${result.confidence}%` }} transition={{ duration: 1.5, ease: 'easeOut' }} className="h-full rounded-full bg-gradient-to-r from-red-500 to-red-400" />
                      </div>
                      <span className={`font-bold text-lg ${verdictConf.color} w-16 text-right`}>{result.confidence}%</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6 border-t border-slate-700/50 pt-6">
                <div>
                  <p className="text-cyan-300 text-sm font-semibold mb-2">{t('Analysis Details', 'विश्लेषण विवरण')}</p>
                  <p className="text-slate-300">{result.reason}</p>
                </div>

                {result.manipulation.length > 0 && (
                  <div>
                    <p className="text-cyan-300 text-sm font-semibold mb-3">{t('Detected Indicators', 'पहचाने गए संकेत')}</p>
                    <div className="flex flex-wrap gap-2">
                      {result.manipulation.map((m, i) => (
                        <span key={i} className="px-3 py-1.5 bg-gradient-to-r from-red-500/20 to-red-600/20 border border-red-500/30 text-red-300 text-xs rounded-lg font-medium">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4">
                  <p className="text-cyan-300 text-sm font-semibold mb-2">{t('Recommended Action', 'अनुशंसित कार्रवाई')}</p>
                  <p className="text-slate-300">{result.action}</p>
                </div>
              </div>
            </GlassmorphicPanel>
          </motion.div>
        )}
      </div>
    </div>
  );
}
