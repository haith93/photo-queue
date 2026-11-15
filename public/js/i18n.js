/**
 * English / Arabic. Markup carries data-i18n (text) and data-i18n-aria
 * (aria-label); JavaScript calls t(). CSS uses logical properties, so
 * setting dir="rtl" mirrors the layout.
 */

export const STRINGS = {
  'app.name':       ['Coverage requests', 'طلبات التغطية'],
  'lang.other':     ['العربية', 'English'],
  'signIn':         ['Staff sign-in', 'دخول الموظفين'],
  'signInBtn':      ['Sign in', 'دخول'],
  'signOut':        ['Sign out', 'تسجيل الخروج'],
  'password':       ['Password', 'كلمة المرور'],
  'cancel':         ['Cancel', 'إلغاء'],
  'f.activity':     ['Event', 'المناسبة'],
  'f.date':         ['Date', 'التاريخ'],
  'f.time':         ['Time', 'الوقت'],
  'f.building':     ['Building', 'المبنى'],
  'choose':         ['Choose…', 'اختر…'],
  'f.notes':        ['Notes', 'ملاحظات'],
  'today':          ['Today', 'اليوم'],
  'tomorrow':       ['Tomorrow', 'غداً'],
  'plus2':          ['In 2 days', 'بعد يومين'],
  'add':            ['Add request', 'إضافة الطلب'],
  'saveChanges':    ['Save changes', 'حفظ التعديلات'],
  'delete':         ['Delete', 'حذف'],
  'confirmDelete':  ['Delete this request?', 'هل تريد حذف هذا الطلب؟'],
  'view.day':       ['Day', 'يوم'],
  'view.week':      ['Week', 'أسبوع'],
  'prev':           ['Previous', 'السابق'],
  'next':           ['Next', 'التالي'],
  'empty':          ['Nothing scheduled.', 'لا يوجد شيء مجدول.'],
  'anyTime':        ['Any time', 'أي وقت'],
  'done':           ['Done', 'تم'],
  'markDone':       ['Mark done', 'تحديد كمُنجز'],
  'saved':          ['Saved.', 'تم الحفظ.'],
  'deleted':        ['Deleted.', 'تم الحذف.'],
  'role.coordinator':  ['Coordinator', 'المنسّق'],
  'role.photographer': ['Photographer', 'المصوّر'],
  'err.offline':    ['You are offline. Reconnect and try again.', 'أنت غير متصل. أعد الاتصال وحاول مجدداً.'],
  'err.network':    ['Could not reach the server. Try again.', 'تعذّر الوصول إلى الخادم. حاول مجدداً.'],
  'err.login':      ['Wrong password.', 'كلمة المرور غير صحيحة.'],
  'err.permission': ['You do not have permission to do that.', 'ليست لديك صلاحية للقيام بذلك.'],
  'err.generic':    ['Something went wrong. Try again.', 'حدث خطأ ما. حاول مجدداً.']
};

let lang = 'en';
try {
  lang = localStorage.getItem('pq.lang') || (navigator.language?.startsWith('ar') ? 'ar' : 'en');
} catch { /* private mode or no storage */ }

export const locale = () => (lang === 'ar' ? 'ar-LB' : 'en-GB');

export const t = key => STRINGS[key]?.[lang === 'ar' ? 1 : 0] ?? key;

export function apply(root = document) {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.title = t('app.name');
  root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-aria]').forEach(el => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
}

export function toggleLang() {
  lang = lang === 'ar' ? 'en' : 'ar';
  try { localStorage.setItem('pq.lang', lang); } catch { /* ignore */ }
  apply();
}
