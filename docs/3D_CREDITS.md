# Giriş səhifəsindəki 3D avtomobil və xəritə

- Cari model: [Sports Car, Grab3D](https://grab3d.com/models/vehicles/sports-car/), CC0. Fayl `public/models/sports-car.glb` ünvanından yerli servis edilir. Modelin rəngi brauzerdə mavi tonuna çevrilir.
- Əvvəlki Ferrari 458 modeli və ona aid fayllar layihədə saxlanılıb, lakin giriş səhifəsində istifadə edilmir. Mənbə: [Ferrari 458 Italia, vicent091036](https://sketchfab.com/models/57bf6cc56931426e87494f554df1dab6), CC BY 4.0.
- Xəritə plitələri və yol şəbəkəsi: [OpenStreetMap](https://www.openstreetmap.org/copyright). `src/components/baku-roads.json` Bakı mərkəzinin OSM API çıxarışından `scripts/export_baku_roads.py` ilə hazırlanıb. Xəritədə müəlliflik göstərilir.
- Sürüş rejimindəki 3D şəhərin bina və yaşıllıq konturları eyni OpenStreetMap çıxarışından `scripts/export_baku_city.py` ilə `src/components/baku-city.json` faylına çevrilib. 3D görünüş oyun üçün stilizə edilib; həqiqi bina hündürlüyü verilmədikdə təxmini hündürlük istifadə olunur.
- Gəzinti rejimindəki mavi bələdçi xəttinin koordinatları [OSRM](https://project-osrm.org/) marşrutundan götürülüb. Sürüş rejimində avtomobil sərbəst idarə olunur.
