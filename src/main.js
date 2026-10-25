import '@fontsource/manrope/400.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/manrope/800.css';
import './style.css';
import {modes,correct,updateProgress,isDifficult,shuffle,parseLines,initialState,mergeStates} from './core.js';
import {createClient} from '@supabase/supabase-js';
const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state;try{state=JSON.parse(localStorage.getItem('deutsch-state'))||initialState()}catch{state=initialState()}
const uid=()=>globalThis.crypto.randomUUID?.()||Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');
let page='home', selected=new Set(state.lessons.map(l=>l.id)), draft=[],session=null, cloud=null, syncing=false;
let config;try{config=JSON.parse(localStorage.getItem('deutsch-cloud'))}catch{}
let notice='', storageError='';
function save(){try{localStorage.setItem('deutsch-state',JSON.stringify(state));storageError=''}catch{storageError='Пам’ять браузера заповнена. Експортуйте резервну копію.'}sync()}
function shell(content){$('#app').innerHTML=`<header><a class="brand" href="#" data-page="home"><span class="logo">D<span>✦</span></span><div>Deutsch<span>Lernspiel</span></div></a><span class="tag">НІМЕЦЬКА · A1–A2</span><button class="cloud" data-page="settings">☁ <span>${cloud?'Синхронізація':'На цьому пристрої'}</span></button></header><div class="layout"><aside><p class="eyebrow">ВАШ ПРОСТІР</p><nav>${[['home','▦','Мої уроки'],['hard','◇','Складні слова'],['verbs','◉','Дієслова'],['add','＋','Додати урок'],['settings','⚙','Налаштування']].map(([p,icon,t])=>`<button data-page="${p}" class="${page===p?'active':''}"><span>${icon}</span>${t}${p==='hard'?`<small>${state.words.filter(w=>isDifficult(state.progress[w.id])).length}</small>`:''}</button>`).join('')}</nav><div class="aside-note"><span>☀</span><strong>Трохи щодня —<br>і слів стає більше.</strong><p>Навіть 10 хвилин мають значення.</p></div></aside><main>${storageError?`<p class="error">${storageError}</p>`:''}${content}</main></div><footer>Deutsch Lernspiel <span>Ваш маленький крок до вільної німецької.</span></footer>`;document.querySelectorAll('[data-page]').forEach(b=>b.onclick=e=>{e.preventDefault();if(session&&!confirm('Завершити тренування? Відповіді вже збережено.'))return;session=null;page=b.dataset.page;render()})}
function render(){if(session)return renderGame();if(page==='verbs')return renderVerbs();if(page==='add')return renderAdd();if(page==='settings')return renderSettings();const hard=page==='hard', words=state.words.filter(w=>!hard||isDifficult(state.progress[w.id]));const learned=state.words.filter(w=>state.progress[w.id]?.mastered).length;
shell(`<div class="heading"><div><p class="eyebrow">${hard?'ПОВТОРЕННЯ — ЦЕ СИЛА':'HALLO! ПРИВІТ!'}</p><h1>${hard?'Мої складні слова':'Новий день. Нові слова.'}</h1><p class="muted">${hard?'Слова, яким варто приділити ще трохи уваги.':'Вчіть німецьку у своєму темпі. Оберіть урок — і почнімо!'}</p></div><button class="primary" data-add>＋ Додати урок</button></div><section class="hero"><div><span class="pill">✦ МАЛЕНЬКА ЗВИЧКА, ВЕЛИКИЙ РЕЗУЛЬТАТ</span><h2>Ваші 10 хвилин<br>німецької сьогодні</h2><p>Кілька слів дорогою, за кавою чи між справами.<br>Кожна відповідь — крок уперед.</p><button class="light" id="quick">Почати швидке тренування <span>↗</span></button><small>◷ 10 хвилин · усі типи завдань</small></div><div class="hero-art" aria-hidden="true"><span class="spark">✧</span><div class="word-card back">die Welt <small>світ</small></div><div class="word-card front"><span>das</span>Wort<small>слово</small><b>✓</b></div><span class="dots">✦</span></div></section><div class="stats"><div><span class="stat-icon">▤</span><p><strong>${state.lessons.length}</strong><small>уроків у бібліотеці</small></p></div><div><span class="stat-icon peach">Aa</span><p><strong>${state.words.length}</strong><small>слів для відкриття</small></p></div><div><span class="stat-icon lavender">✓</span><p><strong>${learned}</strong><small>уже вивчено</small></p></div></div><section><div class="section-title"><h2>${hard?'Час повторити':'Бібліотека уроків'}</h2><span>${hard?words.length+' слів':'Оберіть кілька, щоб змішати слова'}</span></div>${hard?`<div class="word-list">${words.length?words.map(w=>`<div><strong>${esc(w.article)} ${esc(w.de)}</strong><span>${esc(w.uk)}</span></div>`).join(''):'<p>Тут з’являться слова після помилки або кнопки «Не знаю». Вивчені слова повертаються через 1, 2, 4… днів.</p>'}</div>`:`<div class="lesson-grid">${state.lessons.map((l,i)=>{const ws=state.words.filter(w=>w.lesson===l.id),n=ws.filter(w=>state.progress[w.id]?.mastered).length;return `<label class="lesson ${selected.has(l.id)?'selected':''}"><div class="lesson-top"><span class="book">${['▤','☕','✿','⌂'][i%4]}</span><input type="checkbox" data-select="${esc(l.id)}" ${selected.has(l.id)?'checked':''} aria-label="Обрати ${esc(l.name)}"></div><span class="level">A1–A2 · УРОК ${i+1}</span><h3>${esc(l.name)}</h3><p>${ws.length} слів <span>·</span> ${n} вивчено</p><div class="bar"><i style="width:${ws.length?n/ws.length*100:0}%"></i></div></label>`}).join('')}<button class="new-lesson" data-add><span>＋</span><strong>Ваш наступний урок</strong><small>Фото або власний список слів</small></button></div>`}<div class="training"><div><label for="mode">Як тренуємось?</label><select id="mode">${Object.entries(modes).map(([v,t])=>`<option value="${v}">${t}</option>`).join('')}</select></div><div><label for="duration">Тривалість</label><select id="duration"><option value="0">Без таймера</option><option value="10">10 хвилин</option><option value="15">15 хвилин</option></select></div><button class="primary" id="start">Тренувати ${hard?'складні слова':'обрані уроки'} →</button></div><p class="hint">♡ Помилятися — нормально. Складні слова ми збережемо для повторення.</p></section>`);
$('[data-add]').onclick=()=>{page='add';render()};document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{page='add';render()});document.querySelectorAll('[data-select]').forEach(b=>b.onchange=()=>{b.checked?selected.add(b.dataset.select):selected.delete(b.dataset.select);b.closest('.lesson').classList.toggle('selected',b.checked)});$('#start').onclick=()=>start(hard?words:state.words.filter(w=>selected.has(w.lesson)),$('#mode').value,Number($('#duration').value));$('#quick').onclick=()=>start(hard?words:state.words.filter(w=>selected.has(w.lesson)),'mix',10)}
function start(words,mode,minutes){if(mode==='article')words=words.filter(w=>w.article);if(!words.length)return alert('Оберіть урок зі словами. Для артиклів потрібні іменники з der, die або das.');session={words:shuffle(words),mode,index:0,score:0,answered:0,deadline:minutes?Date.now()+minutes*60000:0,result:null};renderGame()}
function task(){const s=session,w=s.words[s.index%s.words.length];if(!s.currentMode){s.currentMode=s.mode==='mix'?shuffle(['de','uk','write',...(w.article?['article']:[])])[0]:s.mode}return {w,mode:s.currentMode}}
function renderGame(){const s=session;if(s.deadline&&Date.now()>=s.deadline)return finish();const {w,mode}=task(),prompt=mode==='de'?`${w.article} ${w.de}`:mode==='article'?w.de:w.uk;const alternatives=[...new Set(state.words.map(x=>mode==='de'?x.uk:x.de))].filter(x=>x!==(mode==='de'?w.uk:w.de));if(!s.choices)s.choices=shuffle([mode==='de'?w.uk:w.de,...shuffle(alternatives).slice(0,3)]);
shell(`<div class="heading"><div><p class="eyebrow">КРОК ЗА КРОКОМ</p><h1>Практика німецької</h1></div><button id="finish" class="secondary">Завершити</button></div><div class="game-meta"><span>Відповідей: ${s.answered}</span><strong>✦ ${s.score} балів</strong><span id="clock"></span></div><div class="game"><span class="pill">${modes[mode]}</span><h2>${esc(prompt)}</h2><p class="muted">${mode==='article'?'Оберіть артикль':mode==='write'?'Напишіть німецьке слово без артикля':mode==='de'?'Оберіть український переклад':'Оберіть німецьке слово'}</p>${s.result?`<div class="feedback ${s.result.ok?'success':'wrong'}"><h3>${s.result.ok?'Чудово! Так тримати.':'Запам’ятаймо разом'}</h3><strong>${esc(w.article)} ${esc(w.de)} — ${esc(w.uk)}</strong>${!s.result.ok?explanation(w):''}</div><button id="next" class="primary">Наступне слово →</button>`:mode==='write'?`<form id="answer-form"><input id="answer" autocomplete="off" placeholder="Ваше слово…" aria-label="Ваше слово" required><button class="primary">Перевірити</button></form>`:`<div class="choices">${(mode==='article'?['der','die','das']:s.choices).map(c=>`<button class="choice" data-answer="${esc(c)}">${esc(c)}</button>`).join('')}</div>`}${!s.result?'<button class="explain" id="unknown">Не знаю — поясни слово</button>':''}</div><p class="hint">Три правильні відповіді поспіль — і складне слово переходить до вивчених.</p>`);$('#finish').onclick=finish;if(s.result)$('#next').onclick=()=>{s.index++;s.result=null;s.currentMode=null;s.choices=null;renderGame()};else{document.querySelectorAll('[data-answer]').forEach(b=>b.onclick=()=>answer(b.dataset.answer));if($('#answer-form')){$('#answer-form').onsubmit=e=>{e.preventDefault();answer($('#answer').value)};$('#answer').focus()}$('#unknown').onclick=()=>answer(null)}tick()}
function explanation(w){return `<div class="explanation">${w.example?`<p><b>${esc(w.example)}</b><br>${esc(w.translation)}</p>`:'<p>Для цього слова ще немає перевіреного прикладу. Його можна додати під час створення уроку.</p>'}${w.parts?`<p><strong>${esc(w.parts)}</strong><br>${esc(w.explanation)}</p>`:`<p>${esc(w.explanation||'Розкладу на частини немає. Вивчайте слово як ціле разом із його перекладом.')}</p>`}</div>`}
function answer(value){if(!session||session.result)return;const {w,mode}=task(),ok=value!==null&&correct(value,w,mode);state.progress[w.id]=updateProgress(state.progress[w.id],ok);session.result={ok};session.answered++;if(ok)session.score+=10;save();renderGame()}
function tick(){if(!session)return;const el=$('#clock');if(session.deadline){const left=Math.max(0,Math.ceil((session.deadline-Date.now())/1000));if(el)el.textContent=`◷ ${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}`;if(!left)finish()}else if(el)el.textContent='У своєму темпі'}setInterval(tick,1000);
function finish(){const s=session;if(!s)return;session=null;shell(`<div class="game"><span class="celebrate">✦</span><p class="eyebrow">ЩЕ ОДИН КРОК УПЕРЕД</p><h1>Гарна робота!</h1><p>Відповідей: ${s.answered} · Правильних: ${s.score/10}</p><h2>${s.score} балів</h2><p class="muted">Результати збережені. Складні слова чекатимуть на повторення.</p><button class="primary" id="back">До моїх уроків →</button></div>`);$('#back').onclick=()=>{page='home';render()}}

// Carefully transcribed from the user's A1 verb tables (textbook p. 347).
// Columns: infinitive, Ukrainian meaning, er/sie/es Präsens, Perfekt, case.
const initialVerbBatch=[
  ["antworten","відповідати","antwortet","hat geantwortet","Dativ"],
  ["helfen","допомагати","hilft","hat geholfen","Dativ"],
  ["gefallen","подобатися","gefällt","hat gefallen","Dativ"],
  ["gehören","належати","gehört","hat gehört","Dativ"],
  ["gratulieren","вітати","gratuliert","hat gratuliert","Dativ"],
  ["leidtun","бути шкода","tut leid","hat leidgetan","Dativ"],
  ["schmecken","смакувати","schmeckt","hat geschmeckt","Dativ"],
  ["anbieten","пропонувати","bietet an","hat angeboten","Dativ + Akkusativ"],
  ["bestellen","замовляти","bestellt","hat bestellt","Dativ + Akkusativ"],
  ["bieten","пропонувати","bietet","hat geboten","Dativ + Akkusativ"],
  ["geben","давати","gibt","hat gegeben","Dativ + Akkusativ"],
  ["mitbringen","приносити із собою","bringt mit","hat mitgebracht","Dativ + Akkusativ"],
  ["mitgeben","давати із собою","gibt mit","hat mitgegeben","Dativ + Akkusativ"],
  ["schenken","дарувати","schenkt","hat geschenkt","Dativ + Akkusativ"],
  ["schicken","надсилати","schickt","hat geschickt","Dativ + Akkusativ"],
  ["wünschen","бажати","wünscht","hat gewünscht","Dativ + Akkusativ"]
];
const secondVerbBatch=[
["abholen","забирати","holt ab","hat abgeholt","Akkusativ"],
["anklicken","натискати мишкою","klickt an","hat angeklickt","Akkusativ"],
["anmelden","реєструвати","meldet an","hat angemeldet","Akkusativ"],
["anrufen","телефонувати комусь","ruft an","hat angerufen","Akkusativ"],
["ansehen","дивитися на","sieht an","hat angesehen","Akkusativ"],
["ausfüllen","заповнювати","füllt aus","hat ausgefüllt","Akkusativ"],
["ausmachen","вимикати; домовлятися","macht aus","hat ausgemacht","Akkusativ"],
["auspacken","розпаковувати","packt aus","hat ausgepackt","Akkusativ"],
["benutzen","використовувати","benutzt","hat benutzt","Akkusativ"],
["besichtigen","оглядати","besichtigt","hat besichtigt","Akkusativ"],
["besuchen","відвідувати","besucht","hat besucht","Akkusativ"],
["bezahlen","оплачувати","bezahlt","hat bezahlt","Akkusativ"],
["brauchen","потребувати","braucht","hat gebraucht","Akkusativ"],
["einladen","запрошувати","lädt ein","hat eingeladen","Akkusativ"],
["erreichen","досягати; зв'язуватися","erreicht","hat erreicht","Akkusativ"],
["fragen","запитувати","fragt","hat gefragt","Akkusativ"],
["kennenlernen","знайомитися з","lernt kennen","hat kennengelernt","Akkusativ"],
["öffnen","відчиняти","öffnet","hat geöffnet","Akkusativ"],
["vergessen","забувати","vergisst","hat vergessen","Akkusativ"],
["verstehen","розуміти","versteht","hat verstanden","Akkusativ"]
];
const thirdVerbBatch=[["abfahren","від'їжджати","fährt ab","ist abgefahren"],["abnehmen","знімати; худнути","nimmt ab","hat abgenommen"],["abschließen","замикати; завершувати","schließt ab","hat abgeschlossen"],["abwaschen","мити посуд; змивати","wäscht ab","hat abgewaschen"],["ankommen","прибувати","kommt an","ist angekommen"],["anziehen","одягати","zieht an","hat angezogen"],["aufnehmen","записувати; приймати","nimmt auf","hat aufgenommen"],["aufschreiben","записувати","schreibt auf","hat aufgeschrieben"],["aufstehen","вставати","steht auf","ist aufgestanden"],["ausgeben","витрачати; видавати","gibt aus","hat ausgegeben"],["aussehen","виглядати","sieht aus","hat ausgesehen"],["aussteigen","виходити з транспорту","steigt aus","ist ausgestiegen"],["austragen","розносити; виносити","trägt aus","hat ausgetragen"],["backen","пекти","backt","hat gebacken"],["beginnen","починати","beginnt","hat begonnen"],["bekommen","отримувати","bekommt","hat bekommen"],["beraten","консультувати","berät","hat beraten"],["besprechen","обговорювати","bespricht","hat besprochen"],["bestehen","складати іспит; існувати","besteht","hat bestanden"],["bleiben","залишатися","bleibt","ist geblieben"],["braten","смажити","brät","hat gebraten"],["bringen","приносити","bringt","hat gebracht"],["denken","думати","denkt","hat gedacht"],["durchstreichen","закреслювати","streicht durch","hat durchgestrichen"],["einsteigen","заходити в транспорт","steigt ein","ist eingestiegen"],["einziehen","вселятися","zieht ein","ist eingezogen"],["erfinden","винаходити","erfindet","hat erfunden"],["essen","їсти","isst","hat gegessen"],["fahren","їхати","fährt","ist gefahren"],["fernsehen","дивитися телевізор","sieht fern","hat ferngesehen"]];
const fourthVerbBatch=[["finden","знаходити","findet","hat gefunden"],["fliegen","літати","fliegt","ist geflogen"],["freihaben","мати вихідний","hat frei","hat freigehabt"],["gehen","йти; ходити","geht","ist gegangen"],["gewinnen","вигравати; перемагати","gewinnt","hat gewonnen"],["haben","мати","hat","hat gehabt"],["halten","тримати; зупиняти","hält","hat gehalten"],["heißen","називатися","heißt","hat geheißen"],["kennen","знати; бути знайомим","kennt","hat gekannt"],["kommen","приходити; прибувати","kommt","ist gekommen"],["krankschreiben","оформляти лікарняний","schreibt krank","hat krankgeschrieben"],["laufen","бігти; ходити пішки","läuft","ist gelaufen"],["leihen","позичати","leiht","hat geliehen"],["lesen","читати","liest","hat gelesen"],["losgehen","вирушати; починатися","geht los","ist losgegangen"],["mitkommen","іти або їхати разом","kommt mit","ist mitgekommen"],["mitlesen","читати разом із кимось","liest mit","hat mitgelesen"],["mitnehmen","брати із собою","nimmt mit","hat mitgenommen"],["mögen","любити; подобатися","mag","hat gemocht"],["nehmen","брати","nimmt","hat genommen"],["nennen","називати","nennt","hat genannt"],["raten","радити; вгадувати","rät","hat geraten"],["reiten","їхати верхи","reitet","ist geritten"],["riechen","нюхати; пахнути","riecht","hat gerochen"],["schlafen","спати","schläft","hat geschlafen"],["schneiden","різати","schneidet","hat geschnitten"],["schreiben","писати","schreibt","hat geschrieben"],["schwimmen","плавати","schwimmt","ist geschwommen"],["sehen","бачити","sieht","hat gesehen"],["sein","бути","ist","ist gewesen"],["singen","співати","singt","hat gesungen"],["spazieren gehen","гуляти","geht spazieren","ist spazieren gegangen"],["sprechen","говорити","spricht","hat gesprochen"],["stattfinden","відбуватися","findet statt","hat stattgefunden"],["stehen","стояти","steht","hat gestanden"],["tragen","носити; нести","trägt","hat getragen"],["treffen","зустрічати","trifft","hat getroffen"],["trinken","пити","trinkt","hat getrunken"],["tun","робити","tut","hat getan"],["umsteigen","пересідати на інший транспорт","steigt um","ist umgestiegen"],["umziehen","переїжджати","zieht um","ist umgezogen"],["unterschreiben","підписувати","unterschreibt","hat unterschrieben"],["verbinden","з'єднувати","verbindet","hat verbunden"],["vergleichen","порівнювати","vergleicht","hat verglichen"],["vorschlagen","пропонувати","schlägt vor","hat vorgeschlagen"],["vorlesen","читати вголос","liest vor","hat vorgelesen"],["waschen","мити; прати","wäscht","hat gewaschen"],["wandern","ходити в похід","wandert","ist gewandert"],["wehtun","боліти; завдавати болю","tut weh","hat wehgetan"],["werden","ставати","wird","ist geworden"],["weitergeben","передавати далі","gibt weiter","hat weitergegeben"],["ziehen","тягнути","zieht","hat gezogen"],["zurückfahren","повертатися транспортом","fährt zurück","ist zurückgefahren"],["zurückgehen","повертатися пішки","geht zurück","ist zurückgegangen"]];
const fifthVerbBatch=[["abstellen","ставити; залишати","stellt ab","hat abgestellt"],["ankreuzen","позначати хрестиком","kreuzt an","hat angekreuzt"],["aufhängen","вішати","hängt auf","hat aufgehängt"],["aufräumen","прибирати","räumt auf","hat aufgeräumt"],["ausprobieren","випробовувати","probiert aus","hat ausprobiert"],["beantworten","відповідати на запитання","beantwortet","hat beantwortet"],["begrüßen","вітати когось","begrüßt","hat begrüßt"],["bestätigen","підтверджувати","bestätigt","hat bestätigt"],["bilden","утворювати; складати","bildet","hat gebildet"],["buchstabieren","називати по літерах","buchstabiert","hat buchstabiert"],["einchecken","реєструватися на рейс чи в готелі","checkt ein","hat eingecheckt"],["ergänzen","доповнювати","ergänzt","hat ergänzt"],["formulieren","формулювати","formuliert","hat formuliert"],["grillen","смажити на грилі","grillt","hat gegrillt"],["holen","приносити; забирати","holt","hat geholt"],["hören","чути; слухати","hört","hat gehört"],["kaufen","купувати","kauft","hat gekauft"],["kochen","готувати їжу; варити","kocht","hat gekocht"],["korrigieren","виправляти","korrigiert","hat korrigiert"],["lernen","вчити; вчитися","lernt","hat gelernt"],["lieben","любити","liebt","hat geliebt"],["machen","робити","macht","hat gemacht"],["markieren","позначати","markiert","hat markiert"],["mieten","орендувати","mietet","hat gemietet"],["notieren","занотовувати","notiert","hat notiert"],["ordnen","упорядковувати","ordnet","hat geordnet"],["organisieren","організовувати","organisiert","hat organisiert"],["planen","планувати","plant","hat geplant"],["probieren","пробувати","probiert","hat probiert"],["programmieren","програмувати","programmiert","hat programmiert"],["putzen","чистити; прибирати","putzt","hat geputzt"],["reparieren","ремонтувати","repariert","hat repariert"],["reservieren","бронювати","reserviert","hat reserviert"],["sagen","казати","sagt","hat gesagt"],["sammeln","збирати","sammelt","hat gesammelt"],["sitzen","сидіти","sitzt","hat gesessen"],["liegen","лежати","liegt","hat gelegen"]];
const sixthVerbBatch=[["möchten","хотіти (ввічлива форма)","möchte",""],["spielen","грати","spielt","hat gespielt"],["studieren","навчатися у виші; вивчати","studiert","hat studiert"],["suchen","шукати","sucht","hat gesucht"],["tauschen","обмінювати","tauscht","hat getauscht"],["unterstreichen","підкреслювати","unterstreicht","hat unterstrichen"],["variieren","змінювати; варіювати","variiert","hat variiert"],["verdienen","заробляти","verdient","hat verdient"],["vereinbaren","домовлятися; узгоджувати","vereinbart","hat vereinbart"],["verkaufen","продавати","verkauft","hat verkauft"],["vorbereiten","готувати; підготовляти","bereitet vor","hat vorbereitet"],["vorstellen","представляти; уявляти","stellt vor","hat vorgestellt"],["wählen","вибирати; голосувати","wählt","hat gewählt"],["wiederholen","повторювати","wiederholt","hat wiederholt"],["wissen","знати (факт)","weiß","hat gewusst"],["zahlen","платити","zahlt","hat gezahlt"],["zeichnen","малювати; креслити","zeichnet","hat gezeichnet"],["zeigen","показувати","zeigt","hat gezeigt"],["zerschneiden","розрізати на частини","zerschneidet","hat zerschnitten"],["zuordnen","відносити до; зіставляти","ordnet zu","hat zugeordnet"]];
const textbookAkkusativVerbs=new Set(`abholen abstellen ankreuzen anrufen ansehen aufhängen aufräumen aufschreiben ausfüllen ausprobieren beantworten begrüßen bekommen benutzen bestätigen besuchen bezahlen bilden braten brauchen buchstabieren einchecken einladen ergänzen essen finden formulieren fragen grillen haben holen hören kaufen kennen kennenlernen kochen korrigieren krankschreiben leihen lernen lesen lieben machen markieren mieten mitbringen mitnehmen mögen nehmen notieren ordnen organisieren planen probieren programmieren putzen reparieren reservieren sagen sammeln schicken schneiden schreiben sehen spielen sprechen studieren suchen tauschen tragen treffen trinken unterstreichen variieren verbinden verdienen vereinbaren vergessen vergleichen verkaufen verstehen vorbereiten vorstellen wählen waschen wiederholen wissen zahlen zeichnen zeigen zerschneiden ziehen zuordnen`.split(" "));
function ensureVerbs(){
  if(!Array.isArray(state.verbs))state.verbs=[];
  if(!state.verbProgress||typeof state.verbProgress!=='object')state.verbProgress={};
  // Match the case labels to the original textbook's Akkusativ tables (pp. 345-347).
  let caseLabelsUpdated=false;
  for(const v of state.verbs){
    if(textbookAkkusativVerbs.has(v.infinitive?.trim().toLocaleLowerCase("de"))&&!v.gramCase){
      v.gramCase="Akkusativ";caseLabelsUpdated=true;
    }
  }
  if(caseLabelsUpdated)try{localStorage.setItem("deutsch-state",JSON.stringify(state))}catch{}
  if(localStorage.getItem("deutsch-verbs-batch-6")!=="done"){
    for(const [infinitive,uk,present,perfekt] of sixthVerbBatch){
      const exists=state.verbs.some(v=>v.infinitive?.trim().toLocaleLowerCase("de")===infinitive&&((v.level||"A1")==="A1"));
      if(exists)continue;
      state.verbs.push({id:"textbook-a1-b6-"+infinitive,level:"A1",infinitive,uk,present,perfekt,gramCase:"",updated:Date.now()});
    }
    try{localStorage.setItem("deutsch-state",JSON.stringify(state));localStorage.setItem("deutsch-verbs-batch-6","done")}catch{}
  }
  if(localStorage.getItem("deutsch-verbs-batch-5")!=="done"){
    for(const [infinitive,uk,present,perfekt] of fifthVerbBatch){
      const exists=state.verbs.some(v=>v.infinitive?.trim().toLocaleLowerCase("de")===infinitive&&((v.level||"A1")==="A1"));
      if(exists)continue;
      const gramCase=["sitzen","liegen"].includes(infinitive)?"":"Akkusativ";
      state.verbs.push({id:"textbook-a1-b5-"+infinitive,level:"A1",infinitive,uk,present,perfekt,gramCase,updated:Date.now()});
    }
    try{localStorage.setItem("deutsch-state",JSON.stringify(state));localStorage.setItem("deutsch-verbs-batch-5","done")}catch{}
  }
  if(localStorage.getItem("deutsch-verbs-batch-4")!=="done"){
    for(const [infinitive,uk,present,perfekt] of fourthVerbBatch){
      const exists=state.verbs.some(v=>v.infinitive?.trim().toLocaleLowerCase("de")===infinitive&&((v.level||"A1")==="A1"));
      if(exists)continue;
      state.verbs.push({id:"textbook-irregular-"+infinitive.replace(/\\s+/g,"-"),level:"A1",infinitive,uk,present,perfekt,gramCase:"",updated:Date.now()});
    }
    try{localStorage.setItem("deutsch-state",JSON.stringify(state));localStorage.setItem("deutsch-verbs-batch-4","done")}catch{}
  }
  if(localStorage.getItem("deutsch-verbs-batch-3")!=="done"){
    for(const [infinitive,uk,present,perfekt] of thirdVerbBatch){
      const exists=state.verbs.some(v=>v.infinitive?.trim().toLocaleLowerCase("de")===infinitive&&((v.level||"A1")==="A1"));
      if(exists)continue;
      state.verbs.push({id:"textbook-irregular-"+infinitive,level:"A1",infinitive,uk,present,perfekt,gramCase:"",updated:Date.now()});
    }
    try{localStorage.setItem("deutsch-state",JSON.stringify(state));localStorage.setItem("deutsch-verbs-batch-3","done")}catch{}
  }
  if(localStorage.getItem("deutsch-verbs-batch-2")!=="done"){
    for(const [infinitive,uk,present,perfekt,gramCase] of secondVerbBatch){
      const existing=state.verbs.find(v=>v.infinitive?.trim().toLocaleLowerCase("de")===infinitive&&((v.level||"A1")==="A1"));
      if(existing){if(!existing.gramCase)existing.gramCase=gramCase;continue;}
      state.verbs.push({id:"textbook-a1-"+infinitive,level:"A1",infinitive,uk,present,perfekt,gramCase,updated:Date.now()});
    }
    try{localStorage.setItem("deutsch-state",JSON.stringify(state));localStorage.setItem("deutsch-verbs-batch-2","done")}catch{}
  }
  if(localStorage.getItem("deutsch-verbs-batch-1")!=="done"){
    for(const [infinitive,uk,present,perfekt,gramCase] of initialVerbBatch){
      const existing=state.verbs.find(v=>v.infinitive?.trim().toLocaleLowerCase("de")===infinitive&&((v.level||"A1")==="A1"));
      if(existing){if(!existing.gramCase)existing.gramCase=gramCase;continue;}
      state.verbs.push({id:"textbook-a1-"+infinitive,level:"A1",infinitive,uk,present,perfekt,gramCase,updated:Date.now()});
    }
    try{localStorage.setItem("deutsch-state",JSON.stringify(state));localStorage.setItem("deutsch-verbs-batch-1","done")}catch{}
  }
}

let verbMode='translate',verbLevel='A1',verbCard=null,verbRevealed=false,verbDraft='',verbGuess='',verbNotice='',verbChecked=null;

function eligibleVerbs(){
  ensureVerbs();
  return state.verbs.filter(v=>(v.level||"A1")===verbLevel&&(verbMode==="translate"||(verbMode==="present"?Boolean(v.present?.trim()):Boolean(v.perfekt?.trim()))));
}

function nextVerb(previous=null){
  const pool=eligibleVerbs();
  const choices=pool.length>1?pool.filter(v=>v.id!==previous):pool;
  choices.sort((a,b)=>{
    const pa=state.verbProgress[a.id+":"+verbMode]||{},pb=state.verbProgress[b.id+":"+verbMode]||{};
    const as=(pa.attempts||0)+(pa.mastered?2:0)-(isDifficult(pa)?0.4:0);
    const bs=(pb.attempts||0)+(pb.mastered?2:0)-(isDifficult(pb)?0.4:0);
    return as-bs;
  });
  return choices[0]?.id||null;
}

function renderVerbs(){
  ensureVerbs();
  const pool=eligibleVerbs();
  if(!pool.some(v=>v.id===verbCard))verbCard=nextVerb();
  const v=state.verbs.find(x=>x.id===verbCard);
  const modeLabel={translate:"Переклад",present:"Präsens · er/sie/es",perfekt:"Perfekt"}[verbMode];
  const challenge=v?(verbMode==="translate"?v.uk:v.infinitive):"";
  // Normalize only the two original sample entries; imported text may have mixed both forms.
  let repaired=false;
  for(const verb of state.verbs){
    const name=(verb.infinitive||"").trim().toLocaleLowerCase("de");
    const known=name==="anfangen"?{present:"fängt an",perfekt:"hat angefangen"}:name==="helfen"?{present:"hilft",perfekt:"hat geholfen"}:null;
    if(!known)continue;
    if(verb.present!==known.present||verb.perfekt!==known.perfekt){
      verb.present=known.present;verb.perfekt=known.perfekt;repaired=true;
    }
  }
  // Some verbs have two accepted standard forms. Keep the displayed answer concise.
  const variants={
    backen:{present:["backt","bäckt"]},
    sitzen:{perfekt:["hat gesessen","ist gesessen"]},
    stehen:{perfekt:["hat gestanden","ist gestanden"]},
    liegen:{perfekt:["hat gelegen","ist gelegen"]}
  };
  if(repaired)try{localStorage.setItem("deutsch-state",JSON.stringify(state))}catch{}
  const result=v?(verbMode==="translate"?v.infinitive:verbMode==="present"?v.present:v.perfekt):"";
  const lvl=verbLevel;
  shell(`<div class="heading"><div><p class="eyebrow">ТРЕНАЖЕР ПАМ’ЯТІ</p><h1>Дієслова · Verben</h1><p class="muted">Згадуй переклад і граматичні форми окремо. Правильна відповідь прихована до перевірки.</p></div></div>
<div class="panel">
  <label for="verb-level">Рівень</label>
  <select id="verb-level"><option value="A1" ${lvl==="A1"?"selected":""}>A1</option><option value="A2" ${lvl==="A2"?"selected":""}>A2</option></select>
  <p class="muted">${state.verbs.filter(v=>(v.level||"A1")===lvl).length} дієслів у розділі ${esc(lvl)}</p>
  <div class="actions" style="flex-wrap:wrap">
    ${[["translate","Переклад"],["present","Präsens"],["perfekt","Perfekt"]].map(([key,label])=>`<button type="button" class="${key===verbMode?"primary":"secondary"}" data-verb-mode="${key}">${label}</button>`).join("")}
  </div>
  ${v?`<div class="game" style="margin-top:16px">
    <span class="pill">${modeLabel}</span>${v.gramCase?` <span class="pill">${esc(v.gramCase)}</span>`:""}<h2>${esc(challenge)}</h2>
    <p class="muted">${verbMode==="translate"?"Згадай початкову форму німецькою.":verbMode==="present"?"Згадай форму для er/sie/es.":"Згадай форму Perfekt з haben або sein."}</p>
    ${verbRevealed?`<div class="feedback ${verbChecked?"success":"wrong"}"><p>${verbChecked?"Правильно!":"Помилка. Правильна відповідь:"}</p><strong>${esc(result)}</strong><p>${esc(v.uk)}</p>${verbGuess?`<p>Твоя спроба: ${esc(verbGuess)}</p>`:""}</div>
      <div class="actions"><button id="verb-next" class="primary">Наступне дієслово →</button></div>`:
      `<label for="verb-guess">Напиши відповідь</label><input id="verb-guess" value="${esc(verbGuess)}" autocomplete="off" placeholder="Введи відповідь" required>
      <button id="verb-reveal" class="primary">Перевірити</button>`}
  </div>`:`<p class="hint">${state.verbs.length===0?"Спочатку додай дієслова нижче.":"Для цього рівня або режиму ще немає дієслів з потрібними формами."}</p>`}
</div>
<div class="panel">
  <h2>Додати дієслова · ${esc(lvl)}</h2>
  <p class="hint">Один рядок: інфінітив — переклад — форма er/sie/es — Perfekt. Останні дві форми необов’язкові: такі слова братимуть участь лише в тренуванні перекладу.</p>
  <textarea id="verb-raw" rows="6" placeholder="anfangen — починати — fängt an — hat angefangen&#10;helfen — допомагати — hilft — hat geholfen">${esc(verbDraft)}</textarea>
  <button id="verb-add" class="secondary">Зберегти дієслова</button>
  ${verbNotice?`<p role="status">${esc(verbNotice)}</p>`:""}
</div>`);
  $("#verb-level").onchange=e=>{verbLevel=e.target.value;verbCard=null;verbRevealed=false;verbChecked=null;verbGuess="";verbNotice="";renderVerbs()};
  document.querySelectorAll("[data-verb-mode]").forEach(b=>b.onclick=()=>{verbMode=b.dataset.verbMode;verbCard=null;verbRevealed=false;verbChecked=null;verbGuess="";renderVerbs()});
  if(v){
    if(!verbRevealed){
      $("#verb-guess").oninput=e=>verbGuess=e.target.value;
      $("#verb-reveal").onclick=()=>{
        verbGuess=$("#verb-guess").value.trim();
        if(!verbGuess)return alert("Спочатку введи відповідь.");
        const norm=x=>x.trim().toLocaleLowerCase("de").replace(/\\s+/g," ");
        const target=verbMode==="translate"?v.infinitive:verbMode==="present"?v.present:v.perfekt;
        const attempt=verbMode==="present"?verbGuess.replace(/^(er|sie|es)\\s+/i,""):verbGuess;
        const alternatives=variants[v.infinitive?.trim().toLocaleLowerCase("de")]?.[verbMode]||[];
        verbChecked=[target,...alternatives].some(answer=>norm(attempt)===norm(answer));
        state.verbProgress[v.id+":"+verbMode]=updateProgress(state.verbProgress[v.id+":"+verbMode],verbChecked);
        save();verbRevealed=true;renderVerbs();
      };
    }else{
      $("#verb-next").onclick=()=>{verbCard=nextVerb(v.id);verbRevealed=false;verbChecked=null;verbGuess="";renderVerbs()};
    }
  }
  $("#verb-raw").oninput=e=>verbDraft=e.target.value;
  $("#verb-add").onclick=()=>{
    const rows=verbDraft.split(/\r?\n/).map(l=>l.split(/\s*[—–]\s*/).map(x=>x.trim())).filter(p=>p.length>=2&&p[0]&&p[1]);
    if(!rows.length)return alert("Додай хоча б один рядок: дієслово — переклад — er/sie/es — Perfekt.");
    let added=0,skipped=0;
    for(const p of rows){
      const found=state.verbs.some(x=>x.infinitive.toLocaleLowerCase("de")===p[0].toLocaleLowerCase("de")&&(x.level||"A1")===lvl);
      if(found){skipped++;continue;}
      state.verbs.push({id:uid(),level:lvl,infinitive:p[0],uk:p[1],present:p[2]||"",perfekt:p[3]||"",updated:Date.now()});added++;
    }
    verbNotice=`Додано: ${added}. Уже були у списку: ${skipped}.`;
    verbDraft="";verbCard=null;save();renderVerbs();
  };
}

function row(w,i){return `<div class="edit-row" data-row="${i}"><input data-field="de" value="${esc(w.de)}" placeholder="Німецьке слово" aria-label="Німецьке слово"><select data-field="article" aria-label="Артикль">${['','der','die','das'].map(a=>`<option ${a===w.article?'selected':''} value="${a}">${a||'Без артикля'}</option>`).join('')}</select><input data-field="uk" value="${esc(w.uk)}" placeholder="Переклад українською" aria-label="Переклад українською"><button type="button" data-remove="${i}" aria-label="Прибрати слово">×</button><details><summary>Приклад і пояснення (необов’язково)</summary>${[['example','Речення німецькою'],['translation','Переклад речення'],['parts','Частини слова — лише перевірений розклад'],['explanation','Пояснення значення або частин']].map(([f,p])=>`<input data-field="${f}" value="${esc(w[f])}" placeholder="${p}" aria-label="${p}">`).join('')}</details></div>`}
function collect(){document.querySelectorAll('[data-row]').forEach(el=>el.querySelectorAll('[data-field]').forEach(i=>draft[Number(el.dataset.row)][i.dataset.field]=i.value))}
let lessonName='',rawText='',ocrBusy=false;
function renderAdd(){shell(`<div class="heading"><div><p class="eyebrow">ВЛАСНІ СЛОВА — ВЛАСНИЙ ТЕМП</p><h1>Додати урок</h1><p class="muted">Фото сторінки або список слів. Завжди перевіряйте результат.</p></div></div><div class="panel"><label for="lesson-name">Назва уроку</label><input id="lesson-name" value="${esc(lessonName)}" placeholder="Наприклад, У місті · урок 2"><label class="upload" for="photos"><strong>＋ Обрати фотографії</strong><span>Кілька JPG / PNG / WEBP · розпізнавання на пристрої</span></label><input type="file" id="photos" accept="image/*" multiple ${ocrBusy?'disabled':''}><p id="ocr-status" role="status">${esc(notice)}</p><p class="hint">OCR завантажує мовні моделі з цього сайту. Фото не надсилаються до сервісу розпізнавання. Колонки, рукопис і нечіткі фото можуть розпізнаватися неправильно.</p><label for="raw">Список слів або розпізнаний текст</label><textarea id="raw" rows="7" placeholder="der Bus — автобус&#10;mitkommen — йти разом">${esc(rawText)}</textarea><button class="secondary" id="parse">Перенести список у таблицю</button><p class="hint">Одне слово в рядку: німецьке — український переклад. Можна використати ; або табуляцію.</p><div id="rows">${draft.map(row).join('')}</div><button class="secondary" id="add-row">＋ Слово вручну</button><div class="actions"><button class="primary" id="save-lesson" ${ocrBusy?'disabled':''}>Зберегти урок</button></div></div>`);$('#lesson-name').oninput=e=>lessonName=e.target.value;$('#raw').oninput=e=>rawText=e.target.value;$('#parse').onclick=()=>{collect();const parsed=parseLines(rawText);if(!parsed.length)return alert('Не знайдено пар слів. Перевірте роздільник — між словом і перекладом.');draft.push(...parsed);renderAdd()};$('#add-row').onclick=()=>{collect();draft.push({de:'',uk:'',article:''});renderAdd()};document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{collect();draft.splice(Number(b.dataset.remove),1);renderAdd()});$('#save-lesson').onclick=()=>{collect();if(!lessonName.trim()||!draft.length||draft.some(w=>!w.de.trim()||!w.uk.trim()))return alert('Додайте назву уроку та заповніть слово і переклад у кожному рядку.');const id=uid(),now=Date.now();state.lessons.push({id,name:lessonName.trim(),updated:now});state.words.push(...draft.map(w=>({...w,de:w.de.trim(),uk:w.uk.trim(),id:uid(),lesson:id,updated:now})));selected.add(id);save();draft=[];lessonName='';rawText='';notice='';page='home';render()};$('#photos').onchange=readPhotos}
async function readPhotos(e){const files=[...e.target.files];if(!files.length)return;collect();ocrBusy=true;let worker;try{notice='Завантаження розпізнавання…';renderAdd();const {createWorker}=await import('tesseract.js');const assets=new URL(import.meta.env.BASE_URL+'ocr/',location.href).href;worker=await createWorker('deu+ukr',1,{workerPath:assets+'worker.min.js',corePath:assets+'tesseract-core-lstm.wasm.js',langPath:assets,logger:m=>{const el=$('#ocr-status');if(el)el.textContent=`Розпізнавання: ${Math.round((m.progress||0)*100)}%`}});for(let i=0;i<files.length;i++){if(files[i].size>20*1024*1024)throw Error('Фото має бути меншим за 20 МБ.');const {data}=await worker.recognize(files[i]);rawText+=(rawText?'\n':'')+data.text;notice=`Розпізнано фото: ${i+1} із ${files.length}. Виправте текст і перенесіть його в таблицю.`}}catch(err){notice='Не вдалося розпізнати фото. Перевірте інтернет або введіть слова вручну. '+(err.message||String(err))}finally{await worker?.terminate();ocrBusy=false;if(page==='add')renderAdd()}}
function renderSettings(){shell(`<div class="heading"><div><p class="eyebrow">ВАШ ПРОГРЕС ПОРУЧ</p><h1>Збереження та синхронізація</h1></div></div><div class="panel"><h2>Резервна копія</h2><p>Без підключення хмари дані зберігаються лише в цьому браузері. Очищення даних браузера видалить їх.</p><div class="actions"><button class="secondary" id="export">Завантажити копію</button><label class="secondary" for="import">Відновити з файлу</label><input id="import" type="file" accept="application/json"></div><details style="margin:20px 0;padding:12px;border:1px solid #e8b4b4;border-radius:12px"><summary style="cursor:pointer;font-weight:700">Керування уроками (видалення)</summary><p>Для безпеки кнопки видалення приховані тут. Видаляйте лише непотрібні уроки.</p><div style="display:grid;gap:9px">${state.lessons.map(l=>`<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid #eee"><span>${esc(l.name)} · ${state.words.filter(w=>w.lesson===l.id).length} слів</span><button type="button" class="secondary" data-delete-lesson="${esc(l.id)}" style="flex-shrink:0;color:#9d3333">Видалити</button></div>`).join('')}</div></details><h2>Одна гра на всіх пристроях</h2><p>Підключіть власний Supabase за інструкцією в README. На телефоні й планшеті введіть однакові адресу проєкту та публічний ключ і увійдіть в один обліковий запис. Використовуйте лише publishable / anon key, ніколи service_role.</p><form id="cloud-form"><label for="url">Supabase Project URL</label><input id="url" type="url" required value="${esc(config?.url||'')}" placeholder="https://ваш-проєкт.supabase.co"><label for="key">Публічний publishable / anon key</label><input id="key" required value="${esc(config?.key||'')}" autocomplete="off"><button class="primary">Підключити</button></form>${cloud?`<form id="auth-form"><label for="email">Email</label><input id="email" type="email" required autocomplete="email"><label for="password">Пароль (від 8 символів)</label><input id="password" type="password" minlength="8" required autocomplete="current-password"><div class="actions"><button class="primary" name="action" value="login">Увійти</button><button class="secondary" name="action" value="signup">Зареєструватися</button></div></form><div class="actions"><button id="sync" class="secondary">Синхронізувати зараз</button><button id="logout" class="secondary">Вийти з хмари</button></div>`:''}<p id="sync-status" role="status">${esc(notice||'Хмару ще не підключено.')}</p><p class="hint">Зміни синхронізуються автоматично після відповіді або збереження уроку та кожні 30 секунд, коли сторінка відкрита. Для одночасних змін одного слова діє останній запис; різні уроки об’єднуються.</p></div>`);document.querySelectorAll('[data-delete-lesson]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();const id=b.dataset.deleteLesson,l=state.lessons.find(x=>x.id===id);if(!l)return;const ws=state.words.filter(w=>w.lesson===id);if(!confirm('Видалити урок «'+l.name+'» та всі його '+ws.length+' слів? Інші уроки залишаться.'))return;state.lessons=state.lessons.filter(x=>x.id!==id);state.words=state.words.filter(w=>w.lesson!==id);ws.forEach(w=>delete state.progress[w.id]);selected.delete(id);save();render()});$('#export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='deutsch-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};$('#import').onchange=async e=>{try{const data=JSON.parse(await e.target.files[0].text());validate(data);state=mergeStates(state,data);state.lessons.forEach(l=>selected.add(l.id));save();notice='Резервну копію відновлено.';renderSettings()}catch{alert('Не вдалося прочитати резервну копію. Потрібен файл Deutsch Lernspiel.')}};$('#cloud-form').onsubmit=e=>{e.preventDefault();const url=$('#url').value.trim(),key=$('#key').value.trim();if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url))return alert('Використовуйте HTTPS-адресу проєкту supabase.co.');config={url,key};localStorage.setItem('deutsch-cloud',JSON.stringify(config));initCloud();notice='Підключено. Увійдіть або зареєструйтеся.';renderSettings()};if(cloud){$('#auth-form').onsubmit=async e=>{e.preventDefault();try{const creds={email:$('#email').value,password:$('#password').value};const signup=e.submitter.value==='signup';const {data,error}=await (signup?cloud.auth.signUp(creds):cloud.auth.signInWithPassword(creds));if(error)throw error;notice=signup&&!data.session?'Підтвердьте email за посиланням у листі, потім увійдіть.':'Вхід виконано.';await sync();renderSettings()}catch(err){notice=err.message;renderSettings()}};$('#sync').onclick=async()=>{await sync();renderSettings()};$('#logout').onclick=async()=>{await cloud.auth.signOut();notice='Ви вийшли. Локальні дані збережені.';renderSettings()}}}
function validate(s){if(!s||!Array.isArray(s.lessons)||!Array.isArray(s.words)||!s.progress||typeof s.progress!=='object'||Array.isArray(s.progress))throw Error('Некоректний формат');for(const l of s.lessons)if(typeof l.id!=='string'||typeof l.name!=='string')throw Error('Некоректний урок');for(const w of s.words)if(typeof w.id!=='string'||typeof w.lesson!=='string'||typeof w.de!=='string'||typeof w.uk!=='string'||!['','der','die','das'].includes(w.article))throw Error('Некоректне слово')}
function initCloud(){if(!config)return;cloud=createClient(config.url,config.key)}
async function sync(){if(!cloud||syncing)return;syncing=true;try{const {data:{session:auth},error:authError}=await cloud.auth.getSession();if(authError)throw authError;if(!auth){notice='Увійдіть для синхронізації.';return}const data=[];for(let offset=0;;offset+=500){const {data:batch,error}=await cloud.from('learning_records').select('payload').eq('user_id',auth.user.id).order('id').range(offset,offset+499);if(error)throw error;data.push(...batch);if(batch.length<500)break}const remote={lessons:[],words:[],progress:{}};for(const {payload:p} of data){if(p.type==='lesson')remote.lessons.push(p.value);if(p.type==='word')remote.words.push(p.value);if(p.type==='progress')remote.progress[p.id]=p.value}const merged=mergeStates(state,remote);validate(merged);state=merged;localStorage.setItem('deutsch-state',JSON.stringify(state));const records=[...state.lessons.map(v=>({id:'lesson:'+v.id,payload:{type:'lesson',value:v}})),...state.words.map(v=>({id:'word:'+v.id,payload:{type:'word',value:v}})),...Object.entries(state.progress).map(([id,v])=>({id:'progress:'+id,payload:{type:'progress',id,value:v}}))].map(v=>({...v,user_id:auth.user.id}));for(let offset=0;offset<records.length;offset+=500){const {error:writeError}=await cloud.from('learning_records').upsert(records.slice(offset,offset+500),{onConflict:'user_id,id'});if(writeError)throw writeError;}notice='Синхронізовано · '+new Date().toLocaleTimeString('uk-UA')}catch(err){notice='Синхронізація не виконана: '+err.message+'. Локальні дані залишаються на пристрої.'}finally{syncing=false;const el=$('#sync-status');if(el)el.textContent=notice}}
try{initCloud()}catch{notice='Перевірте параметри Supabase.'}setInterval(sync,30000);window.addEventListener('online',sync);render();sync();
