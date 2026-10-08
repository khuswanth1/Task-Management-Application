// Interface languages (fully translated in translations.js) and typing languages.
// "itc" is the Google Input Tools code used to turn Latin typing ("namaste") into the
// native script ("नमस्ते"). Latin-script languages need no conversion (itc: null).

export const UI_LANGUAGES = [
  { code: 'en', name: 'English', english: 'English', dir: 'ltr' },
  { code: 'hi', name: 'हिन्दी', english: 'Hindi', dir: 'ltr' },
  { code: 'te', name: 'తెలుగు', english: 'Telugu', dir: 'ltr' },
  { code: 'ta', name: 'தமிழ்', english: 'Tamil', dir: 'ltr' },
  { code: 'kn', name: 'ಕನ್ನಡ', english: 'Kannada', dir: 'ltr' },
  { code: 'ml', name: 'മലയാളം', english: 'Malayalam', dir: 'ltr' },
  { code: 'mr', name: 'मराठी', english: 'Marathi', dir: 'ltr' },
  { code: 'bn', name: 'বাংলা', english: 'Bengali', dir: 'ltr' },
  { code: 'ar', name: 'العربية', english: 'Arabic', dir: 'rtl' },
  { code: 'es', name: 'Español', english: 'Spanish', dir: 'ltr' },
  { code: 'fr', name: 'Français', english: 'French', dir: 'ltr' },
  { code: 'zh', name: '中文', english: 'Chinese', dir: 'ltr' },
];

export const TYPING_LANGUAGES = [
  { code: 'en', name: 'English', english: 'English', itc: null, sample: 'Buy groceries' },
  { code: 'hi', name: 'हिन्दी', english: 'Hindi', itc: 'hi-t-i0-und', sample: 'namaste → नमस्ते' },
  { code: 'te', name: 'తెలుగు', english: 'Telugu', itc: 'te-t-i0-und', sample: 'namaskaram → నమస్కారం' },
  { code: 'ta', name: 'தமிழ்', english: 'Tamil', itc: 'ta-t-i0-und', sample: 'vanakkam → வணக்கம்' },
  { code: 'kn', name: 'ಕನ್ನಡ', english: 'Kannada', itc: 'kn-t-i0-und', sample: 'namaskara → ನಮಸ್ಕಾರ' },
  { code: 'ml', name: 'മലയാളം', english: 'Malayalam', itc: 'ml-t-i0-und', sample: 'namaskaram → നമസ്കാരം' },
  { code: 'mr', name: 'मराठी', english: 'Marathi', itc: 'mr-t-i0-und', sample: 'namaskar → नमस्कार' },
  { code: 'bn', name: 'বাংলা', english: 'Bengali', itc: 'bn-t-i0-und', sample: 'nomoskar → নমস্কার' },
  { code: 'gu', name: 'ગુજરાતી', english: 'Gujarati', itc: 'gu-t-i0-und', sample: 'kem cho → કેમ છો' },
  { code: 'pa', name: 'ਪੰਜਾਬੀ', english: 'Punjabi', itc: 'pa-t-i0-und', sample: 'sat sri akal → ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ' },
  { code: 'or', name: 'ଓଡ଼ିଆ', english: 'Odia', itc: 'or-t-i0-und', sample: 'namaskar → ନମସ୍କାର' },
  { code: 'ur', name: 'اردو', english: 'Urdu', itc: 'ur-t-i0-und', dir: 'rtl', sample: 'shukriya → شکریہ' },
  { code: 'ne', name: 'नेपाली', english: 'Nepali', itc: 'ne-t-i0-und', sample: 'namaste → नमस्ते' },
  { code: 'sa', name: 'संस्कृतम्', english: 'Sanskrit', itc: 'sa-t-i0-und', sample: 'namah → नमः' },
  { code: 'si', name: 'සිංහල', english: 'Sinhala', itc: 'si-t-i0-und', sample: 'ayubowan → ආයුබෝවන්' },
  { code: 'ar', name: 'العربية', english: 'Arabic', itc: 'ar-t-i0-und', dir: 'rtl', sample: 'marhaba → مرحبا' },
  { code: 'fa', name: 'فارسی', english: 'Persian', itc: 'fa-t-i0-und', dir: 'rtl', sample: 'salam → سلام' },
  { code: 'ru', name: 'Русский', english: 'Russian', itc: 'ru-t-i0-und', sample: 'privet → привет' },
  { code: 'el', name: 'Ελληνικά', english: 'Greek', itc: 'el-t-i0-und', sample: 'kalimera → καλημέρα' },
  { code: 'th', name: 'ไทย', english: 'Thai', itc: 'th-t-i0-und', sample: 'Type phonetically in Latin letters' },
  { code: 'zh', name: '中文 (拼音)', english: 'Chinese (Pinyin)', itc: 'zh-t-i0-pinyin', sample: 'nihao → 你好' },
  { code: 'ja', name: '日本語', english: 'Japanese', itc: 'ja-t-i0-und', sample: 'konnichiwa → こんにちわ' },
  { code: 'es', name: 'Español', english: 'Spanish', itc: null, sample: 'Comprar víveres' },
  { code: 'fr', name: 'Français', english: 'French', itc: null, sample: 'Faire les courses' },
  { code: 'de', name: 'Deutsch', english: 'German', itc: null, sample: 'Einkaufen gehen' },
  { code: 'pt', name: 'Português', english: 'Portuguese', itc: null, sample: 'Fazer compras' },
];

export const findUiLanguage = (code) => UI_LANGUAGES.find(l => l.code === code) || UI_LANGUAGES[0];
export const findTypingLanguage = (code) => TYPING_LANGUAGES.find(l => l.code === code) || TYPING_LANGUAGES[0];
