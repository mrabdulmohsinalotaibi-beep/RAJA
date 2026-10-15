# رَجْع | RAJA

**كل صوتٍ له رَجْع**

رابط الموقع: https://raja.athat.app

## الإصدار الحالي v19 — مكتبة مستقلة على كل جهاز

بناءً على طلب المالك، **أُلغي التزامن السحابي التلقائي** في رَجْع. يحتفظ كل هاتف أو جهاز لوحي أو كمبيوتر بملفات الصوت والفيديو وقوائمه وتقدم استماعه داخل متصفحه وحده، حتى عند تسجيل الدخول بالحساب نفسه على أكثر من جهاز. لا تُرفع الملفات أو القوائم إلى R2 أو D1 من واجهة v19، ولا تُجلب ملفات الأجهزة الأخرى تلقائيًا.

- تبقى الحسابات والدخول المعتاد كما هي، وتبقى مكتبة كل حساب محلية ومستقلة على الجهاز.
- تظل ملفات IndexedDB الفعلية المحفوظة على الجهاز محفوظة؛ لا تحذفها هذه الترقية ولا تمسح نسخ R2 القديمة.
- بيانات مقاطع سحابية قديمة ليس لها ملف حقيقي على هذا الجهاز لا تظهر في «ملفاتي»، وتُوسم مراجعها في القوائم بأنها غير موجودة هنا مع خيار إزالتها يدويًا.
- حذف مقطع من «ملفاتي» يحذفه من الجهاز الحالي فقط؛ ليس من بقية الأجهزة.
- يمكن إدخال ملفات «الضيف» وقوائمه إلى الحساب **على الجهاز نفسه فقط** دون إرسالها إلى السحابة.
- الاحتفاظ بنسخة خارج التطبيق أمر ضروري: مسح بيانات الموقع أو إزالة بيانات المتصفح قد يمحو الملفات المحلية.
- أُوقفت أيضًا مزامنة مفضلة YouTube والقوائم والأجزاء الزمنية في organizer.js، وأُزيلت أزرار المزامنة وتعارض الأجهزة.
- ملف cloud-sync.js أصبح غير نشط للتوافق مع صفحات v17 المخزّنة، كما أزيل استدعاؤه من HTML وService Worker.

> ملاحظة تاريخية: قسم «Account cloud synchronization (v15)» أدناه يصف النسخة السابقة فقط، وليس آلية الإصدار الحالي.

## وظائف الواجهة المنشورة

- مشغل فيديو وصوت وروابط YouTube القابلة للتضمين.
- تنزيل روابط الملفات المباشرة عندما يسمح الخادم بذلك.
- مكتبة خاصة بكل جهاز باستخدام IndexedDB؛ تظل الملفات على الجهاز ولا ترفع إلى خادم رَجْع.
- شاشة كشف صيغ MP4/MP3 وتصدير الملفات إلى تنزيلات الجهاز عندما يكون خادم المعالجة متاحًا.
- تطبيق ويب PWA يمكن تثبيته على الشاشة الرئيسية.

## تنزيل YouTube داخل رَجْع

**حالة النشر:** خدمة المعالجة تعمل حاليًا على `https://raja-media.onrender.com` بخطة Render المجانية، وتُمرّر طلبات التحميل عبر نطاق الموقع `raja.athat.app` من خلال متغير `MEDIA_BACKEND_URL` في Cloudflare Pages. هذا هو الإعداد المنشور، ولا يحتاج المستخدم إلى زيارة موقع تحميل خارجي.

تُستخدم `yt-dlp[default]` و`FFmpeg` و`Node.js 22` لمعالجة الملفات؛ كل ملف مؤقت يُحذف بعد استجابة التنزيل، بينما «ملفاتي» محفوظة محليًا على جهاز المستخدم فقط. يتم عرض صيغ MP4 وMP3 والجودات عندما يعيد الخادم خيارات متاحة، مع زر «تنزيل إلى جهازي»، أو «حفظ في مكتبتي» لتنزيل نسخ صغيرة داخل مساحة متصفح المستخدم.

**تحقق عملي:** فُحص تنزيل رابط عام (`dQw4w9WgXcQ`) وكانت استجابة `/api/download` لكل من MP4 وMP3 نوع ملف صالحًا وتضمنت بايتات وسائط فعلية. الرابط التجريبي (`-vVymc0wnLg`) لم يكن متاحًا من خادم Render بسبب مطالبة YouTube بالتحقق. لذلك لا نضمن تنزيل كل رابط.

### تشغيل الاستضافة مجانًا من جديد عند الحاجة

1. استخدم `render.yaml` أو Dockerfile في مجلد `backend/` لإنشاء خدمة Render المجانية.
2. تحقق من `/health`، ثم عيّن `MEDIA_BACKEND_URL` في Cloudflare Pages إلى عنوان HTTPS لخدمة Render.
3. أعد نشر `main` عند تغيير إعدادات Cloudflare.

خادم Render المجاني قد يدخل وضع الخمول وتتأخر محاولته الأولى، وقد يمنع YouTube بعض الطلبات أو يطلب تسجيل الدخول. حد المعالجة 300 ميجابايت ومدة ساعة؛ مكتبة الجهاز المحددة داخل المتصفح 120 ميجابايت لفيديو YouTube الواحد. للنسخة المستقلة الدائمة استخدم تنزيل الجهاز، وليس مخزن المتصفح. راعِ حقوق النشر وشروط المواقع.

راجع [backend/README.md](backend/README.md) للتفاصيل.

## دخول كل مستخدم بحسابه Google

جهز الموقع نظام Google OAuth الفردي وجلسات محفوظة في HttpOnly Secure SameSite=Lax، وعزل سجلات طلبات التنزيل والمكتبة الداخلية حسب Google account ID على نفس الجهاز. **هذه الميزة لا تصبح نشطة تلقائيًا إلا بعد إضافة متغيرات Google Cloud**. وهي مصادقة دخول للموقع، وليست تسجيل دخول إلى YouTube، ولا تستخدم جلسة Google الخاصة بالعميل في استخراج مقاطع YouTube المحمية.

**إعداد Google Cloud بواسطة مالك الموقع (مرة واحدة):**

1. افتح [Google Cloud Console](https://console.cloud.google.com/apis/credentials) وأعدّ شاشة موافقة Google Auth Platform حسب متطلبات Google.
2. أنشئ OAuth Client ID من نوع **Web application**.
3. أضف Authorized JavaScript origin: `https://raja.athat.app`.
4. أضف Authorized redirect URI بالضبط: `https://raja.athat.app/api/auth/callback`.
5. في Cloudflare Pages > مشروع `raja` > Settings > Variables and Secrets > Production، أضف:
   - `GOOGLE_CLIENT_ID`: Client ID.
   - `GOOGLE_CLIENT_SECRET`: Client Secret (Secret / encrypted).
   - `RAJA_SESSION_SECRET`: قيمة قوية عشوائية لا تقل عن 32 حرفًا، مثل قيمة يولّدها `openssl rand -hex 32` (Secret / encrypted).
6. انشر فرع `main` مجددًا في Cloudflare Pages، ثم جرّب تسجيل الدخول والخروج بحسابين مختلفين.

**لا ترسل Client Secret أو Session Secret في محادثة أو ترفعها إلى GitHub**. ضعها داخل لوحة Cloudflare فقط. إذا كانت شاشة Google OAuth في وضع Testing، فقد تحتاج إلى إضافة حسابات المختبرين مؤقتًا أو نشر التطبيق وفق سياسة Google.

الملفات المحلية في IndexedDB مفصولة بأسماء مساحات لكل حساب، لكنها **غير مشفّرة**. على الأجهزة المشتركة احمِ الجهاز ولا تعتبر هذه المكتبة خزنة أسرار. حذف بيانات المتصفح يحذف الملفات المحفوظة محليًا. لا يضمن OAuth تنزيل كل مقاطع YouTube؛ تبقى قيود المصدر والتنزيل منفصلة عن تسجيل دخول Google.


## مكتبة الدروس اليومية

في «قوائمي» يمكن إنشاء قوائم دروس بأسماء، واستيراد عدة ملفات من الجهاز بترتيب طبيعي لأسمائها، أو اختيار ملفات المكتبة أو إضافة روابط HTTPS مباشرة وروابط YouTube. يمكن تعديل الأسماء والترتيب وحذف العناصر، وتعيين مدة يومية (1–720 دقيقة) وبداية اليوم (05:00 افتراضيًا، بتوقيت السعودية).

- تشغيل الحصة أو إعادتها يبدأ من نقطة بداية اليوم المحفوظة، ويقف عند المدة المحددة أو نهاية القائمة؛ لا يجمع الإعادات كحصص جديدة.
- يبدأ اليوم التالي من أبعد موضع وصلت إليه في اليوم السابق، حتى لو أعدت الحصة أو أوقفتها مبكرًا. بعد نهاية القائمة، يبدأ اليوم التالي من أولها. الأيام التي لم تستمع فيها لا تتجاوز دروسًا.
- تعديل المدة أو وقت بداية اليوم أو ترتيب الدروس يعيد خطة القائمة من البداية بعد التأكيد. تغيير الاسم يحافظ على التقدم.
- وقت بداية اليوم حد لحساب الحصة، وليس منبه تشغيل تلقائي. بدء الصوت يحتاج تفاعل المستخدم.
- بيانات الدروس معزولة حسب الحساب ومحفوظة محليًا على الجهاز؛ لا تضاف إلى مزامنة قوائم YouTube القديمة. روابط الملفات المباشرة تحتاج اتصالًا، والملفات المستوردة محفوظة في IndexedDB نفسها.
- الصوت الأصلي يستخدم HTMLAudioElement وMedia Session لأزرار شاشة القفل وطلب جلسة playback حيث يتوفر الدعم، ولا يتوقف برمجيًا عند تبديل التبويب أو قفل الشاشة. المتصفح ونظام التشغيل قد يعلقان الصفحة أو الانتقال التلقائي؛ لا يضمن تطبيق الويب التشغيل بعد إغلاقه بالقوة، ولم يُختبر قفل شاشة iPhone فعلي هنا.
- YouTube يستخدم المشغل الرسمي المرئي وIFrame API للتتابع، ويتوقف عند إخفاء الصفحة؛ لا يقدم استماعًا مخفيًا لروابط YouTube.

التحقق: `node tests/lesson-core.cjs` و`node tests/lessons-e2e.cjs` (يتطلب Playwright/Chromium وPython 3). اختبارات المتصفح تستخدم ملفات WAV محلية فعلية، ولا تتحقق من قفل شاشة جهاز حقيقي.


## واجهة المسجل الفاتحة

الرئيسية مسجل ثابت بألوان عاجية وبيج ولمسات بنية ذهبية، مع أزرار التشغيل والتقديم والرجوع وإعادة الحصة، وشكل بكرات يتحرك أثناء التشغيل. زر الإعدادات يفتح شاشة إدارة مستقلة للقوائم والتحميل والحساب، وملفات الجهاز وسجل التنزيلات. التمرير داخل شاشة الإدارة فقط. الحقوق أسفل الشاشتين باسم `Abdulmo7sin`، وتفتح الخصوصية وشروط الاستخدام داخل التطبيق.

تستخدم الواجهة `recorder.css` و`recorder.js` مع التحكم في `window.rajaLessons`. القوائم القديمة لا تُحذف، وتظهر في قسم YouTube القابل للفتح داخل شاشة القوائم. تحديث Service Worker إلى `raja-shell-v11` يحدّث ملفات الواجهة المخزنة.

## تفعيل الدخول بالبريد أو الجوال

واجهات إرسال الرمز والتحقق منه جاهزة برمجيًا، لكنها لا ترسل رسائل قبل إعداد مزود التحقق. الإعداد الحالي المنشور الذي فُحص أثناء العمل لا يحتوي مفاتيح مزود بريد/SMS؛ يبقى استخدام مكتبة الجهاز متاحًا وتظهر رسالة واضحة بأن الدخول غير مفعّل. لم يتم إنشاء خدمة مدفوعة أو تفعيل إرسال فعلي.

لتفعيل Twilio Verify بعد تجهيز الخدمة ووسيلة الإرسال:

1. طبّق ملف `migrations/0002-contact-auth.sql` على قاعدة `RAJA_DB` الحالية. يضيف جدول عدادات فقط ولا يغير بيانات القوائم.
2. ضع `TWILIO_ACCOUNT_SID` و`TWILIO_AUTH_TOKEN` و`TWILIO_VERIFY_SERVICE_SID` كأسرار في Cloudflare Pages؛ لا تضع قيمها في المستودع أو المحادثة.
3. استخدم `RAJA_SESSION_SECRET` الحالي (32 حرفًا على الأقل). تحتاج قناة البريد ربط خدمة بريد داخل Twilio Verify، وقناة SMS تحتاج خدمة تسمح بالإرسال للسعودية.
4. عيّن `RAJA_EMAIL_LOGIN=true` للبريد، و`RAJA_SMS_LOGIN=true` للجوال، بعد التحقق من إعداد القناة والتكلفة وحدود الإرسال. لا تُفعّل قناة غير جاهزة.
5. بعد النشر اختبر بجهة اتصال يختارها المالك؛ لم ترسل اختبارات هذا المشروع أية رسالة فعلية.

الجوال يقبل أرقام السعودية بصيغ `05XXXXXXXX` أو `+9665XXXXXXXX`. تحفظ جلسة الحساب في HttpOnly Secure SameSite=Lax، ويجب طلب الرمز من المتصفح نفسه قبل التحقق. توجد حدود ذرية لمحاولات الإرسال والتحقق حسب جهة الاتصال وIP باستخدام D1، وتُخزن مفاتيح العدادات كقيم SHA-256. التحقق الفعلي يتم لدى Twilio، ولا يُقبل أي رمز محلي مصطنع. حساب البريد وحساب الجوال منفصلان ولا يُدمجان تلقائيًا مع Google؛ لكل هوية مكتبة جهاز مستقلة.

توثيق المزود: https://www.twilio.com/docs/verify/api/verification وhttps://www.twilio.com/docs/verify/api/verification-check

اختبارات محلية إضافية: `node tests/recorder-shell.cjs` و`node tests/contact-auth.cjs`. الأخيرة تستخدم SQLite محليًا وطلبات مزود محاكاة؛ لا تثبت تسليم رسائل حقيقية. اختبارات المتصفح في `tests/lessons-e2e.cjs` تتحقق أيضًا من ملاءمة ارتفاع الرئيسية في 320×568 و390×844 و768×1024، وتحتاج متصفح Chromium مثبتًا. تعذر تنزيل Chromium في بيئة هذا العمل، لذلك لا تُعد اختبارات المتصفح أو قفل شاشة iPhone منفذة هنا.


تحديث تحقق النشر: نجحت اختبارات Chromium على GitHub Actions، بما فيها استيراد WAV والتتابع وحدود الحصة والإعادة والمتابعة لليوم التالي وملاءمة مقاسات الجوال. أضيفت معاملات إصدار لملفات الواجهة مع مطابقة التخزين المسبق وإعادة التحقق من HTTP cache، لمنع اختلاط شاشة جديدة بوحدات JavaScript قديمة أثناء تحديث التطبيق. اختبار `node tests/cache-version.cjs` يغطي اتفاق الإصدارات. يبقى قفل شاشة iPhone الفعلي وتسليم البريد/SMS غير مختبرين.


## الشعار المعتمد

اعتمد الشعار المرفق من المالك كما هو في `assets/raja-logo.jpeg` دون تغيير الملف أو ألوانه. يظهر في الرأس ووسط المسجل، ويستخدم داخل favicon SVG مضمّن وأيقونة تثبيت التطبيق. إصدار ملفات الواجهة والتخزين المسبق v12 لتحديث الأجهزة التي حفظت الهوية السابقة.


## الدخول بالبريد وكلمة المرور (المعتمد حاليًا)

نفس طريقة الذات: إنشاء حساب بالاسم والبريد وكلمة مرور، ثم تسجيل الدخول بالبريد وكلمة المرور. حسابات رَجْع مستقلة عن حسابات الذات ولا تقرأ قواعد بياناتها. الدخول بكلمة المرور لا يحتاج مزود بريد أو SMS، ولا يعني التحقق من ملكية عنوان البريد. تبقى طريقة الرموز السابقة اختيارية وغير مفعلة دون مزود.

- طبّق `0002-contact-auth.sql` ثم `0003-password-accounts.sql` على قاعدة رَجْع الحالية، وفعّل `RAJA_PASSWORD_LOGIN=true`. يلزم سر الجلسة الموجود مسبقًا، ولا تُنشأ خدمة خارجية أو موارد مدفوعة.
- كلمات المرور (12–128 حرفًا) تُشتق بـ PBKDF2-SHA256 مع ملح عشوائي، ثم HMAC بمفتاح سري من بيئة الخادم. حد الاشتقاق 100000 مراعاة لحد Workers. لا تُحفظ كلمة المرور بنصها ولا في المتصفح.
- جلسات الحساب موقعة، محفوظة في HttpOnly Secure SameSite=Lax ومربوطة بجدول جلسات في D1. الخروج يلغي الجلسة من الخادم، والاستعادة تغيّر إصدار بيانات الدخول وتبطل جميع الجلسات القديمة فورًا.
- يظهر رمز استعادة عشوائي مرة واحدة بعد إنشاء الحساب أو استعادته؛ يستطيع المستخدم حفظه على جهازه. لا يوجد إرسال رمز استعادة بالبريد دون مزود. الرمز المخزن في الخادم بصمة HMAC فقط، ويُستبدل بعد الاستعادة.
- تُحد محاولات التسجيل والدخول والاستعادة بعدادات ذرية حسب البريد وIP، مع رسائل دخول عامة لا تميز خطأ البريد من كلمة المرور.
- تظل مكتبة الضيف القديمة متاحة دون تسجيل دخول ولا تُدمج تلقائيًا مع حساب جديد، لحماية الأجهزة المشتركة. لكل حساب مساحة ملفات وقوائم مستقلة؛ بعد الخروج يمكن الوصول إلى مكتبة الجهاز الأصلية مجددًا.

المسارات: `/api/auth/register` و`/api/auth/password-login` و`/api/auth/reset-password` و`/api/auth/logout`. اختبار `node tests/password-auth.cjs` يتحقق من دورة الحساب كاملة باستخدام SQLite محليًا. اختبار `node tests/password-ui-e2e.cjs` يتحقق من واجهة التسجيل والدخول والاستعادة عبر استجابات محاكاة. إصدار ملفات التطبيق v13.

## Account cloud synchronization (v15)

Signed-in users now synchronize media files, daily lesson lists, item order and listening progress. Existing account-local files upload automatically while the page is open. A private R2 binding `RAJA_MEDIA` stores originals; D1 `RAJA_DB` stores owner-scoped metadata, resumable upload parts and versioned lesson snapshots. Apply `migrations/0004-cloud-sync.sql` before deployment. The bucket has no public website or public object URLs. Every media read (including byte ranges) checks the session and owner.

Uploads use bounded 8 MiB multipart chunks, resume acknowledged parts after interrupted connections, and become visible to other devices only after completion. The initial account quota is 1 GiB, each file is limited to 400 MiB, and the application allocation is capped at 5 GiB. Limits reserve bytes atomically across concurrent uploads. Quota errors preserve the local file and display a pending/error state; no paid plan upgrade is enabled by this change.

New devices see cloud files immediately and stream them with authenticated range requests. “حفظ دون إنترنت” downloads a persistent local copy. Guest libraries remain private to the device until the signed-in user explicitly chooses “إضافة مكتبة الضيف إلى حسابي”. File deletions are account-wide and retain metadata tombstones so stale devices cannot re-upload deleted files. Three-way list merging preserves offline additions and the furthest daily listening progress; simultaneous structural edits keep a named copy rather than silently overwriting either list. Local originals remain usable when offline; sync retries on reconnect, foregrounding, edits, and a 45-second foreground poll. Browsers may pause uploads when the app is closed or suspended.

Validation includes real SQLite integration with a multipart R2 test binding, resumable chunks, account isolation, CSRF, size limits, byte ranges, atomic quota reservation, three-way merge regressions and two independent browser contexts for online/offline file and playlist synchronization.

### Native lock-screen resume (v16)

Native audio/video now use the browser's default Media Session play/pause/stop commands (`null` handlers) rather than routing these commands through page JavaScript, which can be suspended while the screen is locked. Position and source remain intact on pause; the native media element determines the OS playback state. Seek controls still enforce the daily segment. Explicit in-app stop releases the audio session. Applying equivalent cloud metadata or renaming a list no longer destroys the active media source.

Controller and actual-MP3 browser regressions cover repeated native pause/play, position/source preservation, paused-session continuity during cloud canonicalization, daily cutoff and sequential playback. These checks do not emulate an actual iPhone lock screen; physical iOS pause/resume after extended suspension still needs device verification.

### iOS silent audio-session recovery (v17)

Some WebKit failures leave playback clocks advancing with no audible output. WebKit bug 323104 comment 5 documents a stale cached playback category and a device-tested workaround: switch `navigator.audioSession.type` to `ambient`, then back to `playback` in a new task. RAJA now performs that cycle on native `play` and when returning to an already-playing page. It preserves the media source and exact position, does not restart a paused element, and cancels pending category work on stop/source replacement. Browsers without Audio Session support retain native playback. This is a mitigation for the reported failure class, not proof that every silent iOS state is recoverable.

Regressions verify the category sequence on repeated real-MP3 pause/resume and that paused foregrounding and explicit stop do not restart playback or reacquire audio. Audible output on a physical iPhone remains a device verification requirement. Reference: https://bugs.webkit.org/show_bug.cgi?id=323104#c5

## Local listening checkpoints (v20)

The recorder saves the last selected list/file, current item, exact paused position, segment offset, elapsed daily allowance and media duration on pause, periodic progress, page hiding and leaving. Reopening presents a ready paused state; pressing Play or starting the same list continues from that point. Standalone library playback is retained even without a playlist. Deliberate rewinds update the checkpoint independently from the furthest daily cursor, so resuming preserves the latest stop while the next-day plan still uses the established daily cursor.

“إعادة حصة اليوم” explicitly starts the day's window again. Structural/setting resets discard the affected checkpoint; day rollover uses the existing daily continuation rules. No cloud synchronization is introduced. Progress is device/browser/account-scoped like the existing library. Force-closing the browser can lose the interval since the most recent periodic save; normal pause saves immediately. Browser regressions cover reload without autoplay, rewinds, second-item continuation, remaining daily allowance, explicit replay and standalone files.


### Classic recorder — v21
Ivory enclosure, restrained brass details, custom seek track, readable transport icons, and consistent library/account styling. The fixed player adapts to compact phones, tablets and desktop; very short landscape screens may scroll. Playback and local resume behavior are retained. Layout checks cover seven viewport sizes, long titles, control touch targets and management navigation.


### Editable daily sessions — v22
Each of up to 50 playlists has an independent daily session and saved position. Choose a playlist on the recorder or in management. The daily editor selects a track and a time (mm:ss or hh:mm:ss, including Arabic digits), validates native media duration, and resets today’s allotted duration from the chosen point. It saves paused, does not reorder tracks, and replay begins at the edited start. Changing lists saves each previous position.


### Open listening — v23 (supersedes hard daily sessions)
Playback is open by default, including existing lists. Daily goals are opt-in (`goalMinutes`, 0 means open), informational, and never stop or restrict playback. Track time and daily listening time are separate. Next/previous and seeking are unrestricted; replay restarts the current track. Last positions survive daily rollover and list edits; completed tracks are recorded individually. Old checkpoint positions, including daily cutoff checkpoints, migrate without moving the saved point. All media and listening data remain local to each device.

Playlist cards show the last track and stop time, with a continue action and collapsible tracks/options. New playlists can import multiple naturally sorted files in one operation. Pointer handles reorder on touch or mouse, with arrow buttons as an accessible alternative. Changing order or appending files preserves the checkpoint. Browser checks cover open playback beyond a goal, native session recovery, cross-day resume, migration, per-list positions, arbitrary navigation, ordering and layout.


### Connected listening parts — v24
Lists default to 30-minute virtual parts. All original finite media durations are measured locally and stored; an ordered timeline maps every part position to its source file and offset. The last part may be shorter. No merged media file is created or uploaded. Part end pauses playback; next/previous/replay operate on parts and are always available. Cross-file seeks retain paused/playing state. Checkpoints store the source position plus the selected part so an exact boundary remains associated with the completed part, including across day changes. Resizing or reordering recalculates boundaries while retaining the underlying source position.

Choose 0 for original-file playback. Finite local audio/video and direct media URLs can be prepared; YouTube links cannot be prepared without duration metadata and show an actionable error. Optional daily goals remain independent. Part cards are paged in groups of 20 for large lists. Tests cover mapping ten long files, exact boundaries, a short final part, cross-file playback/seeking, part navigation, persistence and resizing.


### Repetition and content duplicate detection — v25
The recorder offers 2 total plays, 3 total plays, or continuous part repetition. Pausing/resuming preserves the current cycle; reload restores cycle and position. Explicit replay or next/previous begins a new cycle. Same-source repeats retain the existing native media element and Blob URL. Native OS play/pause routing and WebKit category rearming are retained. Browser tests simulate visibility changes and native media pause/play; physical iPhone lock-screen output still requires a real-device check.

Uploads and saved downloads compare all file bytes using fixed 1 MiB SHA-256 chunks and a versioned root fingerprint (bounded memory). File names and MIME types do not determine matches. Older stored files are fingerprinted lazily when size matches; originals remain intact. A dialog offers skip/add again, optional batch decision, and safe skip on cancel. Imports serialize so simultaneous batches do not race the duplicate check. Fingerprints remain on the device with the existing library.

WebKit native audio checks use an in-memory media-library fixture to isolate audio behavior from the Linux runner storage backend, and log an independent IndexedDB Blob probe. Persistent storage and duplicate choices are exercised by the Chromium suite. Neither engine test represents a physical iOS lock-screen session.


### YouTube shortcut links — v26
The link field accepts yout-ube.com, youtube44.com, ilumu.com and adblockyoutube.com watch/embed/shorts/live links, validates their video identifier, and opens the official youtube-nocookie.com embed directly. The shortcut domains are never visited. The dedicated “تشغيل الرابط داخل رَجْع” action and format preview cancel pending extraction and SS download redirects so playback stays in the app. This uses the same privacy-enhanced player RAJA already used, and is not an ad blocker: YouTube can still serve ads. Mocked browser tests verify routing and cancellation, not real YouTube ad absence or full playback.

References: https://www.yout-ube.com/ (describes its privacy-embed redirect); https://support.google.com/youtube/answer/171780?hl=en (privacy-enhanced embeds may serve non-personalized ads).


### Site administration — v27
The separate `/admin/` dashboard authenticates administrators by Saudi mobile number and password. The owner is provisioned out of band; there is no public admin registration. Activation uses a random, single-use token (24-hour expiry), stored only as a SHA-256 digest. Activation links carry the token in the fragment, cleared immediately on page load, and require choosing a password. A one-time recovery code is displayed for download. Password/recovery changes invalidate older admin sessions. No SMS provider is configured or charged.

The owner manages supervisor accounts and can disable, reactivate or reissue their activation. Supervisors cannot manage other administrators; the owner cannot be disabled or re-invited through the UI. Eight-hour HttpOnly/Secure/SameSite sessions are validated against the database on every protected request. Administrative POSTs enforce the production Origin, JSON/body size constraints and per-IP/identity rate limits. Audit entries exclude credentials and activation tokens.

The dashboard lists actual email/password accounts, searches/paginates them and exports the currently displayed results. Suspension prevents password login/account sessions and revokes existing sessions. Revoking sessions alone forces re-login. Site settings control the public title/announcement, registration and link downloads; server endpoints enforce registration/download controls. Local media playback is preserved. Connection checks test D1 and the configured media backend, without promising YouTube extraction. Media remains device-only; administrators cannot view or erase device files.

Apply additive migration `0005-site-admin.sql` before deploying. Provision the initial owner directly in D1 with a private activation-token digest and expiry; never commit the phone or activation token. Admin pages and API responses must not be cached. Node/SQLite API tests cover authorization, CSRF, replay, recovery rotation, session revocation, suspension, settings conflicts and limits. Browser tests exercise real handlers through a local HTTP harness (production Origin/client IP substituted), responsive layouts, safe announcements, invitations and logout.
