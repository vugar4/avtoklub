import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';

if (process.env.NODE_ENV === 'production') throw new Error('Demo məlumatları canlı bazaya yazılmır.');
const file = process.env.DATABASE_PATH || path.join(process.cwd(), '.data', 'avtoklub.sqlite');
fs.mkdirSync(path.dirname(file), { recursive: true });
const db = new Database(file);
db.pragma('foreign_keys = ON');
db.exec(fs.readFileSync(path.join(process.cwd(), 'database', 'schema.sql'), 'utf8'));
const run = (sql, ...args) => db.prepare(sql).run(...args);
const has = (sql, ...args) => Boolean(db.prepare(sql).get(...args));
const at = days => new Date(Date.now() + days * 86400000).toISOString();
const jid = value => `demo-${value}`;
const password = bcrypt.hashSync('Avtoklub2026!', 12);

const users = [
  ['murad', 'Murad Əliyev', 'murad_e39', 'murad@avtoklub.example', 'BMW E39 ilə həftəsonları yola çıxmağı sevirəm. Texniki söhbətlərə həmişə açığam.', 'Bakı', ['BMW'], 'user'],
  ['leyla', 'Leyla Məmmədova', 'leyla_drive', 'leyla@avtoklub.example', 'Şəhər sürüşü, uzun yol və yaxşı qəhvə.', 'Bakı', ['Mercedes-Benz', 'Audi'], 'admin'],
  ['orxan', 'Orxan Rzayev', 'orxan_gti', 'orxan@avtoklub.example', 'Klassik hot hatch-lər və öz əlimlə etdiyim xırda təmir işləri.', 'Sumqayıt', ['Volkswagen'], 'user'],
  ['aydan', 'Aydan Quliyeva', 'aydan_offroad', 'aydan@avtoklub.example', 'Həftəsonu marşrutlarını xəritədə yox, yolda seçirəm.', 'Gəncə', ['Toyota'], 'user'],
  ['elvin', 'Elvin Həsənov', 'elvin_parts', 'elvin@avtoklub.example', 'Ehtiyat hissələri və avtomobil baxımı haqqında danışaq.', 'Bakı', ['BMW', 'Toyota'], 'user'],
];
const clubs = [
  ['bmw', 'BMW Club', 'BMW', null, 'BMW sahibləri və həvəskarları üçün söhbətlər, təcrübə və görüşlər.', '/photos/bmw-meet.jpg'],
  ['mercedes', 'Mercedes-Benz Club', 'Mercedes-Benz', null, 'Mercedes-Benz modelləri, servis təcrübəsi və yol hekayələri.', '/photos/mercedes-sedan.jpg'],
  ['toyota', 'Toyota Club', 'Toyota', null, 'Etibarlı maşınlar və uzun yollar haqqında icma.', '/photos/land-cruiser-motion.jpg'],
  ['volkswagen', 'Volkswagen Club', 'Volkswagen', null, 'Gündəlik sürüşdən klassik GTI-yə qədər hər şey.', '/photos/car-meet.jpg'],
  ['hyundai', 'Hyundai Club', 'Hyundai', null, 'Hyundai sahiblərinin sual və təcrübələri.', '/photos/mountain-road.jpg'],
  ['kia', 'Kia Club', 'Kia', null, 'Kia modelləri barədə faydalı söhbətlər.', '/photos/mountain-road.jpg'],
  ['porsche', 'Porsche Club', 'Porsche', null, 'Sürüş mədəniyyəti və Porsche modelləri.', '/photos/porsche-959.jpg'],
  ['audi', 'Audi Club', 'Audi', null, 'Audi sahiblərinin və həvəskarlarının görüş yeri.', '/photos/audi-rs6.jpg'],
  ['nissan', 'Nissan Club', 'Nissan', null, 'Nissan sahibləri üçün bilik və təcrübə paylaşımı.', '/photos/mountain-road.jpg'],
  ['lexus', 'Lexus Club', 'Lexus', null, 'Lexus haqqında sakit və faydalı söhbətlər.', '/photos/mountain-road.jpg'],
  ['bmw-e39', 'BMW E39', 'BMW', 'E39', 'E39-un baxımı, ehtiyat hissələri və sürüş təcrübəsi.', '/photos/bmw-e39.jpg'],
  ['bmw-m', 'BMW M Series', 'BMW', 'M Series', 'BMW M modellərinin sürüşü və texniki tərəfi.', '/photos/bmw-meet.jpg'],
  ['mercedes-w212', 'Mercedes W212', 'Mercedes-Benz', 'W212', 'W212 sahiblərinin servis qeydləri və sualları.', '/photos/mercedes-sedan.jpg'],
  ['land-cruiser', 'Toyota Land Cruiser', 'Toyota', 'Land Cruiser', 'Yol bitəndən sonra da davam edən söhbətlər.', '/photos/land-cruiser-dunes.jpg'],
  ['golf-gti', 'Golf GTI', 'Volkswagen', 'Golf GTI', 'GTI nəsilləri, yığılma və sürüş hekayələri.', '/photos/golf-gti.jpg'],
];

db.transaction(() => {
  for (const [id, name, handle, email, bio, location, brands, role] of users) {
    if (!has('SELECT 1 FROM users WHERE id=?', jid(id))) run('INSERT INTO users(id,name,handle,email,password_hash,bio,location,brands,onboarded,role,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)', jid(id), name, handle, email, password, bio, location, JSON.stringify(brands), 1, role, at(-60));
  }
  for (const [slug, name, brand, model, description, cover] of clubs) {
    if (!has('SELECT 1 FROM clubs WHERE id=?', jid(`club-${slug}`))) run('INSERT INTO clubs(id,slug,name,brand,model,description,cover_url,created_at) VALUES(?,?,?,?,?,?,?,?)', jid(`club-${slug}`), slug, name, brand, model, description, cover, at(-50));
  }
  const memberships = [
    ['bmw', 'murad', 'moderator'], ['bmw-e39', 'murad', 'admin'], ['bmw', 'elvin', 'member'],
    ['mercedes', 'leyla', 'moderator'], ['mercedes-w212', 'leyla', 'member'], ['audi', 'leyla', 'member'],
    ['volkswagen', 'orxan', 'member'], ['golf-gti', 'orxan', 'moderator'],
    ['toyota', 'aydan', 'moderator'], ['land-cruiser', 'aydan', 'admin'], ['toyota', 'elvin', 'member'],
  ];
  for (const [c, u, role] of memberships) run('INSERT OR IGNORE INTO club_members(club_id,user_id,role,created_at) VALUES(?,?,?,?)', jid(`club-${c}`), jid(u), role, at(-40));
  const vehicles = [
    ['murad-e39', 'murad', 'BMW', '530i E39', 2002, '3.0 benzin', 'Benzin', 'Avtomat', 'Gümüşü', 238000, 'Uzun yolda özünü hələ də çox yaxşı aparır. Son baxımda soyutma sistemini yeniləmişəm.', ['M Sport sükan', '18 düymlük disklər'], ['/photos/bmw-e39.jpg']],
    ['orxan-gti', 'orxan', 'Volkswagen', 'Golf GTI Mk2', 1990, '1.8 benzin', 'Benzin', 'Mexaniki', 'Qara', 184000, 'Bir neçə ildir hissə-hissə bərpa edirəm. Ən sevdiyim maşınım budur.', ['Yenilənmiş asqı'], ['/photos/golf-gti.jpg']],
    ['aydan-lc', 'aydan', 'Toyota', 'Land Cruiser', 2015, '4.5 dizel', 'Dizel', 'Avtomat', 'Ağ', 161000, 'Şəhərdə sakit, dağ yollarında öz yerində.', ['All-terrain təkərlər'], []],
    ['leyla-mb', 'leyla', 'Mercedes-Benz', 'E 250', 2014, '2.0 benzin', 'Benzin', 'Avtomat', 'Qara', 137000, 'Gündəlik sürüş və uzun yol üçün rahat seçim.', [], []],
  ];
  for (const [key, owner, brand, model, year, engine, fuel, transmission, color, mileage, description, modifications, photos] of vehicles) {
    if (!has('SELECT 1 FROM vehicles WHERE id=?', jid(key))) run('INSERT INTO vehicles(id,user_id,brand,model,year,engine,fuel,transmission,color,mileage,description,modifications,image_urls,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)', jid(key), jid(owner), brand, model, year, engine, fuel, transmission, color, mileage, description, JSON.stringify(modifications), JSON.stringify(photos), at(-30));
  }
  const posts = [
    ['p1', 'murad', 'bmw-e39', 'E39 530i-də soyuq mühərrikdə yüngül titrəmə var. Şamları dəyişmişəm, amma tam keçməyib. Eyni problemi yaşayan olub?', 'Sualım var', [], -0.1],
    ['p2', 'aydan', 'land-cruiser', 'Bu həftəsonu Göygöl tərəfə sürdük. Yolda hava bir neçə dəfə dəyişdi, amma marşrut buna dəyərdi. Torpaq yolda təkər təzyiqini bir az azaltmaq xeyli kömək etdi.', 'Təcrübə paylaşımı', ['/photos/mountain-road.jpg'], -0.3],
    ['p3', 'orxan', 'golf-gti', 'GTI-nin asqısını nəhayət yığdım. İlk sürüşdə fərq dərhal hiss olunur; indi döngəyə daha arxayın girir. Köhnə hissələrin fotolarını da ayrıca paylaşaram.', 'Avtomobilimi təqdim edirəm', ['/photos/golf-gti.jpg'], -0.6],
    ['p4', 'leyla', 'mercedes-w212', 'W212-də kondisioner səsi son vaxtlar artıb. Kompressor tərəfini yoxlatdıran etibarlı usta tanıyırsınız?', 'Sualım var', [], -1.2],
    ['p5', 'elvin', 'bmw', 'Golf 7 üçün 18-lik disk axtaran dostum var. İkinci əl alanda çat və qaynaq izlərinə xüsusilə diqqət edin. Düzgün ölçünü də əvvəlcədən yoxlayın.', 'Texniki məsləhət', ['/photos/wheels.jpg'], -2],
    ['p6', 'murad', null, 'Şamaxı yoluna səhər tezdən çıxanda yol tamam başqa görünür. Sakit sürüş, yaxşı musiqi, bir də fasilədə çay — bəzən bundan artığı lazım deyil.', 'Adi paylaşım', ['/photos/mountain-road.jpg'], -3],
    ['p7', 'aydan', 'toyota', 'Land Cruiser üçün yay səfərindən əvvəl nələri yoxlayırsınız? Mən yağ, soyutma və ehtiyat təkəri siyahının başına qoyuram.', 'Sualım var', [], -5],
  ];
  for (const [key, owner, c, body, category, photos, days] of posts) if (!has('SELECT 1 FROM posts WHERE id=?', jid(key))) run('INSERT INTO posts(id,author_id,club_id,body,category,image_urls,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)', jid(key), jid(owner), c ? jid(`club-${c}`) : null, body, category, JSON.stringify(photos), at(days), at(days));
  const comments = [
    ['c1', 'p1', 'elvin', 'Boğaz kelebeği və vakuum xətlərinə də baxdır. Məndə oxşar əlamət oradan idi.'],
    ['c2', 'p1', 'leyla', 'Soyuqda daha çoxdursa, diaqnostikada yanacaq qarışığına da baxmaq yaxşı olar.'],
    ['c3', 'p3', 'murad', 'Klassik GTI-ni bu qədər səliqəli saxlamaq asan deyil. Əlinə sağlıq!'],
  ];
  for (const [key, postId, author, content] of comments) if (!has('SELECT 1 FROM comments WHERE id=?', jid(key))) run('INSERT INTO comments(id,post_id,author_id,body,created_at) VALUES(?,?,?,?,?)', jid(key), jid(postId), jid(author), content, at(-0.02));
  const listings = [
    ['l1', 'elvin', '18 düymlük orijinal BMW diskləri', '4 ədəd orijinal disk. Biri üzərində xırda kosmetik iz var, qaynaq edilməyib. Yerində baxmaq olar.', 'Disk və təkərlər', 'BMW', '3 Series', 850, 'used', 'Bakı, Yasamal', ['/photos/wheels.jpg']],
    ['l2', 'orxan', 'Golf GTI Mk2 üçün orijinal arxa stoplar', 'Cüt stop. Bərpa layihəm üçün artıq qalıb, işlək vəziyyətdədir.', 'Ehtiyat hissələri', 'Volkswagen', 'Golf GTI Mk2', 140, 'used', 'Sumqayıt', ['/photos/golf-gti.jpg']],
    ['l3', 'murad', 'BMW E39 salon üçün taxta dekor dəsti', 'Tam dəst. Bütün klipslər salamatdır, rəng fərqi yoxdur.', 'Aksesuarlar', 'BMW', 'E39', 190, 'used', 'Bakı, Nərimanov', ['/photos/bmw-e39.jpg']],
  ];
  for (const [key, seller, title, description, category, brand, model, price, condition, location, photos] of listings) if (!has('SELECT 1 FROM listings WHERE id=?', jid(key))) run('INSERT INTO listings(id,seller_id,title,description,category,brand,model,price,condition,location,image_urls,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)', jid(key), jid(seller), title, description, category, brand, model, price, condition, location, JSON.stringify(photos), at(-3), at(-3));
  const events = [
    ['ev1', 'murad', 'bmw', 'BMW həvəskarları ilə bazar görüşü', 'Sakit söhbət, avtomobillərə baxış və qəhvə üçün kiçik görüş. Gəlməyi düşünürsünüzsə, iştirakınızı qeyd edin.', 'Cars & Coffee', 12, 'Bakı', 'Dəniz Mall yaxınlığı', '/photos/bmw-meet.jpg'],
    ['ev2', 'aydan', 'land-cruiser', 'Göygöl istiqamətində həftəsonu yürüşü', 'Yola birlikdə çıxmaq istəyənlər üçün yığışırıq. Marşrut və dayanacaqları iştirakçılarla ayrıca dəqiqləşdirəcəyik.', 'Off-road', 24, 'Gəncə', 'Göygöl yolu', '/photos/land-cruiser-motion.jpg'],
    ['ev3', 'orxan', 'volkswagen', 'Klassik Volkswagen axşamı', 'Köhnə VW modellərinə marağı olanlar üçün rahat görüş. Maşın gətirməsəniz də, söhbətə qoşula bilərsiniz.', 'Avtomobil görüşləri', 18, 'Sumqayıt', 'Dənizkənarı park yaxınlığı', '/photos/car-meet.jpg'],
  ];
  for (const [key, owner, c, title, description, category, days, location, address, cover] of events) {
    if (!has('SELECT 1 FROM events WHERE id=?', jid(key))) run('INSERT INTO events(id,creator_id,club_id,title,description,category,starts_at,location,address,cover_url,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)', jid(key), jid(owner), jid(`club-${c}`), title, description, category, at(days), location, address, cover, at(-3), at(-3));
    else run('UPDATE events SET starts_at=? WHERE id=? AND starts_at<?', at(days), jid(key), at(-1));
  }
  for (const [ev, u] of [['ev1', 'murad'], ['ev1', 'leyla'], ['ev2', 'aydan'], ['ev2', 'elvin'], ['ev3', 'orxan']]) run('INSERT OR IGNORE INTO event_attendees(event_id,user_id,created_at) VALUES(?,?,?)', jid(ev), jid(u), at(-2));
  for (const [a, b] of [['leyla', 'murad'], ['murad', 'orxan'], ['elvin', 'aydan']]) run('INSERT OR IGNORE INTO follows(follower_id,followee_id,created_at) VALUES(?,?,?)', jid(a), jid(b), at(-4));
  for (const [p, u] of [['p1', 'elvin'], ['p1', 'leyla'], ['p2', 'murad'], ['p3', 'murad']]) run('INSERT OR IGNORE INTO post_likes(post_id,user_id,created_at) VALUES(?,?,?)', jid(p), jid(u), at(-0.01));
  if (!has('SELECT 1 FROM conversations WHERE id=?', jid('conv1'))) {
    run('INSERT INTO conversations(id,created_at,updated_at) VALUES(?,?,?)', jid('conv1'), at(-2), at(-0.5));
    for (const u of ['murad', 'elvin']) run('INSERT INTO conversation_members(conversation_id,user_id,last_read_at) VALUES(?,?,?)', jid('conv1'), jid(u), at(-0.7));
    run('INSERT INTO messages(id,conversation_id,sender_id,body,created_at) VALUES(?,?,?,?,?)', jid('m1'), jid('conv1'), jid('elvin'), 'Salam, E39 üçün dekor dəstinə baxmışdın?', at(-1));
    run('INSERT INTO messages(id,conversation_id,sender_id,body,created_at) VALUES(?,?,?,?,?)', jid('m2'), jid('conv1'), jid('murad'), 'Salam. Hə, bu həftəsonu gəlib baxa bilərəm.', at(-0.5));
  }
})();

console.log(`Avtoklub demo bazası hazırdır: ${file}`);
console.log('Hesablar: murad@avtoklub.example, leyla@avtoklub.example, orxan@avtoklub.example, aydan@avtoklub.example, elvin@avtoklub.example');
console.log('Demo parol: Avtoklub2026!');
db.close();
