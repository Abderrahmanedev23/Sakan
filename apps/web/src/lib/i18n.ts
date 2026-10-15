import type { AccountStatus, VerificationStatus } from '@sakan/shared';

export const LOCALES = ['ar', 'fr'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'ar';
export const LOCALE_COOKIE = 'sakan.locale';

export function isLocale(value: unknown): value is Locale {
  return LOCALES.includes(value as Locale);
}

export function dirOf(locale: Locale): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

/** Moroccan formatting for both languages; Arabic keeps Latin digits like most Moroccan sites. */
export function intlLocale(locale: Locale): string {
  return locale === 'ar' ? 'ar-MA' : 'fr-MA';
}

export function formatDateTime(value: string | Date, locale: Locale): string {
  return new Date(value).toLocaleString(intlLocale(locale));
}

const ar = {
  'meta.description': 'منصة سحوبات جماعية شفافة',
  'brand.tagline': 'سحوبات جماعية شفافة',
  'lang.switch': 'Français',
  'lang.label': 'اللغة',

  'nav.home': 'الرئيسية',
  'nav.sessions': 'السحوبات',
  'nav.steps': 'المراحل',
  'nav.faq': 'أسئلة متداولة',
  'nav.admin': 'الإدارة',
  'nav.account': 'حسابي',
  'nav.signIn': 'تسجيل الدخول',
  'nav.signUp': 'إنشاء حساب',
  'nav.signOut': 'تسجيل الخروج',

  'common.loading': 'جارٍ التحميل…',
  'common.error': 'حدث خطأ ما',
  'common.email': 'البريد الإلكتروني',
  'common.password': 'كلمة المرور',

  'hero.title': 'سحوبات جماعية شفافة لمشاركين موثَّقي الهوية',
  'hero.body':
    'سكن منصة تجمع المشاركين في جلسات سحب واضحة القواعد. يتحقق كل مشارك من هويته ببطاقته الوطنية، ويُختار الفائز عشوائيًا مع سجل قابل للتدقيق.',
  'hero.cta': 'أنشئ حسابك',
  'hero.secondary': 'تصفح السحوبات',

  'steps.title': 'المراحل التي يجب اتباعها للمشاركة',
  'steps.1': 'إنشاء حساب على المنصة',
  'steps.2': 'التحقق من الهوية بالبطاقة الوطنية',
  'steps.3': 'الانضمام إلى جلسة سحب مفتوحة',
  'steps.4': 'متابعة السحب والإعلان عن الفائز',

  'sessions.title': 'جلسات السحب',
  'sessions.apiDown': 'تعذّر الاتصال بالخادم. شغّله بالأمر `pnpm dev:api`.',
  'sessions.empty': 'لا توجد جلسات مفتوحة حاليًا.',
  'sessions.perEntry': (price: string) => `${price} للمشاركة`,
  'sessions.entries': (done: number, target: number) => `${done} / ${target} مشاركة`,
  'sessions.draw': (date: string) => `السحب: ${date}`,

  'faq.title': 'أسئلة متداولة',
  'faq.q1': 'ما هي منصة سكن؟',
  'faq.a1': 'سكن منصة لتنظيم جلسات سحب جماعية، لكل جلسة عدد مشاركين مستهدف وثمن مشاركة وموعد سحب معلن مسبقًا.',
  'faq.q2': 'لماذا يجب التحقق من هويتي؟',
  'faq.a2': 'يضمن التحقق بالبطاقة الوطنية أن كل مشارك شخص حقيقي وأن لكل شخص حسابًا واحدًا، مما يحمي نزاهة السحب.',
  'faq.q3': 'من يرى صور بطاقتي الوطنية؟',
  'faq.a3': 'الصور لا يطّلع عليها إلا مسؤولو المنصة المكلفون بالمراجعة، ولا تظهر لأي مشارك آخر.',
  'faq.q4': 'كيف يُختار الفائز؟',
  'faq.a4': 'يُجرى السحب عشوائيًا في الموعد المحدد، وتُحفظ كل خطوة في سجل يمكن تدقيقه لاحقًا.',
  'faq.q5': 'ماذا أفعل إذا رُفض طلب التحقق؟',
  'faq.a5': 'ستجد سبب الرفض في صفحة حسابك. صحّح المعلومات أو أعد تصوير البطاقة ثم أرسل الطلب من جديد.',

  'footer.about': 'منصة سحوبات جماعية شفافة لمشاركين موثَّقي الهوية.',
  'footer.platform': 'المنصة',
  'footer.help': 'المساعدة',
  'footer.rights': (year: number) => `© ${year} سكن. جميع الحقوق محفوظة.`,

  'login.title': 'تسجيل الدخول',
  'login.submit': 'دخول',
  'login.busy': 'جارٍ الدخول…',
  'login.new': 'مستخدم جديد؟',
  'login.create': 'أنشئ حسابًا',

  'signup.title': 'إنشاء حسابك',
  'signup.intro': 'بعد التسجيل ستتحقق من هويتك باستعمال بطاقتك الوطنية.',
  'signup.passwordHint': (n: number) => `${n} أحرف على الأقل`,
  'signup.phone': 'الهاتف (اختياري)',
  'signup.submit': 'إنشاء الحساب',
  'signup.busy': 'جارٍ إنشاء الحساب…',
  'signup.have': 'لديك حساب؟',

  'profile.title': 'حسابي',
  'profile.signInPrompt': 'لعرض حسابك.',
  'profile.identity': 'الهوية:',
  'profile.account': 'الحساب:',
  'profile.reason': 'السبب:',
  'profile.status.UNSUBMITTED': 'أضف معلومات بطاقتك الوطنية وصورتي الوجهين حتى نتحقق من هويتك.',
  'profile.status.PENDING': 'شكرًا. يراجع أحد المسؤولين بطاقتك، وستتمكن من المشاركة في الجلسات بعد قبولها.',
  'profile.status.APPROVED': 'تم التحقق من هويتك. يمكنك المشاركة في جلسات السحب.',
  'profile.status.REJECTED': 'تعذّر التحقق من بطاقتك. صحّح المشكلة أدناه وأعد الإرسال.',
  'profile.formTitle': 'التحقق من هويتك',
  'profile.formIntro': 'أدخل المعلومات كما هي مكتوبة على بطاقتك. الصور لا يطّلع عليها إلا مسؤولو سكن.',
  'profile.fileHint': 'JPEG أو PNG أو WebP، بحد أقصى 5 ميغابايت',
  'profile.submit': 'إرسال للمراجعة',
  'profile.busy': 'جارٍ الرفع…',

  'field.name': 'الاسم',
  'field.firstName': 'الاسم الشخصي',
  'field.lastName': 'الاسم العائلي',
  'field.phone': 'الهاتف',
  'field.dateOfBirth': 'تاريخ الازدياد',
  'field.cinNumber': 'رقم البطاقة الوطنية',
  'field.cin': 'البطاقة الوطنية',
  'field.cinExpiresAt': 'تاريخ انتهاء صلاحية البطاقة',
  'field.cinExpires': 'تنتهي صلاحيتها',
  'field.front': 'الوجه الأمامي للبطاقة',
  'field.back': 'الوجه الخلفي للبطاقة',
  'field.submitted': 'تاريخ الإرسال',

  'status.UNSUBMITTED': 'لم يُرسل',
  'status.PENDING': 'قيد المراجعة',
  'status.APPROVED': 'موثَّق',
  'status.REJECTED': 'مرفوض',
  'status.ACTIVE': 'نشط',
  'status.SUSPENDED': 'موقوف',

  'admin.title': 'مراجعة الهويات',
  'admin.signInPrompt': 'بحساب مسؤول.',
  'admin.only': 'هذه الصفحة مخصصة للمسؤولين فقط.',
  'admin.tab.PENDING': 'في انتظار المراجعة',
  'admin.tab.APPROVED': 'موثَّقون',
  'admin.tab.REJECTED': 'مرفوضون',
  'admin.tab.UNSUBMITTED': 'لم يُرسلوا',
  'admin.tab.all': 'كل المستخدمين',
  'admin.search': 'ابحث بالبريد أو الاسم أو رقم البطاقة',
  'admin.loadError': 'تعذّر تحميل المستخدمين',
  'admin.nothingPending': 'لا شيء في انتظار المراجعة.',
  'admin.noUsers': 'لا يوجد مستخدمون هنا.',
  'admin.col.user': 'المستخدم',
  'admin.col.status': 'الحالة',
  'admin.col.submitted': 'تاريخ الإرسال',
  'admin.col.signedUp': 'تاريخ التسجيل',
  'admin.loadMore': 'تحميل المزيد',
  'admin.back': 'العودة إلى المراجعات',
  'admin.userLoadError': 'تعذّر تحميل هذا المستخدم',
  'admin.details': 'معلومات البطاقة',
  'admin.decision': 'القرار',
  'admin.decisionHint': 'تأكد أن الصور تطابق المعلومات وأن البطاقة أصلية وغير منتهية الصلاحية.',
  'admin.approve': 'قبول',
  'admin.rejectPlaceholder': 'سبب الرفض، يظهر للمستخدم (مثلًا: صورة الوجه الخلفي غير واضحة)',
  'admin.reject': 'رفض',
  'admin.account': 'الحساب',
  'admin.suspendPlaceholder': 'سبب الإيقاف (يُحفظ في سجل التدقيق)',
  'admin.suspend': 'إيقاف الحساب',
  'admin.reactivate': 'إعادة تفعيل الحساب',
  'admin.reviews': 'سجل القرارات',
  'admin.noReviews': 'لا توجد قرارات بعد.',
  'admin.audit': 'سجل التدقيق',
  'admin.byOn': (who: string, when: string) => `بواسطة ${who} في ${when}`,
  'admin.system': 'النظام',
  'admin.front': 'الوجه الأمامي',
  'admin.back.side': 'الوجه الخلفي',
  'admin.imageError': 'تعذّر تحميل الصورة.',
};

export type Dictionary = typeof ar;

const fr: Dictionary = {
  'meta.description': 'Plateforme de tirages au sort communautaires transparents',
  'brand.tagline': 'Tirages communautaires transparents',
  'lang.switch': 'العربية',
  'lang.label': 'Langue',

  'nav.home': 'Accueil',
  'nav.sessions': 'Tirages',
  'nav.steps': 'Étapes',
  'nav.faq': 'Questions fréquentes',
  'nav.admin': 'Administration',
  'nav.account': 'Mon compte',
  'nav.signIn': 'Se connecter',
  'nav.signUp': 'Créer un compte',
  'nav.signOut': 'Se déconnecter',

  'common.loading': 'Chargement…',
  'common.error': "Une erreur s'est produite",
  'common.email': 'E-mail',
  'common.password': 'Mot de passe',

  'hero.title': "Des tirages communautaires transparents, entre participants à l'identité vérifiée",
  'hero.body':
    'Sakan réunit les participants autour de sessions de tirage aux règles claires. Chacun vérifie son identité avec sa CIN, et le gagnant est choisi au hasard avec un journal vérifiable.',
  'hero.cta': 'Créer mon compte',
  'hero.secondary': 'Voir les tirages',

  'steps.title': 'Les étapes pour participer',
  'steps.1': 'Créer un compte sur la plateforme',
  'steps.2': "Vérifier son identité avec sa CIN",
  'steps.3': 'Rejoindre une session de tirage ouverte',
  'steps.4': 'Suivre le tirage et l’annonce du gagnant',

  'sessions.title': 'Sessions de tirage',
  'sessions.apiDown': "L'API est injoignable. Démarrez-la avec `pnpm dev:api`.",
  'sessions.empty': 'Aucune session ouverte pour le moment.',
  'sessions.perEntry': (price: string) => `${price} par participation`,
  'sessions.entries': (done: number, target: number) => `${done} / ${target} participations`,
  'sessions.draw': (date: string) => `Tirage : ${date}`,

  'faq.title': 'Questions fréquentes',
  'faq.q1': "Qu'est-ce que Sakan ?",
  'faq.a1':
    'Sakan organise des sessions de tirage communautaires. Chaque session a un nombre cible de participants, un prix de participation et une date de tirage annoncée à l’avance.',
  'faq.q2': 'Pourquoi dois-je vérifier mon identité ?',
  'faq.a2':
    'La vérification par CIN garantit que chaque participant est une personne réelle avec un seul compte, ce qui protège l’équité du tirage.',
  'faq.q3': 'Qui voit les photos de ma CIN ?',
  'faq.a3': 'Seuls les administrateurs chargés de la vérification y ont accès. Elles ne sont jamais montrées aux autres participants.',
  'faq.q4': 'Comment le gagnant est-il choisi ?',
  'faq.a4': 'Le tirage est aléatoire et a lieu à la date prévue. Chaque étape est enregistrée dans un journal vérifiable.',
  'faq.q5': 'Que faire si ma vérification est refusée ?',
  'faq.a5': 'Le motif du refus s’affiche dans votre compte. Corrigez les informations ou reprenez les photos, puis renvoyez la demande.',

  'footer.about': "Plateforme de tirages communautaires transparents entre participants à l'identité vérifiée.",
  'footer.platform': 'Plateforme',
  'footer.help': 'Aide',
  'footer.rights': (year: number) => `© ${year} Sakan. Tous droits réservés.`,

  'login.title': 'Se connecter',
  'login.submit': 'Se connecter',
  'login.busy': 'Connexion…',
  'login.new': 'Nouveau ici ?',
  'login.create': 'Créer un compte',

  'signup.title': 'Créer votre compte',
  'signup.intro': 'Après l’inscription, vous vérifierez votre identité avec votre CIN.',
  'signup.passwordHint': (n: number) => `Au moins ${n} caractères`,
  'signup.phone': 'Téléphone (facultatif)',
  'signup.submit': "S'inscrire",
  'signup.busy': 'Création du compte…',
  'signup.have': 'Vous avez déjà un compte ?',

  'profile.title': 'Mon compte',
  'profile.signInPrompt': 'pour voir votre compte.',
  'profile.identity': 'Identité :',
  'profile.account': 'Compte :',
  'profile.reason': 'Motif :',
  'profile.status.UNSUBMITTED': 'Ajoutez les informations de votre CIN et une photo de chaque face pour que nous vérifiions votre identité.',
  'profile.status.PENDING': 'Merci. Un administrateur examine votre CIN. Vous pourrez rejoindre des sessions une fois validée.',
  'profile.status.APPROVED': 'Votre identité est vérifiée. Vous pouvez rejoindre des sessions de tirage.',
  'profile.status.REJECTED': 'Votre CIN n’a pas pu être vérifiée. Corrigez le problème ci-dessous et renvoyez-la.',
  'profile.formTitle': 'Vérifier votre identité',
  'profile.formIntro': 'Saisissez les informations exactement comme sur votre CIN. Les photos ne sont visibles que par les administrateurs de Sakan.',
  'profile.fileHint': "JPEG, PNG ou WebP, jusqu'à 5 Mo",
  'profile.submit': 'Envoyer pour vérification',
  'profile.busy': 'Envoi…',

  'field.name': 'Nom',
  'field.firstName': 'Prénom',
  'field.lastName': 'Nom',
  'field.phone': 'Téléphone',
  'field.dateOfBirth': 'Date de naissance',
  'field.cinNumber': 'Numéro de CIN',
  'field.cin': 'CIN',
  'field.cinExpiresAt': "Date d'expiration de la CIN",
  'field.cinExpires': 'Expiration CIN',
  'field.front': 'Recto de la CIN',
  'field.back': 'Verso de la CIN',
  'field.submitted': 'Envoyé le',

  'status.UNSUBMITTED': 'Non envoyé',
  'status.PENDING': 'En cours',
  'status.APPROVED': 'Vérifié',
  'status.REJECTED': 'Refusé',
  'status.ACTIVE': 'Actif',
  'status.SUSPENDED': 'Suspendu',

  'admin.title': "Vérifications d'identité",
  'admin.signInPrompt': 'avec un compte administrateur.',
  'admin.only': 'Cette page est réservée aux administrateurs.',
  'admin.tab.PENDING': 'À examiner',
  'admin.tab.APPROVED': 'Vérifiés',
  'admin.tab.REJECTED': 'Refusés',
  'admin.tab.UNSUBMITTED': 'Non envoyés',
  'admin.tab.all': 'Tous les utilisateurs',
  'admin.search': 'Rechercher par e-mail, nom ou CIN',
  'admin.loadError': 'Impossible de charger les utilisateurs',
  'admin.nothingPending': 'Rien à examiner.',
  'admin.noUsers': 'Aucun utilisateur ici.',
  'admin.col.user': 'Utilisateur',
  'admin.col.status': 'Statut',
  'admin.col.submitted': 'Envoyé le',
  'admin.col.signedUp': 'Inscrit le',
  'admin.loadMore': 'Charger plus',
  'admin.back': 'Retour aux vérifications',
  'admin.userLoadError': 'Impossible de charger cet utilisateur',
  'admin.details': 'Informations de la CIN',
  'admin.decision': 'Décision',
  'admin.decisionHint': 'Vérifiez que les photos correspondent aux informations et que la carte est authentique et valide.',
  'admin.approve': 'Valider',
  'admin.rejectPlaceholder': "Motif du refus, affiché à l'utilisateur (ex. photo du verso floue)",
  'admin.reject': 'Refuser',
  'admin.account': 'Compte',
  'admin.suspendPlaceholder': "Motif de la suspension (conservé dans le journal d'audit)",
  'admin.suspend': 'Suspendre le compte',
  'admin.reactivate': 'Réactiver le compte',
  'admin.reviews': 'Historique des décisions',
  'admin.noReviews': 'Aucune décision pour le moment.',
  'admin.audit': "Journal d'audit",
  'admin.byOn': (who: string, when: string) => `par ${who} le ${when}`,
  'admin.system': 'système',
  'admin.front': 'Recto',
  'admin.back.side': 'Verso',
  'admin.imageError': "Impossible de charger l'image.",
};

export const dictionaries: Record<Locale, Dictionary> = { ar, fr };

export function statusKey(status: VerificationStatus | AccountStatus) {
  return `status.${status}` as const;
}
