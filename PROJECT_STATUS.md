# AVTOKLUB — layihə vəziyyəti

Son yoxlama: 14 oktyabr 2026. Bu sənəd yalnız yerli repozitoriyanın yoxlanmasına əsaslanır.

## Arxitektura

- Next.js 16 App Router, React 19, TypeScript, Tailwind 4; müştəri komponentləri REST tipli `/api/[...path]` marşrutundan istifadə edir.
- `better-sqlite3` bazası standart olaraq `.data/avtoklub.sqlite` faylındadır. Sxem `database/schema.sql`, demo məlumatları `database/seed.mjs`, HTTP smoke yoxlaması `database/smoke.mjs` fayllarındadır.
- Sessiyalar server tərəfdə saxlanılır, parollar bcrypt ilə heşlənir. Yüklənən şəkillər SQLite `media` cədvəlində saxlanılır.
- `main` iş budağı, `production` Hostinger yayım budağıdır. Canlı yayım üçün ayrıca istifadəçi göstərişi tələb olunur.

## Mövcud işləyən hissələr

- Qeydiyyat, giriş, çıxış, profil və şifrə dəyişmə API-ləri.
- Lent, paylaşım, şərh, bəyənmə, yadda saxlama, izləmə və bloklama üçün API və ekranlar.
- Qaraja avtomobil əlavə etmə, redaktə və silmə; klub üzvlüyü və moderator funksiyalarının bir hissəsi.
- Elanlar, tədbirlər, birəbir mesajlar, bildirişlər, axtarış, şəkil yükləmə və admin şikayət axını.
- Demo toxumu ayrıca əmrlə yaradılır; avtomatik canlı bazaya yazılmır.

## Natamam hissələr və məhdudiyyətlər

- Avtomobilin ayrıca səhifəsi, build jurnalı və avtomobili izləmə axını işləyir; foto olmayan avtomobil üçün açıq boş vəziyyət göstərilir.
- Xidmət və biznes profilləri, video infrastrukturu, repost, iç-içə şərhlər, `@` mention, private klub və avtomobil məxfiliyi hələ yoxdur.
- SQLite fayl bazası və BLOB şəkil saxlama Hostinger-in gələcək çox-instansiyalı və daimi saxlama tələbləri üçün ayrıca qiymətləndirilməlidir.
- Lint 0 xəta ilə keçir, lakin `<img>` optimallaşdırması üzrə 15 xəbərdarlıq verir.
- Daxili smoke testi yalnız məhdud API axınlarını yoxlayır; investor demosu və mobil cihaz qəbulu tam təsdiqlənməyib.

## İndi görüləcək işlər

1. Məxfilik və klub icazələrini server tərəfdə tam tətbiq etmək.
2. Xidmət və biznes profillərini işləyən məlumat modeli və ekranlarla əlavə etmək.
3. Video saxlama, yayım və moderasiya qərarlarını dəqiqləşdirmək.

## Yerli qurulum

Node.js 22 istifadə et. `npm.cmd install`, sonra `npm.cmd run dev`; tətbiq `http://localhost:3000` ünvanında açılır. Ayrı demo mühiti üçün `npm.cmd run db:seed`. Yoxlamalar: `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run build`; server açıq ikən `npm.cmd run test:smoke`. `.env*` və `.data/` Git-ə daxil edilməməlidir.

## Son yerli yoxlama

- 14 oktyabr: lint 0 xəta, 15 xəbərdarlıq; typecheck keçdi; build keçdi; dev server `Ready` vəziyyətinə çatdı.
- Avtomobil profili əlavə olunandan sonra lint 0 xəta, 17 şəkil optimallaşdırma xəbərdarlığı; typecheck, build və genişləndirilmiş API smoke keçdi. Production build yerli serverdə açıldı; brauzerdə giriş → qaraj → avtomobil profili, masaüstü və 390 px mobil görünüş, jurnal modalı yoxlandı.
- Brauzerdə jurnal qeydi yaradıldı və silindi; demo avtomobilində sınaq qeydi qalmadı. Tarix görünüşündə Azərbaycan ay adları tətbiq edildi.
- Son dəyişikliklərdən sonra lint (0 xəta, 17 xəbərdarlıq), typecheck, production build və production server üzərində API smoke yenidən keçdi. Yerli production server `http://localhost:3000` ünvanında işləyir.
- Canlı Hostinger build və sayt bu sessiyada yoxlanmayıb; yayım edilməyib.

## Giriş səhifəsinin yenilənməsi — 14 oktyabr 2026

- Ağ fonlu giriş səhifəsi yenidən quruldu: sosial platformanın məqsədi, birbaşa işlək giriş forması və əsas bölmələr aydın görünür.
- Yerli Noto Sans şrifti əlavə edildi; Azərbaycan hərfləri və başlıqlarda hərf aralığı masaüstü və mobil brauzerdə yoxlandı.
- Khronos glTF Sample Assets layihəsinin CC BY 4.0 lisenziyalı CarConcept modeli yerli fayl kimi əlavə edildi. Model sarı rəngə uyğunlaşdırılıb, nömrə nişanı gizlədilib və avtomobil Three.js səhnəsində dairəvi yolda hərəkət edir. Mənbə və dəyişikliklər `docs/3D_CREDITS.md` faylındadır.
- Animasiya azaldılmış hərəkət seçiminə hörmət edir, görünməyəndə dayandırılır. Model faylı təxminən 11.8 MB-dir; yüklənmə performansını sonrakı mərhələdə optimallaşdırmaq lazımdır.
- Bu dəyişikliklər yerli lint, typecheck, build və 390 px mobil / 1440 px masaüstü brauzer görünüşü ilə yoxlandı. Canlı Hostinger yayımı edilməyib.
