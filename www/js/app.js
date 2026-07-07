/* ============================================================
   تطبيق إدارة الخياطة الرجالية الحديثة — أزرار
   Capacitor + Vanilla JS — يعمل دون اتصال بالإنترنت
   ============================================================ */

/* ===== التخزين ===== */
const DB = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v === null || v === undefined ? d : v; } catch (e) { return d; } },
  set(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
};

let customers = DB.get('ts_customers', []);
let invoices  = DB.get('ts_invoices', []);
let suppliers = DB.get('ts_suppliers', []);
let expenses  = DB.get('ts_expenses', []);
let settings  = Object.assign({
  password: '0000',
  rateUSD: 535,   // 1 دولار = كم ريال يمني (قابل للتعديل)
  rateSAR: 140,   // 1 ريال سعودي = كم ريال يمني (قابل للتعديل)
  shopName: 'أزرار',
  shopPhone: '',
  shopAddr: '',
  logo: 'assets/logo.png', waQR: '', igQR: ''
}, DB.get('ts_settings', {}));

const saveCustomers = () => DB.set('ts_customers', customers);
const saveInvoices  = () => DB.set('ts_invoices', invoices);
const saveSuppliers = () => DB.set('ts_suppliers', suppliers);
const saveExpenses  = () => DB.set('ts_expenses', expenses);
const saveSettingsDB = () => DB.set('ts_settings', settings);

/* ===== أدوات عامة ===== */
const $  = id => document.getElementById(id);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DAYS = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
const CURR_NAME = { SAR: 'ريال سعودي', YER: 'ريال يمني', USD: 'دولار أمريكي' };
const CURR_SYM  = { SAR: 'ر.س', YER: 'ر.ي', USD: '$' };

function todayISO() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
function fmtDate(iso) { if (!iso) return '—'; const [y,m,d] = iso.split('-'); return `${d}/${m}/${y}`; }
function dayName(iso) { if (!iso) return '—'; return DAYS[new Date(iso + 'T12:00:00').getDay()]; }
function money(n, curr) { const v = Number(n || 0); return v.toLocaleString('en-US', {maximumFractionDigits: 2}) + ' ' + (CURR_SYM[curr || 'YER']); }
function toYER(amount, curr) {
  const v = Number(amount || 0);
  if (curr === 'USD') return v * Number(settings.rateUSD || 535);
  if (curr === 'SAR') return v * Number(settings.rateSAR || 140);
  return v;
}
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.style.display = 'block';
  clearTimeout(t._h); t._h = setTimeout(() => t.style.display = 'none', 2400);
}
function isCap() { return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); }
function plugin(name) { return (window.Capacitor && window.Capacitor.Plugins) ? window.Capacitor.Plugins[name] : null; }


/* ===== أيقونات SVG ===== */
const svgUse = (id, style) => `<svg class="sv"${style ? ` style="${style}"` : ''}><use href="#${id}"></use></svg>`;
const emptyState = (icon, text) => `<div class="empty"><div class="big"><svg><use href="#${icon}"></use></svg></div>${text}</div>`;

/* ===== التنقل ===== */
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  $(id).classList.add('active');
  document.querySelectorAll('.bottom-nav button').forEach(b => b.classList.toggle('active', b.dataset.page === id));
  window.scrollTo(0, 0);
}
function navTo(btn) {
  const id = btn.dataset.page;
  showPage(id);
  if (id === 'page-dashboard') renderDashboard();
  if (id === 'page-invoices') renderInvoices();
  if (id === 'page-customers') renderCustomers();
  if (id === 'page-suppliers') renderSuppliers();
}
function closeModal(id) { $(id).classList.remove('open'); }
function openModal(id) { $(id).classList.add('open'); }
document.querySelectorAll('.modal-back').forEach(m => m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); }));

/* ===== محرك أزرار الاختيار (chips) ===== */
function initChips(containerId, opts = {}) {
  const box = $(containerId); if (!box) return;
  const multi = box.classList.contains('multi');
  const max = Number(box.dataset.max || 99);
  box.querySelectorAll('.chip').forEach(ch => {
    ch.addEventListener('click', () => {
      if (multi) {
        if (ch.classList.contains('selected')) ch.classList.remove('selected');
        else {
          const sel = box.querySelectorAll('.chip.selected');
          if (sel.length >= max) { toast(`يسمح باختيار ${max === 2 ? 'خيارين' : max + ' خيارات'} كحد أقصى`); return; }
          ch.classList.add('selected');
        }
      } else {
        box.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
        ch.classList.add('selected');
      }
      if (opts.onChange) opts.onChange(chipValues(containerId));
    });
  });
}
function chipValues(containerId) {
  return Array.from($(containerId).querySelectorAll('.chip.selected')).map(c => c.dataset.v);
}
function chipValue(containerId) { const v = chipValues(containerId); return v.length ? v[0] : ''; }
function setChips(containerId, values) {
  const vals = Array.isArray(values) ? values : (values ? [values] : []);
  $(containerId).querySelectorAll('.chip').forEach(c => c.classList.toggle('selected', vals.includes(c.dataset.v)));
}
function clearChips(containerId) { setChips(containerId, []); }

/* ===== كلمة المرور ===== */
let unlocked = false;
let passTarget = null;
function askPassword(target) {
  passTarget = target;
  $('passInput').value = '';
  openModal('mdlPass');
  setTimeout(() => $('passInput').focus(), 150);
}
function checkPassword() {
  if ($('passInput').value === settings.password) {
    unlocked = true;
    closeModal('mdlPass');
    toast('✓ تم فتح القسم المحمي');
    if (passTarget === 'dashboard') renderDashboard();
    if (passTarget === 'accounts') { showPage('page-accounts'); renderAccounts(); }
  } else {
    toast('✗ كلمة المرور غير صحيحة');
    $('passInput').value = '';
  }
}
$('passInput').addEventListener('keydown', e => { if (e.key === 'Enter') checkPassword(); });
function changePassword() {
  if ($('setPassOld').value !== settings.password) { toast('✗ كلمة المرور الحالية غير صحيحة'); return; }
  const nw = $('setPassNew').value.trim();
  if (!nw) { toast('أدخل كلمة المرور الجديدة'); return; }
  settings.password = nw;
  settings.updatedAt = Date.now();
  queuePush('settings', 'main');
  saveSettingsDB();
  $('setPassOld').value = ''; $('setPassNew').value = '';
  toast('✓ تم تغيير كلمة المرور');
}

/* ===== لوحة التحكم ===== */
function invRemaining(inv) { return Math.max(0, Number(inv.price || 0) - Number(inv.paid || 0)); }

function renderDashboard() {
  $('todayLabel').textContent = dayName(todayISO()) + ' ' + fmtDate(todayISO());
  const today = todayISO();
  const month = today.slice(0, 7);

  const underWork = invoices.filter(i => i.state === 'تحت التنفيذ').length;
  const ready = invoices.filter(i => i.state === 'جاهز').length;
  const todayInv = invoices.filter(i => i.date === today).length;

  $('heroPills').innerHTML = [
    { n: todayInv, l: 'فواتير اليوم' },
    { n: underWork, l: 'تحت التنفيذ' },
    { n: ready, l: 'جاهز للتسليم' },
  ].map(p => `<div class="h-pill"><div class="n">${p.n}</div><div class="l">${p.l}</div></div>`).join('');

  const counts = [
    { n: customers.length, l: 'عدد العملاء', ic: 'i-users' },
    { n: invoices.filter(i => i.state !== 'تم التسليم').length, l: 'الطلبات الحالية', ic: 'i-receipt' },
    { n: invoices.filter(i => i.state === 'تم التسليم').length, l: 'تم التسليم', ic: 'i-shirt' },
    { n: invoices.filter(i => (i.date || '').startsWith(month)).length, l: 'فواتير الشهر', ic: 'i-chart' },
    { n: customers.filter(isVip).length, l: 'عملاء مميزون', ic: 'i-gift', gold: true },
    { n: suppliers.length, l: 'عدد الموردين', ic: 'i-truck' },
  ];
  $('dashCounts').innerHTML = counts.map(c =>
    `<div class="stat${c.gold ? ' gold' : ''}"><div class="ic">${svgUse(c.ic)}</div><div><div class="num">${c.n}</div><div class="lbl">${c.l}</div></div></div>`).join('');

  // المالية
  if (unlocked) {
    $('dashFinanceLock').style.display = 'none';
    const revenue = invoices.reduce((s, i) => s + toYER(i.paid, i.currency), 0);
    const expTotal = expenses.reduce((s, e) => s + Number(e.amount || 0), 0)
                   + suppliers.reduce((s, sp) => s + (sp.tx || []).filter(t => t.type === 'دفعة').reduce((a, t) => a + Number(t.amount || 0), 0), 0);
    const remaining = invoices.reduce((s, i) => s + toYER(invRemaining(i), i.currency), 0);
    $('dashFinance').style.display = '';
    $('dashFinance').innerHTML = `
      <div class="stat gold"><div class="ic">${svgUse('i-coins')}</div><div><div class="num">${money(revenue)}</div><div class="lbl">الإيرادات المحصلة</div></div></div>
      <div class="stat"><div class="ic">${svgUse('i-cash')}</div><div><div class="num">${money(expTotal)}</div><div class="lbl">المصروفات</div></div></div>
      <div class="stat gold"><div class="ic">${svgUse('i-wallet')}</div><div><div class="num">${money(revenue - expTotal)}</div><div class="lbl">صافي الأرباح</div></div></div>
      <div class="stat"><div class="ic">${svgUse('i-receipt')}</div><div><div class="num">${money(remaining)}</div><div class="lbl">متبقٍ لدى العملاء</div></div></div>`;
  } else {
    $('dashFinanceLock').style.display = '';
    $('dashFinance').style.display = 'none';
  }

  // التنبيهات الذكية
  const alerts = [];
  invoices.filter(i => i.state !== 'تم التسليم' && invRemaining(i) > 0).forEach(i => {
    alerts.push({ c: 'warn', t: `💰 مبلغ متبقٍ على العميل ${esc(i.customerName)}: ${money(invRemaining(i), i.currency)} (فاتورة #${i.number})` });
  });
  invoices.filter(i => i.state !== 'تم التسليم' && i.delivery).forEach(i => {
    const diff = Math.floor((new Date(i.delivery + 'T12:00') - new Date(today + 'T12:00')) / 86400000);
    if (diff < 0) alerts.push({ c: 'danger', t: `⏰ تأخر موعد تسليم فاتورة #${i.number} — ${esc(i.customerName)} (${fmtDate(i.delivery)})` });
    else if (diff <= 2) alerts.push({ c: 'warn', t: `📅 اقترب موعد تسليم فاتورة #${i.number} — ${esc(i.customerName)} (${diff === 0 ? 'اليوم' : diff === 1 ? 'غداً' : 'بعد يومين'})` });
  });
  suppliers.forEach(sp => {
    const due = supplierDue(sp);
    if (due > 0) alerts.push({ c: 'warn', t: `🚚 مستحقات للمورد ${esc(sp.name)}: ${money(due)}` });
  });
  customers.forEach(c => {
    if ((Number(c.thobeCount || 0) % 10) === 9) alerts.push({ c: 'gold', t: `🎁 العميل ${esc(c.name)} يستحق الثوب المجاني في الطلب القادم!` });
  });

  $('dashAlerts').innerHTML = alerts.length
    ? alerts.map(a => `<div class="alert-item ${a.c}"><span>${a.t}</span></div>`).join('')
    : emptyState('i-shirt', 'كل شيء تحت السيطرة — لا توجد تنبيهات حالياً');
}

/* ============================================================
   العملاء
   ============================================================ */
let custVipOnly = false;
let editCustId = null;

function isVip(c) { return Number(c.thobeCount || 0) >= 9 || Number(c.freeEarned || 0) > 0; }

function openCustomerForm(id) {
  editCustId = id || null;
  $('custFormTitle').firstChild.textContent = id ? 'تعديل بيانات العميل ' : 'عميل جديد ';
  const c = id ? customers.find(x => x.id === id) : null;
  $('cName').value = c ? c.name : '';
  $('cPhone').value = c ? c.phone : '';
  $('cCity').value = c ? (c.city || '') : '';
  $('cAddress').value = c ? (c.address || '') : '';
  $('cNotes').value = c ? (c.notes || '') : '';
  openModal('mdlCustomer');
}

function saveCustomer() {
  const name = $('cName').value.trim();
  if (!name) { toast('أدخل اسم العميل'); return; }
  const data = {
    name, phone: $('cPhone').value.trim(),
    city: $('cCity').value.trim(), address: $('cAddress').value.trim(), notes: $('cNotes').value.trim()
  };
  let rec;
  if (editCustId) {
    rec = customers.find(x => x.id === editCustId);
    Object.assign(rec, data);
  } else {
    rec = Object.assign({ id: uid(), thobeCount: 0, freeEarned: 0, measurements: null, createdAt: todayISO() }, data);
    customers.push(rec);
  }
  touchRec(rec); queuePush('customer', rec.id);
  saveCustomers(); closeModal('mdlCustomer'); renderCustomers(); toast('✓ تم حفظ العميل');
}

function deleteCustomer(id) {
  if (!confirm('هل أنت متأكد من حذف هذا العميل؟')) return;
  customers = customers.filter(c => c.id !== id);
  queueDelete('customer', id);
  saveCustomers(); renderCustomers(); toast('تم حذف العميل');
}

function useFreeThobe(id) {
  const c = customers.find(x => x.id === id); if (!c) return;
  if ((Number(c.thobeCount || 0) % 10) !== 9) { toast('لم يكتمل العدد بعد'); return; }
  if (!confirm(`تأكيد استخدام الثوب المجاني للعميل ${c.name}؟`)) return;
  c.thobeCount = 0;
  c.freeEarned = Number(c.freeEarned || 0) + 1;
  touchRec(c); queuePush('customer', c.id);
  saveCustomers(); renderCustomers(); renderDashboard();
  toast('🎁 تم تسجيل الثوب المجاني — مبروك للعميل!');
}

function customerLastInvoice(custId) {
  const list = invoices.filter(i => i.customerId === custId).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return list[0] || null;
}

function renderCustomers() {
  const q = ($('custSearch').value || '').trim();
  let list = customers.slice().reverse();
  if (custVipOnly) list = list.filter(isVip);
  if (q) list = list.filter(c => (c.name || '').includes(q) || (c.phone || '').includes(q));

  $('custList2').innerHTML = list.length ? list.map(c => {
    const cnt = Number(c.thobeCount || 0) % 10;
    const dots = Array.from({ length: 9 }, (_, i) => `<span class="${i < cnt ? 'done' : ''}">${i + 1}</span>`).join('') +
                 `<span class="${cnt === 9 ? 'done' : ''}" style="border-color:var(--brown)">🎁</span>`;
    const vip = isVip(c) ? `<span class="badge gold">⭐ مميز</span>` : '';
    const free = (cnt === 9) ? `<button class="btn sm gold" onclick="useFreeThobe('${c.id}')">🎁 استخدام الثوب المجاني</button>` : '';
    const last = customerLastInvoice(c.id);
    return `<div class="list-item">
      <div class="li-head">
        <div><div class="li-name">👤 ${esc(c.name)} ${vip}</div>
        <div class="li-sub">📱 ${esc(c.phone || '—')} ${c.city ? ' | 🏙️ ' + esc(c.city) : ''}${c.address ? ' | 📍 ' + esc(c.address) : ''}</div>
        ${c.notes ? `<div class="li-sub">📝 ${esc(c.notes)}</div>` : ''}</div>
      </div>
      <div class="li-sub" style="margin-top:6px">عداد الأثواب (${cnt}/9 — العاشر مجاناً):</div>
      <div class="counter-thobe">${dots}</div>
      <div class="li-actions">
        <button class="btn sm" onclick="openInvoiceForm(null,'${c.id}')">🧾 فاتورة جديدة</button>
        ${last ? `<button class="btn sm cream" onclick="copyLastInvoice('${c.id}')">📋 نسخ آخر فاتورة</button>` : ''}
        <button class="btn sm outline" onclick="openCustomerForm('${c.id}')">✏️ تعديل</button>
        ${free}
        <button class="btn sm danger" onclick="deleteCustomer('${c.id}')">🗑️</button>
      </div>
    </div>`;
  }).join('') : emptyState('i-users', `لا يوجد عملاء${q ? ' مطابقون للبحث' : ''} — أضف أول عميل بزر «عميل جديد»`);
}

/* ===== جهات الاتصال (Capacitor) ===== */
async function pickContactInto(nameEl, phoneEl) {
  const Contacts = plugin('Contacts');
  if (!Contacts) { toast('اختيار جهات الاتصال متاح داخل التطبيق على الجوال'); return; }
  try {
    const res = await Contacts.pickContact({ projection: { name: true, phones: true } });
    const c = res && res.contact;
    if (!c) return;
    if (c.name && c.name.display) nameEl.value = c.name.display;
    if (c.phones && c.phones.length) phoneEl.value = (c.phones[0].number || '').replace(/\s+/g, '');
    if (nameEl.id === 'fCustName') onCustomerTyped();
  } catch (e) { toast('لم يتم اختيار جهة اتصال'); }
}
function pickFromContacts() { pickContactInto($('fCustName'), $('fCustPhone')); }
function pickFromContactsCustomer() { pickContactInto($('cName'), $('cPhone')); }

/* ============================================================
   الموردون
   ============================================================ */
let editSupId = null;
let supTxSupId = null;

function supplierDue(sp) {
  const tx = sp.tx || [];
  const buy = tx.filter(t => t.type === 'شراء').reduce((s, t) => s + Number(t.amount || 0), 0);
  const pay = tx.filter(t => t.type === 'دفعة').reduce((s, t) => s + Number(t.amount || 0), 0);
  return buy - pay;
}

function openSupplierForm(id) {
  editSupId = id || null;
  $('supFormTitle').firstChild.textContent = id ? 'تعديل بيانات المورد ' : 'مورد جديد ';
  const s = id ? suppliers.find(x => x.id === id) : null;
  $('sName').value = s ? s.name : '';
  $('sOrg').value = s ? (s.org || '') : '';
  $('sPhone').value = s ? (s.phone || '') : '';
  $('sNotes').value = s ? (s.notes || '') : '';
  openModal('mdlSupplier');
}

function saveSupplier() {
  const name = $('sName').value.trim();
  if (!name) { toast('أدخل اسم المورد'); return; }
  const data = { name, org: $('sOrg').value.trim(), phone: $('sPhone').value.trim(), notes: $('sNotes').value.trim() };
  let rec;
  if (editSupId) { rec = suppliers.find(x => x.id === editSupId); Object.assign(rec, data); }
  else { rec = Object.assign({ id: uid(), tx: [], createdAt: todayISO() }, data); suppliers.push(rec); }
  touchRec(rec); queuePush('supplier', rec.id);
  saveSuppliers(); closeModal('mdlSupplier'); renderSuppliers(); toast('✓ تم حفظ المورد');
}

function deleteSupplier(id) {
  if (!confirm('هل أنت متأكد من حذف هذا المورد وسجل عملياته؟')) return;
  suppliers = suppliers.filter(s => s.id !== id);
  queueDelete('supplier', id);
  saveSuppliers(); renderSuppliers(); toast('تم حذف المورد');
}

function openSupTx(id) {
  supTxSupId = id;
  const sp = suppliers.find(x => x.id === id);
  $('supTxTitle').firstChild.textContent = 'عملية جديدة — ' + sp.name + ' ';
  $('stDesc').value = ''; $('stAmount').value = '';
  setChips('supTxType', 'شراء');
  openModal('mdlSupTx');
}

function saveSupTx() {
  const sp = suppliers.find(x => x.id === supTxSupId); if (!sp) return;
  const amount = Number($('stAmount').value || 0);
  if (amount <= 0) { toast('أدخل المبلغ'); return; }
  sp.tx = sp.tx || [];
  sp.tx.push({ id: uid(), type: chipValue('supTxType') || 'شراء', desc: $('stDesc').value.trim(), amount, date: todayISO() });
  touchRec(sp); queuePush('supplier', sp.id);
  saveSuppliers(); closeModal('mdlSupTx'); renderSuppliers(); toast('✓ تم حفظ العملية');
}

function toggleSupLog(id) {
  const el = $('suplog-' + id);
  el.style.display = el.style.display === 'none' ? '' : 'none';
}

function renderSuppliers() {
  $('supList').innerHTML = suppliers.length ? suppliers.slice().reverse().map(sp => {
    const tx = sp.tx || [];
    const buy = tx.filter(t => t.type === 'شراء').reduce((s, t) => s + Number(t.amount || 0), 0);
    const pay = tx.filter(t => t.type === 'دفعة').reduce((s, t) => s + Number(t.amount || 0), 0);
    const due = buy - pay;
    const log = tx.slice().reverse().map(t =>
      `<tr><td>${fmtDate(t.date)}</td><td>${t.type === 'شراء' ? '🛒 شراء' : '💵 دفعة'}</td><td>${esc(t.desc || '—')}</td><td>${money(t.amount)}</td></tr>`).join('');
    return `<div class="list-item">
      <div class="li-head">
        <div><div class="li-name">🚚 ${esc(sp.name)}</div>
        <div class="li-sub">${sp.org ? '🏢 ' + esc(sp.org) + ' | ' : ''}📱 ${esc(sp.phone || '—')}</div>
        ${sp.notes ? `<div class="li-sub">📝 ${esc(sp.notes)}</div>` : ''}</div>
        ${due > 0 ? `<span class="badge danger">مستحق: ${money(due)}</span>` : `<span class="badge ok">مسدد ✓</span>`}
      </div>
      <div class="li-sub" style="margin-top:6px">إجمالي المشتريات: <b>${money(buy)}</b> | المدفوع: <b>${money(pay)}</b> | المتبقي: <b>${money(due)}</b></div>
      <div class="li-actions">
        <button class="btn sm" onclick="openSupTx('${sp.id}')">+ عملية</button>
        <button class="btn sm cream" onclick="toggleSupLog('${sp.id}')">📜 سجل العمليات</button>
        <button class="btn sm outline" onclick="openSupplierForm('${sp.id}')">✏️ تعديل</button>
        <button class="btn sm danger" onclick="deleteSupplier('${sp.id}')">🗑️</button>
      </div>
      <div id="suplog-${sp.id}" style="display:none;margin-top:10px;overflow-x:auto">
        ${tx.length ? `<table class="tbl"><tr><th>التاريخ</th><th>النوع</th><th>الوصف</th><th>المبلغ</th></tr>${log}</table>` : '<div class="empty">لا توجد عمليات بعد</div>'}
      </div>
    </div>`;
  }).join('') : emptyState('i-truck', 'لا يوجد موردون — أضف أول مورد بزر «مورد جديد»');
}

/* ============================================================
   نموذج الفاتورة
   ============================================================ */
const MEAS_FIELDS = ['الطول', 'الكتف', 'طول اليد', 'الوسع', 'الرقبة', 'عرض اليد', 'الخطوة'];
const FRACS = ['—', '1/4', '1/2', '3/4'];
let editInvId = null;
let fabricImgData = '';

/* بناء صفوف القياسات */
function buildMeasRows() {
  $('measRows').innerHTML = MEAS_FIELDS.map((m, i) => `
    <div class="meas-row">
      <div class="m-lbl">${i + 1}. ${m}</div>
      <input type="number" step="0.5" inputmode="decimal" id="meas-v-${i}" placeholder="0">
      <div class="frac" id="meas-f-${i}">
        ${FRACS.map((f, j) => `<button type="button" class="${j === 0 ? 'on' : ''}" data-f="${f}" onclick="setFrac(${i},this)">${f === '—' ? '—' : f}</button>`).join('')}
      </div>
    </div>`).join('');
}
function setFrac(i, btn) {
  $('meas-f-' + i).querySelectorAll('button').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
}
function getMeasurements() {
  const out = {};
  MEAS_FIELDS.forEach((m, i) => {
    const v = $('meas-v-' + i).value;
    const f = $('meas-f-' + i).querySelector('button.on').dataset.f;
    out[m] = { v: v === '' ? '' : Number(v), f: f === '—' ? '' : f };
  });
  return out;
}
function setMeasurements(meas) {
  MEAS_FIELDS.forEach((m, i) => {
    const d = (meas && meas[m]) || { v: '', f: '' };
    $('meas-v-' + i).value = d.v === '' || d.v == null ? '' : d.v;
    const target = d.f || '—';
    $('meas-f-' + i).querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.f === target));
  });
}
function measText(d) {
  if (!d || (d.v === '' && !d.f)) return '—';
  return (d.v === '' ? '' : d.v) + (d.f ? ' ' + d.f : '');
}

/* ربط العميل المكتوب */
function refreshCustDatalist() {
  $('custList').innerHTML = customers.map(c => `<option value="${esc(c.name)}">${esc(c.phone || '')}</option>`).join('');
}
function findCustomerByName(name) { return customers.find(c => c.name === name); }

function onCustomerTyped() {
  const c = findCustomerByName($('fCustName').value.trim());
  if (c) {
    if (!$('fCustPhone').value) $('fCustPhone').value = c.phone || '';
    $('custHint').textContent = '✓ عميل مسجل — عدد الأثواب: ' + (Number(c.thobeCount || 0) % 10) + '/9';
    if (c.measurements && !editInvId) {
      setMeasurements(c.measurements);
      $('measHint').textContent = '✓ تم استرجاع آخر قياسات العميل تلقائياً — يمكنك تعديلها';
    }
  } else {
    $('custHint').textContent = $('fCustName').value.trim() ? 'عميل جديد — سيتم حفظه تلقائياً مع الفاتورة' : '';
  }
}

/* فتح النموذج */
function nextInvoiceNumber() {
  const n = Number(DB.get('ts_counter', 0)) + 1;
  return String(n).padStart(4, '0');
}

function resetInvoiceForm() {
  editInvId = null; fabricImgData = '';
  $('invFormTitle').textContent = 'فاتورة جديدة';
  $('fNumber').textContent = nextInvoiceNumber();
  $('fDate').textContent = fmtDate(todayISO());
  $('fDay').textContent = dayName(todayISO());
  $('fDelivery').value = '';
  $('fCustName').value = ''; $('fCustPhone').value = '';
  $('custHint').textContent = ''; $('measHint').textContent = '';
  clearChips('cutTypeChips'); $('fCutOther').style.display = 'none'; $('fCutOther').value = '';
  $('fPrice').value = ''; $('fPaid').value = ''; calcPay();
  setChips('currChips', 'SAR');
  setMeasurements(null);
  clearChips('neckMain'); $('neckQallab').style.display = 'none'; $('neckSada').style.display = 'none';
  clearChips('neckQallabStyle'); clearChips('neckQallabSize'); clearChips('neckSadaOpts');
  clearChips('pocketOpts'); clearChips('sleeveOpts'); $('kabkBlock').style.display = 'none'; clearChips('kabkOpts');
  clearChips('jabzButtons'); clearChips('jabzShara');
  $('fFabricType').value = ''; $('fFabricColor').value = ''; $('fNotes').value = '';
  $('fFabricImg').value = ''; $('fabricPreview').style.display = 'none'; $('fabricRemove').style.display = 'none';
}

function openInvoiceForm(invId, custId) {
  refreshCustDatalist();
  resetInvoiceForm();
  if (custId) {
    const c = customers.find(x => x.id === custId);
    if (c) { $('fCustName').value = c.name; $('fCustPhone').value = c.phone || ''; onCustomerTyped(); }
  }
  if (invId) loadInvoiceIntoForm(invId);
  showPage('page-invoice-form');
}

function loadInvoiceIntoForm(invId, asCopy) {
  const inv = invoices.find(i => i.id === invId); if (!inv) return;
  if (!asCopy) {
    editInvId = invId;
    $('invFormTitle').textContent = 'تعديل فاتورة #' + inv.number;
    $('fNumber').textContent = inv.number;
    $('fDate').textContent = fmtDate(inv.date);
    $('fDay').textContent = inv.day;
  }
  $('fDelivery').value = asCopy ? '' : (inv.delivery || '');
  $('fCustName').value = inv.customerName; $('fCustPhone').value = inv.phone || '';
  const known = ['سعودي', 'قطري', 'إماراتي'];
  if (known.includes(inv.cutType)) setChips('cutTypeChips', inv.cutType);
  else if (inv.cutType) { setChips('cutTypeChips', 'أخرى'); $('fCutOther').style.display = ''; $('fCutOther').value = inv.cutType; }
  $('fPrice').value = inv.price || ''; $('fPaid').value = asCopy ? '' : (inv.paid || ''); calcPay();
  setChips('currChips', inv.currency || 'SAR');
  setMeasurements(inv.measurements);
  const d = inv.details || {};
  if (d.neckMain) {
    setChips('neckMain', d.neckMain);
    if (d.neckMain === 'قلاب') {
      $('neckQallab').style.display = '';
      setChips('neckQallabStyle', d.neckStyle || []);
      setChips('neckQallabSize', d.neckSize || []);
    } else {
      $('neckSada').style.display = '';
      setChips('neckSadaOpts', d.neckSada || []);
    }
  }
  setChips('pocketOpts', d.pocket || []);
  if (d.sleeve) {
    setChips('sleeveOpts', d.sleeve);
    if (d.sleeve === 'كبك') { $('kabkBlock').style.display = ''; setChips('kabkOpts', d.kabk || []); }
  }
  setChips('jabzButtons', d.jabzButtons || []);
  setChips('jabzShara', d.jabzShara || []);
  $('fFabricType').value = inv.fabricType || ''; $('fFabricColor').value = inv.fabricColor || '';
  $('fNotes').value = inv.notes || '';
  fabricImgData = inv.fabricImage || '';
  if (fabricImgData) { $('fabricPreview').src = fabricImgData; $('fabricPreview').style.display = ''; $('fabricRemove').style.display = ''; }
}

function copyLastInvoice(custId) {
  const last = customerLastInvoice(custId); if (!last) { toast('لا توجد فاتورة سابقة'); return; }
  refreshCustDatalist(); resetInvoiceForm();
  loadInvoiceIntoForm(last.id, true);
  $('measHint').textContent = '✓ تم نسخ بيانات آخر فاتورة للعميل';
  showPage('page-invoice-form');
  toast('📋 تم نسخ آخر فاتورة — عدّل ما يلزم واحفظ');
}

/* الدفع */
function calcPay() {
  const price = Number($('fPrice').value || 0);
  const paid = Number($('fPaid').value || 0);
  const remain = Math.max(0, price - paid);
  $('fRemain').textContent = remain.toLocaleString('en-US');
  $('fPayStatus').textContent = price <= 0 ? '—' : (remain <= 0 ? '✓ مدفوع بالكامل' : (paid > 0 ? 'مدفوع جزئياً' : 'غير مدفوع'));
}

/* صورة القماش */
function loadFabricImg(input) {
  const f = input.files && input.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    fabricImgData = r.result;
    $('fabricPreview').src = fabricImgData; $('fabricPreview').style.display = '';
    $('fabricRemove').style.display = '';
  };
  r.readAsDataURL(f);
}
function removeFabricImg() {
  fabricImgData = ''; $('fFabricImg').value = '';
  $('fabricPreview').style.display = 'none'; $('fabricRemove').style.display = 'none';
}

/* حفظ الفاتورة */
function saveInvoice() {
  const name = $('fCustName').value.trim();
  if (!name) { toast('أدخل اسم العميل'); window.scrollTo(0, 0); return; }
  const phone = $('fCustPhone').value.trim();

  // العميل: موجود أو جديد
  let cust = findCustomerByName(name) || (phone ? customers.find(c => c.phone === phone) : null);
  const isNewInvoice = !editInvId;
  if (!cust) {
    cust = { id: uid(), name, phone, city: '', address: '', notes: '', thobeCount: 0, freeEarned: 0, measurements: null, createdAt: todayISO() };
    customers.push(cust);
  } else if (phone && !cust.phone) cust.phone = phone;

  const meas = getMeasurements();
  cust.measurements = meas; // حفظ آخر القياسات تلقائياً

  let cutType = chipValue('cutTypeChips');
  if (cutType === 'أخرى') cutType = $('fCutOther').value.trim() || 'أخرى';

  const details = {
    neckMain: chipValue('neckMain'),
    neckStyle: chipValue('neckQallabStyle'),
    neckSize: chipValue('neckQallabSize'),
    neckSada: chipValues('neckSadaOpts'),
    pocket: chipValues('pocketOpts'),
    sleeve: chipValue('sleeveOpts'),
    kabk: chipValues('kabkOpts'),
    jabzButtons: chipValue('jabzButtons'),
    jabzShara: chipValue('jabzShara')
  };

  const base = {
    delivery: $('fDelivery').value,
    customerId: cust.id, customerName: cust.name, phone: cust.phone || phone,
    cutType,
    price: Number($('fPrice').value || 0), paid: Number($('fPaid').value || 0),
    currency: chipValue('currChips') || 'SAR',
    measurements: meas, details,
    fabricType: $('fFabricType').value.trim(), fabricColor: $('fFabricColor').value.trim(),
    fabricImage: fabricImgData, notes: $('fNotes').value.trim()
  };

  let inv;
  if (editInvId) {
    inv = invoices.find(i => i.id === editInvId);
    Object.assign(inv, base);
  } else {
    const num = nextInvoiceNumber();
    DB.set('ts_counter', Number(DB.get('ts_counter', 0)) + 1);
    inv = Object.assign({
      id: uid(), number: num, date: todayISO(), day: dayName(todayISO()),
      state: 'تحت التنفيذ', createdAt: Date.now()
    }, base);
    invoices.push(inv);
    cust.thobeCount = Number(cust.thobeCount || 0) + 1; // عداد الأثواب
  }

  touchRec(inv); touchRec(cust);
  queuePush('invoice', inv.id); queuePush('customer', cust.id); queuePush('meta', 'counter');
  saveCustomers(); saveInvoices();
  toast('✓ تم حفظ الفاتورة #' + inv.number);
  showPage('page-invoices'); renderInvoices();
  openInvoiceView(inv.id);
  if (isNewInvoice && (Number(cust.thobeCount || 0) % 10) === 9) {
    setTimeout(() => toast('🎁 تنبيه: العميل ' + cust.name + ' يستحق الثوب المجاني في الطلب القادم!'), 2600);
  }
}

/* ============================================================
   قائمة الفواتير وعرضها
   ============================================================ */
let invFilter = 'الكل';
let currentInvId = null;

function setInvFilter(btn) {
  invFilter = btn.dataset.f;
  $('invFilterChips').querySelectorAll('.chip').forEach(c => c.classList.toggle('selected', c === btn));
  renderInvoices();
}

function stateBadge(st) {
  if (st === 'تم التسليم') return '<span class="badge ok">✓ تم التسليم</span>';
  if (st === 'جاهز') return '<span class="badge gold">👌 جاهز</span>';
  return '<span class="badge warn">⏳ تحت التنفيذ</span>';
}

function renderInvoices() {
  const q = ($('invSearch').value || '').trim();
  let list = invoices.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  if (invFilter !== 'الكل') list = list.filter(i => i.state === invFilter);
  if (q) list = list.filter(i => (i.customerName || '').includes(q) || (i.phone || '').includes(q) || (i.number || '').includes(q));

  $('invList').innerHTML = list.length ? list.map(i => {
    const rem = invRemaining(i);
    return `<div class="list-item" onclick="openInvoiceView('${i.id}')" style="cursor:pointer">
      <div class="li-head">
        <div><div class="li-name">🧾 #${i.number} — ${esc(i.customerName)}</div>
        <div class="li-sub">📅 ${fmtDate(i.date)} (${i.day}) ${i.delivery ? ' | 🚚 التسليم: ' + fmtDate(i.delivery) : ''}</div>
        <div class="li-sub">${i.cutType ? '✂️ ' + esc(i.cutType) + ' | ' : ''}💰 ${money(i.price, i.currency)}${rem > 0 ? ` | <b style="color:var(--danger)">متبقي: ${money(rem, i.currency)}</b>` : ' | مدفوع ✓'}</div></div>
        ${stateBadge(i.state)}
      </div>
    </div>`;
  }).join('') : emptyState('i-spool', `لا توجد فواتير${q ? ' مطابقة للبحث' : ''} — ابدأ بزر «+ فاتورة»`);
}

function openInvoiceView(id) {
  currentInvId = id;
  const inv = invoices.find(i => i.id === id); if (!inv) return;
  const paper = buildInvoiceHTML(inv, { size: 'A5', orient: 'portrait', content: 'full' });
  paper.style.transform = 'scale(0.6)';
  paper.style.transformOrigin = 'top center';
  const holder = $('invView'); holder.innerHTML = ''; holder.appendChild(paper);
  holder.style.height = (paper.offsetHeight * 0.6 + 30) + 'px';
  setTimeout(() => { holder.style.height = (paper.offsetHeight * 0.6 + 30) + 'px'; }, 60);

  $('invStateChips').innerHTML = ['تحت التنفيذ', 'جاهز', 'تم التسليم'].map(st =>
    `<button class="chip ${inv.state === st ? 'selected' : ''}" onclick="setInvoiceState('${id}','${st}')">${st}</button>`).join('');
  openModal('mdlInvoice');
}

function setInvoiceState(id, st) {
  const inv = invoices.find(i => i.id === id); if (!inv) return;
  inv.state = st;
  touchRec(inv); queuePush('invoice', inv.id);
  saveInvoices();
  openInvoiceView(id); renderInvoices();
  toast('✓ حالة الفاتورة: ' + st);
}

function editCurrentInvoice() { closeModal('mdlInvoice'); openInvoiceForm(currentInvId); }

function deleteCurrentInvoice() {
  if (!confirm('هل أنت متأكد من حذف هذه الفاتورة نهائياً؟')) return;
  invoices = invoices.filter(i => i.id !== currentInvId);
  queueDelete('invoice', currentInvId);
  saveInvoices(); closeModal('mdlInvoice'); renderInvoices(); toast('تم حذف الفاتورة');
}

/* ============================================================
   بناء الفاتورة الورقية
   ============================================================ */
const BANKS = [
  ['العمقي', '254149098'],
  ['كريمي دولار', '3074992648'],
  ['كريمي سعودي', '3074979757'],
  ['كريمي يمني', '3000252588'],
  ['بن دول / صرافة إيداع', '23420352'],
  ['بن دول / بنك', '318204'],
  ['البسيري / صرافة', '23256602'],
  ['البسيري / بنك', '58108'],
  ['القطيبي', '491662644'],
  ['بي كاش (محفظة)', '774602234']
];

function detailsLines(inv) {
  const d = inv.details || {};
  const lines = [];
  if (d.neckMain === 'قلاب') {
    let t = 'قلاب';
    if (d.neckStyle) t += ' — ' + d.neckStyle;
    if (d.neckSize) t += ' (' + d.neckSize + ')';
    lines.push(['نوع الرقبة', t]);
  } else if (d.neckMain === 'سادة') {
    lines.push(['نوع الرقبة', 'سادة' + ((d.neckSada || []).length ? ' — ' + d.neckSada.join(' + ') : '')]);
  }
  if ((d.pocket || []).length) lines.push(['نوع الجيب', d.pocket.join(' + ')]);
  if (d.sleeve) lines.push(['نوع الأكمام', d.sleeve + (d.sleeve === 'كبك' && (d.kabk || []).length ? ' (' + d.kabk.join(' + ') + ')' : '')]);
  if (d.jabzButtons || d.jabzShara) {
    const j = [];
    if (d.jabzButtons) j.push('أزرار: ' + d.jabzButtons);
    if (d.jabzShara) j.push('شرة: ' + d.jabzShara);
    lines.push(['الجبزور', j.join(' | ')]);
  }
  if (inv.fabricType) lines.push(['نوع القماش', inv.fabricType]);
  if (inv.fabricColor) lines.push(['لون القماش', inv.fabricColor]);
  return lines;
}

function buildInvoiceHTML(inv, opts) {
  const { size, orient, content } = opts;
  const el = document.createElement('div');
  el.className = `inv-paper size-${size} ${orient}`;
  const rem = invRemaining(inv);
  const payStatus = inv.price <= 0 ? '—' : (rem <= 0 ? 'مدفوع بالكامل' : (inv.paid > 0 ? 'مدفوع جزئياً' : 'غير مدفوع'));
  const measOnly = content === 'meas';

  const measRows = MEAS_FIELDS.map(m => `<th>${m}</th>`).join('');
  const measVals = MEAS_FIELDS.map(m => `<td><b>${esc(measText((inv.measurements || {})[m]))}</b></td>`).join('');
  const dLines = detailsLines(inv);

  el.innerHTML = `
    ${settings.logo ? `<img class="inv-wm" src="${settings.logo}">` : ''}
    <div class="inv-band">
      ${settings.logo ? `<img class="logo" src="${settings.logo}">` : '<div style="width:76px"></div>'}
      <div class="shop">
        <div class="nm">${esc(settings.shopName || 'أزرار')}</div>
        <div class="in">${esc(settings.shopAddr || 'إدارة الخياطة الرجالية الحديثة')}${settings.shopPhone ? ' — ' + esc(settings.shopPhone) : ''}</div>
      </div>
      <div class="no-box"><div class="k">رقم الفاتورة</div><div class="v">#${inv.number}</div></div>
    </div>
    <div class="inv-tape"></div>

    <div class="inv-inner">
    <div class="inv-title">${measOnly ? 'بطاقة قياسات' : 'فاتورة خياطة رجالية'}</div>
    <div class="inv-meta">
      <div><b>التاريخ</b>${fmtDate(inv.date)} (${inv.day})</div>
      <div><b>موعد التسليم</b>${inv.delivery ? fmtDate(inv.delivery) + ' (' + dayName(inv.delivery) + ')' : '—'}</div>
      <div><b>نوع التفصيل</b>${esc(inv.cutType || '—')}</div>
      <div><b>العميل</b>${esc(inv.customerName)}</div>
      <div><b>الجوال</b><span style="direction:ltr;display:inline-block">${esc(inv.phone || '—')}</span></div>
      <div><b>حالة الطلب</b>${esc(inv.state || 'تحت التنفيذ')}</div>
    </div>

    <div class="inv-sec">
      <div class="t">القياسات</div>
      <table class="inv-table"><tr>${measRows}</tr><tr>${measVals}</tr></table>
    </div>

    ${dLines.length ? `<div class="inv-sec">
      <div class="t">تفاصيل القصات</div>
      <div class="inv-details">${dLines.map(l => `<div><b>${l[0]}</b><span>${esc(l[1])}</span></div>`).join('')}</div>
    </div>` : ''}

    ${inv.notes ? `<div class="inv-sec"><div class="t">ملاحظات خاصة</div><div style="font-size:12.5px;font-weight:700;padding:2px 0">${esc(inv.notes)}</div></div>` : ''}

    ${(!measOnly && inv.fabricImage) ? `<div class="inv-sec"><div class="t">صورة القماش / التصميم</div><img class="fabric-thumb" src="${inv.fabricImage}"></div>` : ''}

    ${!measOnly ? `<div class="inv-sec">
      <div class="t">بيانات الدفع — ${CURR_NAME[inv.currency || 'SAR']}</div>
      <div class="inv-pay">
        <div><b>السعر</b>${money(inv.price, inv.currency)}</div>
        <div><b>المدفوع</b>${money(inv.paid, inv.currency)}</div>
        <div class="${rem > 0 ? 'due' : ''}"><b>المتبقي</b>${money(rem, inv.currency)}</div>
        <div><b>حالة الدفع</b>${payStatus}</div>
      </div>
    </div>` : ''}

    ${!measOnly ? `<div class="inv-banks">
      <div class="bt">نفخر لثقتكم بنا</div>
      <div class="bn">حساباتنا باسم (إبراهيم سالم حفيظ الهدار)</div>
      <div class="bk-grid">
        ${BANKS.map(b => `<div><span>${b[0]}</span><span class="no">${b[1]}</span></div>`).join('')}
      </div>
    </div>` : ''}

    ${(!measOnly && (settings.waQR || settings.igQR)) ? `<div class="inv-social">
      ${settings.waQR ? `<div class="soc"><img class="qr" src="${settings.waQR}">واتساب</div>` : ''}
      ${settings.igQR ? `<div class="soc"><img class="qr" src="${settings.igQR}">إنستغرام</div>` : ''}
    </div>` : ''}

    <div class="inv-foot">${esc(settings.shopName || 'أزرار')} — شكراً لثقتكم وتعاملكم معنا</div>
    </div>
  `;
  return el;
}

/* ============================================================
   الطباعة والمعاينة و PDF والمشاركة
   ============================================================ */
let previewZoom = 1;

function openPrintOptions() { openModal('mdlPrintOpts'); }

function printOpts() {
  return {
    size: chipValue('poSize') || 'A4',
    orient: chipValue('poOrient') || 'portrait',
    content: chipValue('poContent') || 'full'
  };
}

function openPreview() {
  closeModal('mdlPrintOpts');
  const inv = invoices.find(i => i.id === currentInvId); if (!inv) return;
  const paper = buildInvoiceHTML(inv, printOpts());
  const holder = $('previewHolder'); holder.innerHTML = ''; holder.appendChild(paper);
  previewZoom = window.innerWidth < 500 ? 0.42 : 0.75;
  applyZoom();
  openModal('mdlPreview');
}

function applyZoom() {
  const paper = $('previewHolder').firstChild; if (!paper) return;
  paper.style.transform = `scale(${previewZoom})`;
  paper.style.transformOrigin = 'top right';
  $('zoomVal').textContent = Math.round(previewZoom * 100) + '%';
  $('previewHolder').style.height = (paper.offsetHeight * previewZoom + 20) + 'px';
  $('previewHolder').style.width = (paper.offsetWidth * previewZoom + 20) + 'px';
}
function zoomPreview(d) {
  previewZoom = Math.min(2, Math.max(0.2, previewZoom + d));
  applyZoom();
}

/* توليد PDF من الفاتورة */
async function generatePDF() {
  const inv = invoices.find(i => i.id === currentInvId); if (!inv) return null;
  const opts = printOpts();
  const paper = buildInvoiceHTML(inv, opts);
  const holder = $('printHolder'); holder.innerHTML = ''; holder.appendChild(paper);
  toast('⏳ جارٍ تجهيز الملف...');
  const canvas = await html2canvas(paper, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
  holder.innerHTML = '';
  const img = canvas.toDataURL('image/jpeg', 0.92);
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: opts.orient, unit: 'mm', format: opts.size.toLowerCase() });
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  const imgH = (canvas.height * pw) / canvas.width;
  if (imgH <= ph) {
    pdf.addImage(img, 'JPEG', 0, 0, pw, imgH);
  } else {
    // تقسيم على صفحات متعددة
    let remaining = canvas.height;
    const pagePx = (ph * canvas.width) / pw;
    let pos = 0, first = true;
    while (remaining > 0) {
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = Math.min(pagePx, remaining);
      slice.getContext('2d').drawImage(canvas, 0, pos, canvas.width, slice.height, 0, 0, canvas.width, slice.height);
      if (!first) pdf.addPage();
      pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pw, (slice.height * pw) / canvas.width);
      pos += slice.height; remaining -= slice.height; first = false;
    }
  }
  return { pdf, name: `فاتورة-${inv.number}.pdf`, asciiName: `invoice-${inv.number}.pdf` };
}

/* حفظ ومشاركة الملف عبر Capacitor */
async function sharePDFFile(out, title) {
  const Filesystem = plugin('Filesystem');
  const Share = plugin('Share');
  if (isCap() && Filesystem && Share) {
    const base64 = out.pdf.output('datauristring').split(',')[1];
    await Filesystem.writeFile({ path: out.asciiName, data: base64, directory: 'CACHE' });
    const uri = await Filesystem.getUri({ path: out.asciiName, directory: 'CACHE' });
    await Share.share({ title: title || out.name, files: [uri.uri] });
  } else {
    out.pdf.save(out.name);
  }
}

async function doSavePDF() {
  try {
    const out = await generatePDF(); if (!out) return;
    if (isCap()) { await sharePDFFile(out, 'حفظ الفاتورة PDF'); toast('✓ اختر «حفظ في الملفات» أو أي تطبيق'); }
    else { out.pdf.save(out.name); toast('✓ تم حفظ ملف PDF'); }
  } catch (e) { toast('تعذر إنشاء الملف'); }
}

async function quickPDF() { setChips('poSize', 'A4'); setChips('poOrient', 'portrait'); setChips('poContent', 'full'); await doSavePDF(); }

async function doDirectPrint() {
  // داخل التطبيق: نفتح مشاركة الملف لاختيار خدمة الطباعة، وفي المتصفح: طباعة مباشرة
  if (isCap()) {
    try {
      const out = await generatePDF(); if (!out) return;
      await sharePDFFile(out, 'طباعة الفاتورة');
      toast('اختر تطبيق أو خدمة الطباعة من القائمة');
    } catch (e) { toast('تعذرت الطباعة'); }
  } else {
    const inv = invoices.find(i => i.id === currentInvId); if (!inv) return;
    const paper = buildInvoiceHTML(inv, printOpts());
    const holder = $('printHolder'); holder.innerHTML = ''; holder.appendChild(paper);
    holder.style.position = 'static';
    window.print();
    holder.style.position = 'fixed';
    holder.innerHTML = '';
  }
}

async function doShare(via) {
  try {
    const out = await generatePDF(); if (!out) return;
    const titles = { whatsapp: 'مشاركة عبر واتساب', bluetooth: 'مشاركة عبر البلوتوث', wifi: 'مشاركة عبر Wi-Fi', share: 'مشاركة الفاتورة' };
    await sharePDFFile(out, titles[via] || 'مشاركة');
    if (via === 'whatsapp') toast('اختر واتساب من قائمة المشاركة');
    else if (via === 'bluetooth') toast('اختر البلوتوث من قائمة المشاركة');
    else if (via === 'wifi') toast('اختر المشاركة القريبة / Wi-Fi من القائمة');
  } catch (e) { toast('تعذرت المشاركة'); }
}

async function shareInvoice(via) {
  setChips('poSize', 'A4'); setChips('poOrient', 'portrait'); setChips('poContent', 'full');
  await doShare(via);
}

/* ============================================================
   الحسابات
   ============================================================ */
function openAccounts() {
  if (!unlocked) { askPassword('accounts'); return; }
  showPage('page-accounts'); renderAccounts();
}

function renderAccounts() {
  const revenue = invoices.reduce((s, i) => s + toYER(i.paid, i.currency), 0);
  const supPay = suppliers.reduce((s, sp) => s + (sp.tx || []).filter(t => t.type === 'دفعة').reduce((a, t) => a + Number(t.amount || 0), 0), 0);
  const expManual = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const expTotal = expManual + supPay;
  const remaining = invoices.reduce((s, i) => s + toYER(invRemaining(i), i.currency), 0);

  $('accStats').innerHTML = `
    <div class="stat gold"><div class="num">${money(revenue)}</div><div class="lbl">الإيرادات المحصلة</div></div>
    <div class="stat"><div class="num">${money(expTotal)}</div><div class="lbl">المصروفات (شاملة دفعات الموردين)</div></div>
    <div class="stat gold"><div class="num">${money(revenue - expTotal)}</div><div class="lbl">صافي الأرباح</div></div>
    <div class="stat"><div class="num">${money(remaining)}</div><div class="lbl">مبالغ متبقية لدى العملاء</div></div>`;

  $('expList').innerHTML = expenses.length ? expenses.slice().reverse().map(e =>
    `<div class="list-item"><div class="li-head">
      <div><div class="li-name">💸 ${esc(e.desc || 'مصروف')}</div><div class="li-sub">📅 ${fmtDate(e.date)}</div></div>
      <div style="display:flex;gap:6px;align-items:center">
        <span class="badge danger">${money(e.amount)}</span>
        <button class="btn sm danger" onclick="deleteExpense('${e.id}')">🗑️</button>
      </div>
    </div></div>`).join('') : '<div class="empty">لا توجد مصروفات مسجلة</div>';

  // كشف الحساب
  const st = [];
  invoices.forEach(i => { if (Number(i.paid) > 0) st.push({ date: i.date, desc: `دفعة فاتورة #${i.number} — ${i.customerName}`, inAmt: toYER(i.paid, i.currency), outAmt: 0 }); });
  expenses.forEach(e => st.push({ date: e.date, desc: 'مصروف: ' + (e.desc || '—'), inAmt: 0, outAmt: Number(e.amount || 0) }));
  suppliers.forEach(sp => (sp.tx || []).forEach(t => { if (t.type === 'دفعة') st.push({ date: t.date, desc: 'دفعة للمورد ' + sp.name, inAmt: 0, outAmt: Number(t.amount || 0) }); }));
  st.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  let bal = 0;
  const rows = st.map(r => { bal += r.inAmt - r.outAmt; return `<tr><td>${fmtDate(r.date)}</td><td style="text-align:right">${esc(r.desc)}</td><td>${r.inAmt ? money(r.inAmt) : '—'}</td><td>${r.outAmt ? money(r.outAmt) : '—'}</td><td><b>${money(bal)}</b></td></tr>`; }).join('');
  $('statementList').innerHTML = st.length
    ? `<table class="tbl"><tr><th>التاريخ</th><th>البيان</th><th>وارد</th><th>صادر</th><th>الرصيد</th></tr>${rows}</table>`
    : '<div class="empty">لا توجد حركات بعد</div>';
}

function openExpenseForm() {
  $('eDesc').value = ''; $('eAmount').value = ''; $('eDate').value = todayISO();
  openModal('mdlExpense');
}
function saveExpense() {
  const amount = Number($('eAmount').value || 0);
  if (amount <= 0) { toast('أدخل مبلغ المصروف'); return; }
  const rec = { id: uid(), desc: $('eDesc').value.trim(), amount, date: $('eDate').value || todayISO(), updatedAt: Date.now() };
  expenses.push(rec);
  queuePush('expense', rec.id);
  saveExpenses(); closeModal('mdlExpense'); renderAccounts(); toast('✓ تم حفظ المصروف');
}
function deleteExpense(id) {
  if (!confirm('حذف هذا المصروف؟')) return;
  expenses = expenses.filter(e => e.id !== id);
  queueDelete('expense', id);
  saveExpenses(); renderAccounts();
}

/* ============================================================
   التقارير
   ============================================================ */
let repPeriod = 'يومي';
function setRep(btn) {
  repPeriod = btn.dataset.v;
  $('repChips').querySelectorAll('.chip').forEach(c => c.classList.toggle('selected', c === btn));
  renderReport();
}

function periodRange() {
  const now = new Date(todayISO() + 'T12:00');
  const end = todayISO();
  let start;
  if (repPeriod === 'يومي') start = end;
  else if (repPeriod === 'أسبوعي') { const d = new Date(now); d.setDate(d.getDate() - 6); start = d.toISOString().slice(0, 10); }
  else if (repPeriod === 'شهري') start = end.slice(0, 7) + '-01';
  else start = end.slice(0, 4) + '-01-01';
  return { start, end };
}

function reportData() {
  const { start, end } = periodRange();
  const inRange = d => d && d >= start && d <= end;
  const invs = invoices.filter(i => inRange(i.date));
  const exps = expenses.filter(e => inRange(e.date));
  const supPays = [];
  suppliers.forEach(sp => (sp.tx || []).forEach(t => { if (t.type === 'دفعة' && inRange(t.date)) supPays.push(t); }));
  const revenue = invs.reduce((s, i) => s + toYER(i.paid, i.currency), 0);
  const expTotal = exps.reduce((s, e) => s + Number(e.amount || 0), 0) + supPays.reduce((s, t) => s + Number(t.amount || 0), 0);
  const remaining = invs.reduce((s, i) => s + toYER(invRemaining(i), i.currency), 0);
  return { start, end, invs, revenue, expTotal, remaining, delivered: invs.filter(i => i.state === 'تم التسليم').length };
}

function renderReport() {
  const d = reportData();
  const finance = unlocked ? `
    <div class="stats-grid" style="margin-top:10px">
      <div class="stat gold"><div class="num">${money(d.revenue)}</div><div class="lbl">الإيرادات</div></div>
      <div class="stat"><div class="num">${money(d.expTotal)}</div><div class="lbl">المصروفات</div></div>
      <div class="stat gold"><div class="num">${money(d.revenue - d.expTotal)}</div><div class="lbl">صافي الأرباح</div></div>
      <div class="stat"><div class="num">${money(d.remaining)}</div><div class="lbl">المتبقي لدى العملاء</div></div>
    </div>` : `<div class="card lock-note" style="margin-top:10px">🔒 الأرقام المالية محمية — <button class="btn sm gold" onclick="askPassword('dashboard')">فتح</button></div>`;

  const rows = d.invs.slice().sort((a, b) => (a.date || '').localeCompare(b.date || '')).map(i =>
    `<tr><td>#${i.number}</td><td>${fmtDate(i.date)}</td><td style="text-align:right">${esc(i.customerName)}</td><td>${money(i.price, i.currency)}</td><td>${money(i.paid, i.currency)}</td><td>${i.state}</td></tr>`).join('');

  $('repContent').innerHTML = `
    <div class="card flat">
      <b>التقرير ${repPeriod}</b> — من ${fmtDate(d.start)} إلى ${fmtDate(d.end)}
      <div class="li-sub" style="margin-top:4px">عدد الفواتير: <b>${d.invs.length}</b> | تم تسليمها: <b>${d.delivered}</b></div>
    </div>
    ${finance}
    <div class="section-label">فواتير الفترة</div>
    <div style="overflow-x:auto">${d.invs.length ? `<table class="tbl"><tr><th>الرقم</th><th>التاريخ</th><th>العميل</th><th>السعر</th><th>المدفوع</th><th>الحالة</th></tr>${rows}</table>` : '<div class="empty">لا توجد فواتير في هذه الفترة</div>'}</div>`;
}

async function exportReportPDF() {
  const d = reportData();
  const el = document.createElement('div');
  el.className = 'inv-paper size-A4 portrait';
  el.innerHTML = `
    ${settings.logo ? `<img class="inv-wm" src="${settings.logo}">` : ''}
    <div class="inv-band">
      ${settings.logo ? `<img class="logo" src="${settings.logo}">` : '<div style="width:76px"></div>'}
      <div class="shop"><div class="nm">${esc(settings.shopName || 'أزرار')}</div><div class="in">التقارير المالية</div></div>
      <div class="no-box"><div class="k">تقرير</div><div class="v" style="font-size:14px;direction:rtl">${repPeriod}</div></div>
    </div>
    <div class="inv-tape"></div>
    <div class="inv-inner">
    <div class="inv-title">التقرير ال${repPeriod} — من ${fmtDate(d.start)} إلى ${fmtDate(d.end)}</div>
    <div class="inv-pay" style="margin-bottom:14px">
      <div><b>عدد الفواتير</b>${d.invs.length}</div>
      <div><b>الإيرادات</b>${money(d.revenue)}</div>
      <div><b>المصروفات</b>${money(d.expTotal)}</div>
      <div><b>صافي الأرباح</b>${money(d.revenue - d.expTotal)}</div>
    </div>
    <div class="inv-sec"><div class="t">فواتير الفترة</div>
    <table class="inv-table"><tr><th>الرقم</th><th>التاريخ</th><th>العميل</th><th>السعر</th><th>المدفوع</th><th>المتبقي</th><th>الحالة</th></tr>
    ${d.invs.map(i => `<tr><td>#${i.number}</td><td>${fmtDate(i.date)}</td><td>${esc(i.customerName)}</td><td>${money(i.price, i.currency)}</td><td>${money(i.paid, i.currency)}</td><td>${money(invRemaining(i), i.currency)}</td><td>${i.state}</td></tr>`).join('')}
    </table></div>
    <div class="inv-foot">أُنشئ بتاريخ ${fmtDate(todayISO())} — ${esc(settings.shopName || 'أزرار')}</div>
    </div>`;

  const holder = $('printHolder'); holder.innerHTML = ''; holder.appendChild(el);
  toast('⏳ جارٍ تجهيز التقرير...');
  try {
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff' });
    holder.innerHTML = '';
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pw = pdf.internal.pageSize.getWidth();
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pw, (canvas.height * pw) / canvas.width);
    const out = { pdf, name: `تقرير-${repPeriod}-${todayISO()}.pdf`, asciiName: `report-${todayISO()}.pdf` };
    await sharePDFFile(out, 'تصدير التقرير');
    if (!isCap()) toast('✓ تم حفظ التقرير PDF');
  } catch (e) { holder.innerHTML = ''; toast('تعذر إنشاء التقرير'); }
}

/* ============================================================
   الإعدادات
   ============================================================ */
function renderSettings() {
  $('setShopName').value = settings.shopName || '';
  $('setShopPhone').value = settings.shopPhone || '';
  $('setShopAddr').value = settings.shopAddr || '';
  $('setRateUSD').value = settings.rateUSD;
  $('setRateSAR').value = settings.rateSAR;
  renderSyncSettings();
  const imgs = [['logo', 'logoPreview'], ['waQR', 'waQRPreview'], ['igQR', 'igQRPreview']];
  imgs.forEach(([k, p]) => {
    if (settings[k]) { $(p).src = settings[k]; $(p).style.display = ''; } else $(p).style.display = 'none';
  });
}

function loadSettingImg(input, key) {
  const f = input.files && input.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    settings[key] = r.result;
    settings.updatedAt = Date.now();
    queuePush('settings', 'main');
    saveSettingsDB(); renderSettings();
    toast('✓ تم رفع الصورة — ستظهر تلقائياً في الفاتورة');
  };
  r.readAsDataURL(f);
}

function saveSettings() {
  settings.shopName = $('setShopName').value.trim() || 'أزرار';
  settings.shopPhone = $('setShopPhone').value.trim();
  settings.shopAddr = $('setShopAddr').value.trim();
  settings.rateUSD = Number($('setRateUSD').value || 535);
  settings.rateSAR = Number($('setRateSAR').value || 140);
  settings.updatedAt = Date.now();
  queuePush('settings', 'main');
  saveSettingsDB();
  $('hdrShopName').textContent = settings.shopName;
  toast('✓ تم حفظ الإعدادات');
}

/* ============================================================
   النسخ الاحتياطي
   ============================================================ */
async function exportBackup() {
  const data = {
    app: 'tailor-shop-manager', version: 1, exportedAt: new Date().toISOString(),
    customers, invoices, suppliers, expenses, settings,
    counter: DB.get('ts_counter', 0)
  };
  const json = JSON.stringify(data);
  const fname = `نسخة-احتياطية-خياطة-${todayISO()}.json`;
  const Filesystem = plugin('Filesystem');
  const Share = plugin('Share');
  try {
    if (isCap() && Filesystem && Share) {
      const b64 = btoa(unescape(encodeURIComponent(json)));
      const ascii = `tailor-backup-${todayISO()}.json`;
      await Filesystem.writeFile({ path: ascii, data: b64, directory: 'CACHE' });
      const uri = await Filesystem.getUri({ path: ascii, directory: 'CACHE' });
      await Share.share({ title: 'النسخة الاحتياطية', files: [uri.uri] });
      toast('✓ اختر مكان حفظ النسخة أو أرسلها للجهاز الآخر');
    } else {
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = fname; a.click();
      toast('✓ تم تصدير النسخة الاحتياطية');
    }
  } catch (e) { toast('تعذر التصدير'); }
}

function importBackup() {
  const f = $('backupFile').files && $('backupFile').files[0];
  if (!f) { toast('اختر ملف النسخة الاحتياطية أولاً'); return; }
  if (!confirm('سيتم استبدال جميع البيانات الحالية بالنسخة الاحتياطية. هل أنت متأكد؟')) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const data = JSON.parse(r.result);
      if (!data || data.app !== 'tailor-shop-manager') { toast('✗ ملف غير صالح'); return; }
      customers = data.customers || []; invoices = data.invoices || [];
      suppliers = data.suppliers || []; expenses = data.expenses || [];
      settings = Object.assign(settings, data.settings || {});
      saveCustomers(); saveInvoices(); saveSuppliers(); saveExpenses(); saveSettingsDB();
      DB.set('ts_counter', data.counter || 0);
      $('hdrShopName').textContent = settings.shopName;
      if (syncCfg.enabled) { settings.updatedAt = Date.now(); markAllDirty(); queuePush('settings', 'main'); }
      renderDashboard(); showPage('page-dashboard');
      toast('✓ تم استعادة البيانات بنجاح');
    } catch (e) { toast('✗ تعذرت قراءة الملف'); }
  };
  r.readAsText(f);
}

/* ============================================================
   التهيئة
   ============================================================ */
function initApp() {
  buildMeasRows();
  $('hdrShopName').textContent = settings.shopName || 'أزرار';

  // أزرار الاختيار العامة
  initChips('cutTypeChips', { onChange: v => { $('fCutOther').style.display = v[0] === 'أخرى' ? '' : 'none'; } });
  initChips('currChips');
  initChips('neckMain', { onChange: v => {
    $('neckQallab').style.display = v[0] === 'قلاب' ? '' : 'none';
    $('neckSada').style.display = v[0] === 'سادة' ? '' : 'none';
  }});
  initChips('neckQallabStyle'); initChips('neckQallabSize'); initChips('neckSadaOpts');
  initChips('pocketOpts');
  initChips('sleeveOpts', { onChange: v => { $('kabkBlock').style.display = v[0] === 'كبك' ? '' : 'none'; } });
  initChips('kabkOpts');
  initChips('jabzButtons'); initChips('jabzShara');
  initChips('supTxType');
  initChips('poSize'); initChips('poOrient'); initChips('poContent');
  initChips('repChips');
  initChips('syncEnableChips');
  $('repChips').querySelectorAll('.chip').forEach(c => c.onclick = () => setRep(c));

  renderDashboard();
  initSync();
}
document.addEventListener('DOMContentLoaded', initApp);

/* ============================================================
   المزامنة السحابية بين الأجهزة (Supabase)
   نظام مزامنة لكل سجل على حدة — الأحدث يفوز (LWW)
   ============================================================ */
let syncCfg = Object.assign({ enabled: false, url: '', key: '', shopId: '', lastPull: 0, outbox: [], tombstones: {} }, DB.get('ts_sync', {}));
const saveSyncCfg = () => DB.set('ts_sync', syncCfg);
let sb = null, sbChannel = null, pushTimer = null, syncBusy = false, syncTimerStarted = false;

function collectionsMap() { return { customer: customers, invoice: invoices, supplier: suppliers, expense: expenses }; }
function syncReady() { return syncCfg.enabled && syncCfg.url && syncCfg.key && syncCfg.shopId && window.supabase; }

function setSyncDot(state) {
  const d = $('syncDot'); if (!d) return;
  if (!syncCfg.enabled) { d.style.display = 'none'; return; }
  d.style.display = 'inline-block';
  const colors = { on: '#4CAF50', pending: '#FFB300', err: '#E53935', off: '#8a8a8a' };
  d.style.background = colors[state] || colors.off;
  d.title = { on: 'المزامنة تعمل ✓', pending: 'جارٍ المزامنة...', err: 'تعذر الاتصال — سيُعاد تلقائياً', off: 'المزامنة متوقفة' }[state] || '';
}

function updateSyncStatusUI() {
  const el = $('syncStatus'); if (!el) return;
  if (!syncCfg.enabled) { el.textContent = 'المزامنة متوقفة'; return; }
  const pend = syncCfg.outbox.length;
  const last = syncCfg.lastPull ? new Date(syncCfg.lastPull).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : '—';
  el.textContent = `مفعّلة ✓ | آخر مزامنة: ${last}${pend ? ` | بانتظار الرفع: ${pend}` : ''}`;
}

function touchRec(rec) { if (rec) rec.updatedAt = Date.now(); return rec; }

function queuePush(type, id) {
  if (!syncCfg.enabled) return;
  if (!syncCfg.outbox.find(o => o.type === type && o.id === id)) syncCfg.outbox.push({ type, id });
  saveSyncCfg(); setSyncDot('pending');
  clearTimeout(pushTimer); pushTimer = setTimeout(pushOutbox, 1500);
}
function queueDelete(type, id) {
  if (!syncCfg.enabled) return;
  syncCfg.tombstones[type + ':' + id] = Date.now();
  queuePush(type, id);
}

function recordFor(type, id) {
  if (type === 'settings') return Object.assign({}, settings);
  if (type === 'meta') return { value: Number(DB.get('ts_counter', 0)) };
  const col = collectionsMap()[type];
  return col ? col.find(r => r.id === id) : null;
}

async function pushOutbox() {
  if (!syncReady() || !navigator.onLine || !syncCfg.outbox.length || !sb) return;
  const rows = syncCfg.outbox.map(o => {
    const tomb = syncCfg.tombstones[o.type + ':' + o.id];
    const rec = recordFor(o.type, o.id);
    if (tomb && !rec) return { shop_id: syncCfg.shopId, rec_type: o.type, rec_id: o.id, data: {}, updated_at: tomb, deleted: true };
    if (!rec) return null;
    return { shop_id: syncCfg.shopId, rec_type: o.type, rec_id: o.id, data: rec, updated_at: rec.updatedAt || Date.now(), deleted: false };
  }).filter(Boolean);
  if (!rows.length) { syncCfg.outbox = []; saveSyncCfg(); updateSyncStatusUI(); return; }
  try {
    const { error } = await sb.from('shop_data').upsert(rows);
    if (error) throw error;
    syncCfg.outbox = []; saveSyncCfg();
    setSyncDot('on'); updateSyncStatusUI();
  } catch (e) { setSyncDot('err'); }
}

function persistCol(type) {
  if (type === 'customer') saveCustomers();
  if (type === 'invoice') saveInvoices();
  if (type === 'supplier') saveSuppliers();
  if (type === 'expense') saveExpenses();
}

function applyRemoteRow(r, rerender) {
  if (!r || r.shop_id !== syncCfg.shopId) return false;
  const type = r.rec_type, id = r.rec_id, ts = Number(r.updated_at) || 0;

  if (type === 'settings') {
    if (r.deleted) return false;
    const localTs = Number(settings.updatedAt || 0);
    if (ts <= localTs) return false;
    settings = Object.assign(settings, r.data, { updatedAt: ts });
    saveSettingsDB();
    const hd = $('hdrShopName'); if (hd) hd.textContent = settings.shopName || 'أزرار';
    if (rerender) refreshActivePage();
    return true;
  }
  if (type === 'meta') {
    const cur = Number(DB.get('ts_counter', 0));
    const remote = Number((r.data && r.data.value) || 0);
    if (remote > cur) { DB.set('ts_counter', remote); return true; }
    return false;
  }
  const col = collectionsMap()[type]; if (!col) return false;
  const idx = col.findIndex(x => x.id === id);
  const localTs = idx >= 0 ? Number(col[idx].updatedAt || 0) : 0;
  if (ts <= localTs) return false;
  if (r.deleted) {
    if (idx >= 0) { col.splice(idx, 1); persistCol(type); if (rerender) refreshActivePage(); return true; }
    return false;
  }
  const rec = r.data || {};
  if (!rec.updatedAt) rec.updatedAt = ts;
  if (idx >= 0) col[idx] = rec; else col.push(rec);
  persistCol(type);
  if (rerender) refreshActivePage();
  return true;
}

async function pullRemote() {
  if (!syncReady() || !navigator.onLine || syncBusy || !sb) return;
  syncBusy = true;
  try {
    const { data, error } = await sb.from('shop_data').select('*')
      .eq('shop_id', syncCfg.shopId)
      .gt('updated_at', Number(syncCfg.lastPull || 0))
      .order('updated_at', { ascending: true })
      .limit(1000);
    if (error) throw error;
    let changed = false;
    (data || []).forEach(r => {
      if (applyRemoteRow(r, false)) changed = true;
      if (Number(r.updated_at) > Number(syncCfg.lastPull || 0)) syncCfg.lastPull = Number(r.updated_at);
    });
    saveSyncCfg();
    if (changed) refreshActivePage();
    setSyncDot(syncCfg.outbox.length ? 'pending' : 'on');
    updateSyncStatusUI();
  } catch (e) { setSyncDot('err'); }
  syncBusy = false;
}

function refreshActivePage() {
  const active = document.querySelector('.page.active'); if (!active) return;
  const id = active.id;
  if (id === 'page-dashboard') renderDashboard();
  if (id === 'page-invoices') renderInvoices();
  if (id === 'page-customers') renderCustomers();
  if (id === 'page-suppliers') renderSuppliers();
  if (id === 'page-accounts' && unlocked) renderAccounts();
  if (id === 'page-reports') renderReport();
}

async function fullSync() { await pushOutbox(); await pullRemote(); }
function manualSync() {
  if (!syncCfg.enabled) { toast('فعّل المزامنة أولاً واحفظ الإعدادات'); return; }
  toast('جارٍ المزامنة...'); fullSync();
}

function subscribeRealtime() {
  if (!sb) return;
  try { if (sbChannel) sb.removeChannel(sbChannel); } catch (e) {}
  sbChannel = sb.channel('shop-sync-' + syncCfg.shopId)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'shop_data', filter: 'shop_id=eq.' + syncCfg.shopId },
      payload => { if (payload.new && Object.keys(payload.new).length) applyRemoteRow(payload.new, true); updateSyncStatusUI(); })
    .subscribe(status => { if (status === 'SUBSCRIBED') setSyncDot(syncCfg.outbox.length ? 'pending' : 'on'); });
}

function initSync() {
  setSyncDot('off'); updateSyncStatusUI();
  if (!syncReady()) return;
  try {
    sb = window.supabase.createClient(syncCfg.url.trim().replace(/\/+$/, ''), syncCfg.key.trim());
    subscribeRealtime();
    fullSync();
    if (!syncTimerStarted) {
      syncTimerStarted = true;
      setInterval(() => { if (!document.hidden) fullSync(); }, 60000);
      window.addEventListener('online', fullSync);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) fullSync(); });
    }
  } catch (e) { setSyncDot('err'); }
}

function markAllDirty() {
  Object.entries(collectionsMap()).forEach(([t, col]) => col.forEach(r => {
    if (!r.updatedAt) r.updatedAt = Date.now();
    queuePush(t, r.id);
  }));
  if (settings.updatedAt) queuePush('settings', 'main');
  if (Number(DB.get('ts_counter', 0)) > 0) queuePush('meta', 'counter');
  saveCustomers(); saveInvoices(); saveSuppliers(); saveExpenses();
}

function renderSyncSettings() {
  setChips('syncEnableChips', syncCfg.enabled ? 'on' : 'off');
  $('syncUrl').value = syncCfg.url || '';
  $('syncKey').value = syncCfg.key || '';
  $('syncShop').value = syncCfg.shopId || '';
  updateSyncStatusUI();
}

async function saveSyncSettings() {
  const enable = chipValue('syncEnableChips') === 'on';
  syncCfg.url = $('syncUrl').value.trim();
  syncCfg.key = $('syncKey').value.trim();
  syncCfg.shopId = $('syncShop').value.trim();
  if (enable && (!syncCfg.url || !syncCfg.key || !syncCfg.shopId)) {
    toast('أكمل رابط المشروع والمفتاح ومعرّف المحل'); return;
  }
  const wasEnabled = syncCfg.enabled;
  syncCfg.enabled = enable;
  saveSyncCfg();
  if (enable) {
    initSync();
    if (!wasEnabled) {
      await pullRemote();   // جلب بيانات المحل أولاً (مهم للجوال الثاني)
      markAllDirty();       // ثم رفع البيانات المحلية
      await pushOutbox();
    }
    toast('✓ تم تشغيل المزامنة');
  } else {
    setSyncDot('off');
    toast('تم إيقاف المزامنة');
  }
  updateSyncStatusUI();
}
