# Avtoklub iş qaydası

- İstifadəçinin təsdiqlədiyi məzmun və dizayn üzrə bu layihəni inkişaf etdir.
- Dəyişiklikləri əvvəl yerli mühitdə yoxla: `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run build` və səhifənin vizual vəziyyəti.
- `main` iş budağıdır. Canlı Hostinger saytı `production` budağını izləməlidir.
- Yalnız istifadəçi canlı yeniləməni istəyəndə `scripts/publish.ps1` işlət. Push-dan sonra Hostinger build statusunu və canlı URL-i yoxla.
- `.env*`, açarlar, giriş məlumatları və şəxsi faylları Git-ə əlavə etmə.
- Başqa layihələrdəki mənbələri və istifadəçiyə məxsus dəyişiklikləri bu repoya köçürmə.
- Yerli yoxlama, Hostinger build nəticəsi və canlı sayt yoxlamasını ayrı-ayrı bildir.
