import type { Lang } from "./config";

/**
 * Flat translation table. Keys are grouped by prefix for readability.
 * Written for a low-literacy audience: short sentences, concrete words.
 */

type Entry = { fr: string; ar: string };

export const T: Record<string, Entry> = {
  /* ---------------------------- brand ---------------------------- */
  "brand.name": { fr: "RABT", ar: "رابط" },
  "brand.tagline": { fr: "Trouvez un artisan de confiance", ar: "اعثر على حرفي موثوق" },
  "brand.taglineLong": {
    fr: "RABT relie les clients aux artisans : eau, gaz, électricité, plomberie, carrelage, peinture et construction.",
    ar: "رابط يصل بين الزبناء والحرفيين: الماء، الغاز، الكهرباء، السباكة، الزليج، الصباغة والبناء.",
  },

  /* ---------------------------- common ---------------------------- */
  "common.save": { fr: "Enregistrer", ar: "حفظ" },
  "common.cancel": { fr: "Annuler", ar: "إلغاء" },
  "common.delete": { fr: "Supprimer", ar: "حذف" },
  "common.edit": { fr: "Modifier", ar: "تعديل" },
  "common.back": { fr: "Retour", ar: "رجوع" },
  "common.next": { fr: "Suivant", ar: "التالي" },
  "common.done": { fr: "Terminé", ar: "تم" },
  "common.yes": { fr: "Oui", ar: "نعم" },
  "common.no": { fr: "Non", ar: "لا" },
  "common.all": { fr: "Tous", ar: "الكل" },
  "common.search": { fr: "Rechercher", ar: "بحث" },
  "common.loading": { fr: "Chargement…", ar: "جار التحميل…" },
  "common.optional": { fr: "facultatif", ar: "اختياري" },
  "common.add": { fr: "Ajouter", ar: "إضافة" },
  "common.close": { fr: "Fermer", ar: "إغلاق" },
  "common.send": { fr: "Envoyer", ar: "إرسال" },
  "common.error": { fr: "Une erreur est survenue", ar: "حدث خطأ" },
  "common.required": { fr: "obligatoire", ar: "إلزامي" },
  "common.photo": { fr: "Photo", ar: "صورة" },
  "common.takePhoto": { fr: "Prendre une photo", ar: "التقاط صورة" },
  "common.choosePhoto": { fr: "Choisir une photo", ar: "اختيار صورة" },
  "common.remove": { fr: "Retirer", ar: "إزالة" },
  "common.language": { fr: "Langue", ar: "اللغة" },
  "common.years": { fr: "ans", ar: "سنة" },
  "common.year": { fr: "an", ar: "سنة" },
  "common.hidden": { fr: "Masqué", ar: "مخفي" },
  "common.visible": { fr: "Visible", ar: "ظاهر" },
  "common.ok": { fr: "OK", ar: "حسنا" },
  "common.uploading": { fr: "Envoi…", ar: "جار الإرسال…" },
  "common.saved": { fr: "Enregistré", ar: "تم الحفظ" },
  "common.none": { fr: "Aucun", ar: "لا شيء" },

  /* ---------------------------- nav ---------------------------- */
  "nav.home": { fr: "Accueil", ar: "الرئيسية" },
  "nav.search": { fr: "Chercher", ar: "بحث" },
  "nav.teams": { fr: "Équipes", ar: "الفرق" },
  "nav.chat": { fr: "Messages", ar: "الرسائل" },
  "nav.profile": { fr: "Mon profil", ar: "ملفي" },
  "nav.logout": { fr: "Déconnexion", ar: "تسجيل الخروج" },
  "nav.login": { fr: "Connexion", ar: "تسجيل الدخول" },
  "nav.signup": { fr: "Créer un compte", ar: "إنشاء حساب" },

  /* ---------------------------- landing ---------------------------- */
  "land.whoAreYou": { fr: "Vous êtes ?", ar: "من أنت؟" },
  "land.iAmTrade": { fr: "Je suis un artisan", ar: "أنا حرفي" },
  "land.iAmTradeHint": { fr: "Je cherche des clients", ar: "أبحث عن زبناء" },
  "land.iAmCustomer": { fr: "Je cherche un artisan", ar: "أبحث عن حرفي" },
  "land.iAmCustomerHint": { fr: "J'ai un travail à faire", ar: "لدي عمل للإنجاز" },
  "land.howItWorks": { fr: "Comment ça marche ?", ar: "كيف تعمل المنصة؟" },
  "land.step1": { fr: "Créez votre profil avec vos informations et photos de travaux.", ar: "أنشئ ملفك بمعلوماتك وصور أعمالك." },
  "land.step2": { fr: "Les clients vous trouvent par métier et par région.", ar: "يجدك الزبناء حسب المهنة والجهة." },
  "land.step3": { fr: "Discutez, formez une équipe et réalisez le chantier.", ar: "تواصل، كوّن فريقاً وأنجز الورش." },
  "land.trades": { fr: "Métiers", ar: "المهن" },
  "land.enter": { fr: "Entrer", ar: "الدخول" },

  /* ---------------------------- auth ---------------------------- */
  "auth.createAccount": { fr: "Créer mon compte", ar: "إنشاء حسابي" },
  "auth.welcomeBack": { fr: "Bon retour", ar: "مرحباً بعودتك" },
  "auth.email": { fr: "Adresse e-mail", ar: "البريد الإلكتروني" },
  "auth.emailHint": { fr: "exemple : Ahmed@gmail.com", ar: "مثال: ahmed@gmail.com" },
  "auth.password": { fr: "Mot de passe", ar: "كلمة المرور" },
  "auth.passwordHint": { fr: "Au moins 6 caractères", ar: "6 أحرف على الأقل" },
  "auth.firstName": { fr: "Prénom", ar: "الاسم" },
  "auth.lastName": { fr: "Nom", ar: "النسب" },
  "auth.username": { fr: "Nom d'utilisateur", ar: "اسم المستخدم" },
  "auth.usernameHint": { fr: "Ce nom est toujours visible par les clients.", ar: "هذا الاسم يظهر دائماً للزبناء." },
  "auth.google": { fr: "Continuer avec Google", ar: "المتابعة بحساب غوغل" },
  "auth.googleDemo": { fr: "Essayer avec un compte Google de démonstration", ar: "تجربة بحساب غوغل تجريبي" },
  "auth.or": { fr: "ou", ar: "أو" },
  "auth.haveAccount": { fr: "J'ai déjà un compte", ar: "لدي حساب بالفعل" },
  "auth.noAccount": { fr: "Je n'ai pas de compte", ar: "ليس لدي حساب" },
  "auth.roleTrade": { fr: "Artisan", ar: "حرفي" },
  "auth.roleCustomer": { fr: "Client", ar: "زبون" },
  "auth.ageTitle": { fr: "Vous devez avoir 18 ans ou plus", ar: "يجب أن يكون عمرك 18 سنة أو أكثر" },
  "auth.ageCheck": { fr: "Je confirme avoir 18 ans ou plus", ar: "أؤكد أن عمري 18 سنة أو أكثر" },
  "auth.birthdate": { fr: "Date de naissance", ar: "تاريخ الازدياد" },
  "auth.ageRequired": { fr: "Vous devez confirmer que vous avez 18 ans ou plus.", ar: "يجب تأكيد أن عمرك 18 سنة أو أكثر." },
  "auth.badEmail": { fr: "Adresse e-mail invalide.", ar: "بريد إلكتروني غير صالح." },
  "auth.shortPassword": { fr: "Mot de passe trop court (6 caractères minimum).", ar: "كلمة المرور قصيرة جداً (6 أحرف على الأقل)." },
  "auth.emailTaken": { fr: "Cette adresse e-mail est déjà utilisée.", ar: "هذا البريد مستعمل بالفعل." },
  "auth.badCredentials": { fr: "E-mail ou mot de passe incorrect.", ar: "البريد أو كلمة المرور غير صحيحة." },
  "auth.missingFields": { fr: "Veuillez remplir tous les champs.", ar: "المرجو ملء جميع الخانات." },
  "auth.demoNotice": {
    fr: "Démonstration : la connexion Google réelle nécessite une clé API. Le bouton ci-dessous simule la connexion.",
    ar: "تجربة: الاتصال الحقيقي بغوغل يحتاج مفتاحاً. هذا الزر يحاكي الاتصال.",
  },

  /* ---------------------------- profile ---------------------------- */
  "profile.title": { fr: "Mon profil", ar: "ملفي" },
  "profile.personal": { fr: "Mes informations", ar: "معلوماتي" },
  "profile.avatar": { fr: "Photo de profil", ar: "صورة الملف الشخصي" },
  "profile.phone": { fr: "Numéro de téléphone", ar: "رقم الهاتف" },
  "profile.address": { fr: "Adresse", ar: "العنوان" },
  "profile.city": { fr: "Ville", ar: "المدينة" },
  "profile.bio": { fr: "Présentation", ar: "نبذة" },
  "profile.bioHint": { fr: "Décrivez votre travail en quelques mots", ar: "صف عملك بكلمات قليلة" },
  "profile.pro": { fr: "Mon métier", ar: "مهنتي" },
  "profile.trades": { fr: "Mes métiers", ar: "مهني" },
  "profile.experience": { fr: "Années d'expérience", ar: "سنوات الخبرة" },
  "profile.certificate": { fr: "Certificat / diplôme", ar: "الشهادة / الدبلوم" },
  "profile.certificateHint": { fr: "Photo de votre certificat, si vous en avez un", ar: "صورة شهادتك إن كانت لديك" },
  "profile.portfolio": { fr: "Photos de mes travaux", ar: "صور أعمالي" },
  "profile.portfolioHint": { fr: "Ajoutez des photos de vos travaux terminés", ar: "أضف صوراً لأعمالك المنجزة" },
  "profile.equipment": { fr: "Niveau d'équipement", ar: "مستوى المعدات" },
  "profile.equipmentHint": { fr: "Cette information est toujours visible.", ar: "هذه المعلومة تظهر دائماً." },
  "profile.privacy": { fr: "Confidentialité", ar: "الخصوصية" },
  "profile.privacyIntro": {
    fr: "Vous pouvez masquer certaines informations. La note, le nom d'utilisateur, l'équipement et les années d'expérience restent toujours visibles.",
    ar: "يمكنك إخفاء بعض المعلومات. التقييم واسم المستخدم والمعدات وسنوات الخبرة تبقى دائماً ظاهرة.",
  },
  "profile.hideRealName": { fr: "Masquer mon vrai nom", ar: "إخفاء اسمي الحقيقي" },
  "profile.hideRealNameHint": { fr: "Les clients verront seulement votre nom d'utilisateur.", ar: "سيرى الزبناء اسم المستخدم فقط." },
  "profile.hidePhone": { fr: "Masquer mon téléphone", ar: "إخفاء هاتفي" },
  "profile.privateProfile": { fr: "Profil privé", ar: "ملف خاص" },
  "profile.privateProfileHint": {
    fr: "Votre profil n'apparaîtra pas dans les recherches. Seules les personnes que vous contactez le verront.",
    ar: "لن يظهر ملفك في البحث. فقط من تتواصل معهم سيراه.",
  },
  "profile.regions": { fr: "Régions où je travaille", ar: "الجهات التي أعمل بها" },
  "profile.regionsHint": { fr: "Choisissez une ou plusieurs régions", ar: "اختر جهة أو عدة جهات" },
  "profile.alwaysPublic": { fr: "Toujours visible", ar: "دائماً ظاهر" },
  "profile.rating": { fr: "Note", ar: "التقييم" },
  "profile.viewPublic": { fr: "Voir mon profil public", ar: "عرض ملفي العام" },
  "profile.notTrade": { fr: "Cette section concerne les artisans.", ar: "هذا القسم خاص بالحرفيين." },

  /* ---------------------------- search ---------------------------- */
  "search.title": { fr: "Trouver un artisan", ar: "البحث عن حرفي" },
  "search.placeholder": { fr: "Nom, métier ou ville…", ar: "الاسم، المهنة أو المدينة…" },
  "search.trade": { fr: "Métier", ar: "المهنة" },
  "search.region": { fr: "Région", ar: "الجهة" },
  "search.equipment": { fr: "Équipement", ar: "المعدات" },
  "search.minRating": { fr: "Note minimum", ar: "أدنى تقييم" },
  "search.minExperience": { fr: "Années d'expérience", ar: "سنوات الخبرة" },
  "search.results": { fr: "{count} artisan(s) trouvé(s)", ar: "عدد الحرفيين: {count}" },
  "search.empty": { fr: "Aucun artisan trouvé. Essayez d'élargir votre recherche.", ar: "لم يتم العثور على حرفي. حاول توسيع البحث." },
  "search.filters": { fr: "Filtres", ar: "التصفية" },
  "search.clear": { fr: "Réinitialiser", ar: "إعادة الضبط" },
  "search.verified": { fr: "Vérifié", ar: "موثوق" },

  /* ---------------------------- public profile ---------------------------- */
  "pub.about": { fr: "À propos", ar: "حول" },
  "pub.work": { fr: "Travaux réalisés", ar: "الأعمال المنجزة" },
  "pub.reviews": { fr: "Avis", ar: "الآراء" },
  "pub.noReviews": { fr: "Aucun avis pour le moment.", ar: "لا توجد آراء حاليا." },
  "pub.rate": { fr: "Donner une note", ar: "أعطِ تقييماً" },
  "pub.yourRating": { fr: "Votre note", ar: "تقييمك" },
  "pub.comment": { fr: "Votre avis", ar: "رأيك" },
  "pub.noWork": { fr: "Aucune photo de travaux.", ar: "لا توجد صور للأعمال." },
  "pub.private": { fr: "Ce profil est privé.", ar: "هذا الملف خاص." },
  "pub.certified": { fr: "Certificat fourni", ar: "شهادة مقدمة" },
  "pub.call": { fr: "Appeler", ar: "اتصال" },
  "pub.message": { fr: "Envoyer un message", ar: "إرسال رسالة" },
  "pub.addToTeam": { fr: "Ajouter à une équipe", ar: "إضافة إلى فريق" },
  "pub.yearsExp": { fr: "{years} ans d'expérience", ar: "{years} سنوات من الخبرة" },
  "pub.reviewCount": { fr: "{count} avis", ar: "{count} رأي" },
  "pub.loginToRate": { fr: "Connectez-vous pour donner votre avis.", ar: "سجل الدخول لإبداء رأيك." },
  "pub.ownReviewForbidden": { fr: "Vous ne pouvez pas noter votre propre profil.", ar: "لا يمكنك تقييم ملفك الخاص." },

  /* ---------------------------- teams ---------------------------- */
  "teams.title": { fr: "Équipes", ar: "الفرق" },
  "teams.intro": {
    fr: "Un chantier demande plusieurs personnes ? Créez une équipe et invitez d'autres artisans.",
    ar: "ورش يحتاج عدة أشخاص؟ أنشئ فريقاً وادعُ حرفيين آخرين.",
  },
  "teams.create": { fr: "Créer une équipe", ar: "إنشاء فريق" },
  "teams.name": { fr: "Nom de l'équipe", ar: "اسم الفريق" },
  "teams.trade": { fr: "Métier principal", ar: "المهنة الرئيسية" },
  "teams.description": { fr: "Description du projet", ar: "وصف المشروع" },
  "teams.members": { fr: "Membres", ar: "الأعضاء" },
  "teams.memberCount": { fr: "{count} membre(s)", ar: "عدد الأعضاء: {count}" },
  "teams.addMember": { fr: "Ajouter un membre", ar: "إضافة عضو" },
  "teams.searchMember": { fr: "Rechercher un artisan à ajouter…", ar: "ابحث عن حرفي لإضافته…" },
  "teams.yours": { fr: "Mes équipes", ar: "فرقي" },
  "teams.others": { fr: "Équipes ouvertes", ar: "فرق مفتوحة" },
  "teams.empty": { fr: "Aucune équipe pour le moment.", ar: "لا توجد فرق حالياً." },
  "teams.openChat": { fr: "Discussion du groupe", ar: "محادثة المجموعة" },
  "teams.owner": { fr: "Responsable", ar: "المسؤول" },
  "teams.leave": { fr: "Quitter l'équipe", ar: "مغادرة الفريق" },
  "teams.join": { fr: "Rejoindre", ar: "انضمام" },
  "teams.created": { fr: "Équipe créée", ar: "تم إنشاء الفريق" },

  /* ---------------------------- chat ---------------------------- */
  "chat.title": { fr: "Messages", ar: "الرسائل" },
  "chat.empty": { fr: "Aucune conversation. Contactez un artisan pour commencer.", ar: "لا توجد محادثات. تواصل مع حرفي للبدء." },
  "chat.new": { fr: "Nouvelle discussion", ar: "محادثة جديدة" },
  "chat.placeholder": { fr: "Écrire un message…", ar: "اكتب رسالة…" },
  "chat.attach": { fr: "Photo", ar: "صورة" },
  "chat.noMessages": { fr: "Dites bonjour !", ar: "قل مرحباً!" },
  "chat.you": { fr: "Vous", ar: "أنت" },
  "chat.team": { fr: "Équipe", ar: "فريق" },
  "chat.sendImage": { fr: "Envoyer une photo", ar: "إرسال صورة" },
  "chat.imageOnly": { fr: "📷 Photo", ar: "📷 صورة" },

  /* ---------------------------- home ---------------------------- */
  "home.hi": { fr: "Bonjour", ar: "مرحباً" },
  "home.tradeActions": { fr: "Mes outils", ar: "أدواتي" },
  "home.customerActions": { fr: "Que cherchez-vous ?", ar: "ماذا تبحث؟" },
  "home.findWorker": { fr: "Trouver un artisan", ar: "البحث عن حرفي" },
  "home.myProfile": { fr: "Compléter mon profil", ar: "إكمال ملفي" },
  "home.myTeams": { fr: "Mes équipes", ar: "فرقي" },
  "home.myMessages": { fr: "Mes messages", ar: "رسائلي" },
  "home.topRated": { fr: "Artisans les mieux notés", ar: "أفضل الحرفيين تقييماً" },
  "home.nearby": { fr: "Dans votre région", ar: "في جهتك" },
  "home.browse": { fr: "Voir tous les artisans", ar: "عرض كل الحرفيين" },

  /* ---------------------------- errors / misc ---------------------------- */
  "err.unauthorized": { fr: "Vous devez être connecté.", ar: "يجب تسجيل الدخول." },
  "err.notFound": { fr: "Introuvable", ar: "غير موجود" },
  "err.forbidden": { fr: "Accès refusé", ar: "الوصول مرفوض" },
  "err.tooBig": { fr: "Fichier trop volumineux (max 6 Mo).", ar: "الملف كبير جداً (الحد الأقصى 6 ميغابايت)." },
  "err.badType": { fr: "Format de fichier non accepté.", ar: "صيغة الملف غير مقبولة." },
  "err.notTrade": { fr: "Réservé aux comptes artisans.", ar: "خاص بحسابات الحرفيين." },
};

export function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  const entry = T[key];
  let out = entry ? entry[lang] : key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      out = out.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return out;
}

export const isRtl = (lang: Lang) => lang === "ar";
